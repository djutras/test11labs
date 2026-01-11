// app/api/cron/process-calls/route.ts
// API endpoint to process pending calls - can be called by external cron service

import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

const CALLING_HOURS = {
  start: 7,
  end: 24, // Minuit
  timezone: 'America/Toronto'
}

export async function GET(request: Request) {
  // Optional: Add a secret key for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron] Processing pending calls...')

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 })
    }

    const sql = neon(process.env.DATABASE_URL)

    // Check if within calling hours
    const now = new Date()
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: CALLING_HOURS.timezone }))
    const currentHour = estTime.getHours()

    if (currentHour < CALLING_HOURS.start || currentHour >= CALLING_HOURS.end) {
      console.log(`[Cron] Outside calling hours (${CALLING_HOURS.start}-${CALLING_HOURS.end})`)
      return NextResponse.json({ message: 'Outside calling hours', hour: currentHour })
    }

    // IMPORTANT: Process stuck calls FIRST (before checking in_progress)
    // This fixes the bug where stuck calls would block all future calls forever
    // OPTIMIZED: Quick processing to avoid timeout - just sync status from call_logs
    // FIX: Increased timeout to 10 minutes and include all valid outcomes
    const stuckCalls = await sql`
      SELECT
        sc.id,
        sc.phone,
        (SELECT cl.outcome FROM call_logs cl
         WHERE cl.scheduled_call_id = sc.id
         AND cl.outcome IS NOT NULL
         ORDER BY cl.created_at DESC LIMIT 1) as existing_outcome,
        (SELECT cl.conversation_id FROM call_logs cl
         WHERE cl.scheduled_call_id = sc.id
         ORDER BY cl.created_at DESC LIMIT 1) as conversation_id
      FROM scheduled_calls sc
      WHERE sc.status = 'calling'
      AND sc.updated_at < NOW() - INTERVAL '10 minutes'
      LIMIT 10
    `

    // Process stuck calls - verify with ElevenLabs API if no call_log exists
    for (const stuckCall of stuckCalls) {
      if (stuckCall.existing_outcome) {
        // Already processed by webhook - just sync status
        console.log(`[Cron] Syncing stuck call ${stuckCall.phone} to ${stuckCall.existing_outcome}`)
        await sql`
          UPDATE scheduled_calls
          SET status = ${stuckCall.existing_outcome}, updated_at = NOW()
          WHERE id = ${stuckCall.id}
        `
      } else if (stuckCall.conversation_id && process.env.ELEVENLABS_API_KEY) {
        // Try to verify call status via ElevenLabs API before marking as failed
        try {
          console.log(`[Cron] Checking ElevenLabs API for conversation ${stuckCall.conversation_id}`)
          const elevenLabsResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${stuckCall.conversation_id}`,
            {
              headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
            }
          )

          if (elevenLabsResponse.ok) {
            const data = await elevenLabsResponse.json()
            const callStatus = data.status || data.call_status
            const duration = data.call_duration_secs || data.metadata?.call_duration_secs || 0

            // If call has ended with any status, mark appropriately
            if (callStatus === 'done' || callStatus === 'ended' || callStatus === 'completed' || duration > 0) {
              console.log(`[Cron] ElevenLabs confirms call completed for ${stuckCall.phone}, duration: ${duration}s`)
              await sql`
                UPDATE scheduled_calls
                SET status = 'answered', updated_at = NOW()
                WHERE id = ${stuckCall.id}
              `
              continue
            }
          }
        } catch (err) {
          console.error(`[Cron] Error checking ElevenLabs API:`, err)
        }

        // If ElevenLabs check failed or no data, mark as failed
        console.log(`[Cron] Marking stuck call ${stuckCall.phone} as failed (ElevenLabs check inconclusive)`)
        await sql`
          UPDATE scheduled_calls
          SET status = 'failed', skipped_reason = 'Call stuck in calling state', updated_at = NOW()
          WHERE id = ${stuckCall.id}
        `
      } else {
        // No call log and no conversation_id - mark as failed
        console.log(`[Cron] Marking stuck call ${stuckCall.phone} as failed (no call log)`)
        await sql`
          UPDATE scheduled_calls
          SET status = 'failed', skipped_reason = 'Call stuck in calling state', updated_at = NOW()
          WHERE id = ${stuckCall.id}
        `
      }
    }

    if (stuckCalls.length > 0) {
      console.log(`[Cron] Processed ${stuckCalls.length} stuck call(s)`)
    }

    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'

    // Check if any call is in progress (after cleanup)
    const inProgressResult = await sql`
      SELECT COUNT(*) as count FROM scheduled_calls WHERE status IN ('in_progress', 'calling')
    `
    const inProgressCount = Number(inProgressResult[0]?.count || 0)

    if (inProgressCount > 0) {
      console.log('[Cron] Call already in progress, waiting')
      return NextResponse.json({ message: 'Call in progress, waiting', count: inProgressCount })
    }

    // Get next pending call
    const pendingCallResult = await sql`
      SELECT
        sc.id, sc.campaign_id as "campaignId", sc.phone, sc.name,
        sc.first_message as "firstMessage", sc.full_prompt as "fullPrompt",
        c.recording_disclosure as "recordingDisclosure"
      FROM scheduled_calls sc
      JOIN campaigns c ON sc.campaign_id = c.id
      WHERE sc.status = 'pending'
        AND sc.scheduled_at <= NOW()
        AND c.status = 'active'
      ORDER BY c.priority DESC, sc.scheduled_at ASC
      LIMIT 1
    `

    if (pendingCallResult.length === 0) {
      console.log('[Cron] No pending calls')
      return NextResponse.json({ message: 'No pending calls' })
    }

    const call = pendingCallResult[0]
    console.log(`[Cron] Found call to process: ${call.id}, phone: ${call.phone}`)

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
      console.log(`[Cron] Phone ${call.phone} is on DNC list, skipping`)
      await sql`
        UPDATE scheduled_calls SET status = 'dnc', skipped_reason = 'On DNC list'
        WHERE id = ${call.id}
      `
      return NextResponse.json({ message: 'Phone on DNC, skipped' })
    }

    // Mark call as in progress
    await sql`
      UPDATE scheduled_calls SET status = 'in_progress', updated_at = NOW() WHERE id = ${call.id}
    `

    // Prepare the first message with recording disclosure
    const firstMessageWithDisclosure = call.recordingDisclosure
      ? `${call.recordingDisclosure} ${call.firstMessage || ''}`
      : call.firstMessage || ''

    // Make the outbound call via our API
    const callResponse = await fetch(`${baseUrl}/api/outbound-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: call.phone,
        firstMessage: firstMessageWithDisclosure,
        fullPrompt: call.fullPrompt || '',
        scheduledCallId: call.id,
        campaignId: call.campaignId,
        contactName: call.name || ''
      })
    })

    const callResult = await callResponse.json()

    if (callResult.success) {
      console.log(`[Cron] Call initiated: ${callResult.callSid}`)
      return NextResponse.json({
        message: 'Call initiated',
        phone: call.phone,
        name: call.name,
        callSid: callResult.callSid
      })
    } else {
      console.error(`[Cron] Failed to initiate call: ${callResult.error}`)
      await sql`
        UPDATE scheduled_calls SET status = 'failed', skipped_reason = ${callResult.error || 'Unknown error'}
        WHERE id = ${call.id}
      `
      return NextResponse.json({ error: 'Failed to initiate call', details: callResult.error }, { status: 500 })
    }
  } catch (error) {
    console.error('[Cron] Error:', error)
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}
