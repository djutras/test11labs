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
    // Instead of just marking as failed, we do full processing via /api/calls/complete
    const stuckCalls = await sql`
      SELECT sc.id, sc.phone, sc.name, sc.campaign_id as "campaignId"
      FROM scheduled_calls sc
      WHERE sc.status = 'calling'
      AND sc.updated_at < NOW() - INTERVAL '5 minutes'
    `

    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'

    for (const stuckCall of stuckCalls) {
      // Check if there's already a successful call_log for this scheduled_call
      // This handles the race condition where webhook arrives after cron starts processing
      const existingSuccessLog = await sql`
        SELECT id, conversation_id, outcome, email_sent
        FROM call_logs
        WHERE scheduled_call_id = ${stuckCall.id}
        AND outcome IN ('answered', 'voicemail')
        AND conversation_id IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      `

      if (existingSuccessLog.length > 0) {
        // Already processed successfully by webhook - just update scheduled_call status
        const successLog = existingSuccessLog[0]
        console.log(`[Cron] Found existing successful call_log for ${stuckCall.phone}, outcome: ${successLog.outcome}`)
        await sql`
          UPDATE scheduled_calls
          SET status = ${successLog.outcome}, updated_at = NOW()
          WHERE id = ${stuckCall.id}
        `
        continue
      }

      // Get the most recent call_log (if any) to get conversation_id
      const recentLog = await sql`
        SELECT id, conversation_id
        FROM call_logs
        WHERE scheduled_call_id = ${stuckCall.id}
        ORDER BY created_at DESC
        LIMIT 1
      `
      const callLogId = recentLog[0]?.id
      const conversationId = recentLog[0]?.conversation_id

      let outcome: 'answered' | 'failed' = 'failed'
      let duration = 0

      // Query ElevenLabs API to get real status
      if (conversationId && process.env.ELEVENLABS_API_KEY) {
        try {
          const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
            { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
          )
          if (response.ok) {
            const data = await response.json()
            console.log(`[Cron] ElevenLabs status for ${conversationId}:`, data.status, data.call?.status)

            // Determine outcome based on ElevenLabs status
            if (data.status === 'done' || data.call?.status === 'ended') {
              outcome = 'answered'
            }
            duration = data.metadata?.call_duration_secs || data.call?.duration_secs || 0
          }
        } catch (err) {
          console.error('[Cron] Error querying ElevenLabs:', err)
        }
      }

      // Call /api/calls/complete for full processing (transcript, voicemail detection, email)
      try {
        console.log(`[Cron] Fallback processing for ${stuckCall.phone}`)
        const completeResponse = await fetch(`${baseUrl}/api/calls/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledCallId: stuckCall.id,
            campaignId: stuckCall.campaignId,
            conversationId,
            callLogId,
            duration,
            outcome,
            phone: stuckCall.phone,
            clientName: stuckCall.name
          })
        })
        const result = await completeResponse.json()
        console.log(`[Cron] Fallback processed: ${stuckCall.phone} - status: ${result.status}`)
      } catch (err) {
        console.error('[Cron] Fallback error:', err)
        // If fallback fails, mark as failed directly
        await sql`
          UPDATE scheduled_calls
          SET status = 'failed', skipped_reason = 'Fallback processing failed', updated_at = NOW()
          WHERE id = ${stuckCall.id}
        `
      }
    }

    if (stuckCalls.length > 0) {
      console.log(`[Cron] Processed ${stuckCalls.length} stuck call(s) via fallback`)
    }

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
