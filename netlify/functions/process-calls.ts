// netlify/functions/process-calls.ts
// Scheduled function to process pending calls
// Runs every 5 minutes, checks if within calling hours before processing

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

// Database connection (inline to avoid module resolution issues)
import { neon } from '@neondatabase/serverless'

const CALLING_HOURS = {
  start: 7, // 7 AM
  end: 23,  // 11 PM (allowing evening calls)
  timezone: 'America/Toronto'
}

interface ScheduledCall {
  id: string
  campaignId: string
  phone: string
  name: string | null
  firstMessage: string | null
  fullPrompt: string | null
}

interface Campaign {
  id: string
  callDays: string[]
  callStartHour: number
  callEndHour: number
  timezone: string
  recordingDisclosure: string
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('[ProcessCalls] Starting scheduled function')

  try {
    // Check database URL
    if (!process.env.DATABASE_URL) {
      console.error('[ProcessCalls] DATABASE_URL not set')
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'DATABASE_URL not configured' })
      }
    }

    const sql = neon(process.env.DATABASE_URL)

    // Check if within calling hours (EST)
    const now = new Date()
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: CALLING_HOURS.timezone }))
    const currentHour = estTime.getHours()
    const dayOfWeek = estTime.getDay() // 0 = Sunday, 1 = Monday, etc.

    console.log(`[ProcessCalls] Current time: ${estTime.toISOString()}, Hour: ${currentHour}, Day: ${dayOfWeek}`)

    // Note: Weekend check removed - campaigns can now run on any day
    // The campaign's callDays setting determines which days calls are made

    // Check if within business hours
    if (currentHour < CALLING_HOURS.start || currentHour >= CALLING_HOURS.end) {
      console.log(`[ProcessCalls] Outside calling hours (${CALLING_HOURS.start}-${CALLING_HOURS.end})`)
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Outside calling hours' })
      }
    }

    // OPTIMIZED: Quick stuck call processing - no external API calls to avoid timeout
    const stuckCalls = await sql`
      SELECT
        sc.id,
        sc.phone,
        (SELECT cl.outcome FROM call_logs cl
         WHERE cl.scheduled_call_id = sc.id
         AND cl.outcome IN ('answered', 'voicemail')
         ORDER BY cl.created_at DESC LIMIT 1) as existing_outcome
      FROM scheduled_calls sc
      WHERE sc.status = 'calling'
      AND sc.updated_at < NOW() - INTERVAL '5 minutes'
      LIMIT 10
    `

    // Process stuck calls quickly - just sync status from call_logs
    for (const stuckCall of stuckCalls) {
      if (stuckCall.existing_outcome) {
        console.log(`[ProcessCalls] Syncing stuck call ${stuckCall.phone} to ${stuckCall.existing_outcome}`)
        await sql`
          UPDATE scheduled_calls
          SET status = ${stuckCall.existing_outcome}, updated_at = NOW()
          WHERE id = ${stuckCall.id}
        `
      } else {
        console.log(`[ProcessCalls] Marking stuck call ${stuckCall.phone} as failed`)
        await sql`
          UPDATE scheduled_calls
          SET status = 'failed', skipped_reason = 'Call stuck in calling state', updated_at = NOW()
          WHERE id = ${stuckCall.id}
        `
      }
    }

    if (stuckCalls.length > 0) {
      console.log(`[ProcessCalls] Processed ${stuckCalls.length} stuck call(s)`)
    }

    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'

    // Check if any call is still in progress or calling (exclude stuck calls we just processed)
    const inProgressResult = await sql`
      SELECT COUNT(*) as count FROM scheduled_calls
      WHERE status IN ('in_progress', 'calling')
      AND updated_at >= NOW() - INTERVAL '5 minutes'
    `
    const inProgressCount = Number(inProgressResult[0]?.count || 0)

    if (inProgressCount > 0) {
      console.log('[ProcessCalls] Call already in progress, waiting')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Call in progress, waiting' })
      }
    }

    // Get next pending call
    const pendingCallResult = await sql`
      SELECT
        sc.id, sc.campaign_id as "campaignId", sc.phone, sc.name,
        sc.first_message as "firstMessage", sc.full_prompt as "fullPrompt"
      FROM scheduled_calls sc
      JOIN campaigns c ON sc.campaign_id = c.id
      WHERE sc.status = 'pending'
        AND sc.scheduled_at <= NOW()
        AND c.status = 'active'
      ORDER BY c.priority DESC, sc.scheduled_at ASC
      LIMIT 1
    `

    if (pendingCallResult.length === 0) {
      console.log('[ProcessCalls] No pending calls')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No pending calls' })
      }
    }

    const call = pendingCallResult[0] as ScheduledCall
    console.log(`[ProcessCalls] Found call to process: ${call.id}, phone: ${call.phone}`)

    // Get campaign for recording disclosure
    const campaignResult = await sql`
      SELECT id, call_days as "callDays", call_start_hour as "callStartHour",
             call_end_hour as "callEndHour", timezone,
             recording_disclosure as "recordingDisclosure"
      FROM campaigns WHERE id = ${call.campaignId}
    `
    const campaign = campaignResult[0] as Campaign

    // Check DNC list
    const dncResult = await sql`
      SELECT COUNT(*) as count FROM dnc_list
      WHERE (phone = ${call.phone}
             OR phone = ${call.phone.replace('+1', '')}
             OR phone = ${'+1' + call.phone.replace('+1', '')})
        AND (campaign_id IS NULL OR campaign_id = ${call.campaignId})
    `
    const isDnc = Number(dncResult[0]?.count || 0) > 0

    if (isDnc) {
      console.log(`[ProcessCalls] Phone ${call.phone} is on DNC list, skipping`)
      await sql`
        UPDATE scheduled_calls SET status = 'dnc', skipped_reason = 'On DNC list'
        WHERE id = ${call.id}
      `
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Phone on DNC, skipped' })
      }
    }

    // Mark call as in progress (set updated_at for timeout tracking)
    await sql`
      UPDATE scheduled_calls SET status = 'in_progress', updated_at = NOW() WHERE id = ${call.id}
    `

    // Prepare the first message with recording disclosure
    const firstMessageWithDisclosure = campaign.recordingDisclosure
      ? `${campaign.recordingDisclosure} ${call.firstMessage || ''}`
      : call.firstMessage || ''

    // Make the outbound call via our API
    const callResponse = await fetch(`${baseUrl}/api/outbound-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: call.phone,
        firstMessage: firstMessageWithDisclosure,
        fullPrompt: call.fullPrompt || '',
        scheduledCallId: call.id, // Pass this for callback tracking
        campaignId: call.campaignId,
        contactName: call.name || ''
      })
    })

    const callResult = await callResponse.json()

    if (callResult.success) {
      console.log(`[ProcessCalls] Call initiated: ${callResult.callSid}`)

      // Create call log entry
      await sql`
        INSERT INTO call_logs (campaign_id, scheduled_call_id, conversation_id, call_sid,
                              direction, phone, review_status, email_sent)
        VALUES (${call.campaignId}, ${call.id}, ${callResult.conversationId || null},
                ${callResult.callSid || null}, 'outbound', ${call.phone}, 'pending', false)
      `

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Call initiated',
          callSid: callResult.callSid,
          conversationId: callResult.conversationId
        })
      }
    } else {
      console.error(`[ProcessCalls] Failed to initiate call: ${callResult.error}`)

      // Mark as failed
      await sql`
        UPDATE scheduled_calls SET status = 'failed' WHERE id = ${call.id}
      `

      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to initiate call', details: callResult.error })
      }
    }
  } catch (error) {
    console.error('[ProcessCalls] Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error', details: String(error) })
    }
  }
}

export { handler }
