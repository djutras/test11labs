// app/api/cron/recover-calls/route.ts
// Recovery job for calls that completed but missed webhook processing
// Runs every 15 minutes, finds calls with conversation_id but no transcript/email

import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  // Optional auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[RecoverCalls] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[RecoverCalls] Starting recovery job...')

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 })
    }

    const sql = neon(process.env.DATABASE_URL)
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'

    // Find calls that need recovery:
    // 1. Calls with conversation_id but missing transcript
    // 2. Calls with transcript + outcome='answered' but email_sent=false
    // Window: 10 minutes to 24 hours old (not too recent, not too old)
    const callsToRecover = await sql`
      SELECT
        sc.id,
        sc.campaign_id as "campaignId",
        sc.phone,
        sc.name,
        cl.id as "callLogId",
        cl.conversation_id as "conversationId",
        cl.transcript,
        cl.email_sent as "emailSent",
        cl.outcome
      FROM scheduled_calls sc
      JOIN call_logs cl ON cl.scheduled_call_id = sc.id
      WHERE cl.conversation_id IS NOT NULL
        AND (
          cl.transcript IS NULL
          OR (cl.transcript IS NOT NULL AND cl.email_sent = false AND cl.outcome = 'answered')
        )
        AND sc.updated_at < NOW() - INTERVAL '10 minutes'
        AND sc.updated_at > NOW() - INTERVAL '24 hours'
      ORDER BY sc.updated_at ASC
      LIMIT 5
    `

    if (callsToRecover.length === 0) {
      console.log('[RecoverCalls] No calls to recover')
      return NextResponse.json({ message: 'No calls to recover', recovered: 0 })
    }

    console.log(`[RecoverCalls] Found ${callsToRecover.length} call(s) to recover`)

    let recovered = 0
    const results: { phone: string; status: string }[] = []

    for (const call of callsToRecover) {
      try {
        console.log(`[RecoverCalls] Processing ${call.phone} (conversation: ${call.conversationId})`)

        // Call /api/calls/complete to do the heavy lifting
        const response = await fetch(`${baseUrl}/api/calls/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledCallId: call.id,
            campaignId: call.campaignId,
            conversationId: call.conversationId,
            callLogId: call.callLogId,
            phone: call.phone,
            clientName: call.name,
            outcome: 'answered' // Will be overridden by voicemail detection if needed
          })
        })

        const result = await response.json()
        console.log(`[RecoverCalls] Processed ${call.phone}: ${result.status || result.error || 'unknown'}`)

        results.push({ phone: call.phone, status: result.status || 'processed' })
        recovered++
      } catch (err) {
        console.error(`[RecoverCalls] Error processing ${call.phone}:`, err)
        results.push({ phone: call.phone, status: 'error' })
      }
    }

    console.log(`[RecoverCalls] Recovered ${recovered}/${callsToRecover.length} calls`)

    return NextResponse.json({
      message: `Recovered ${recovered} call(s)`,
      found: callsToRecover.length,
      results
    })
  } catch (error) {
    console.error('[RecoverCalls] Error:', error)
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}
