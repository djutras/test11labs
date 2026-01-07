// app/api/campaigns/[id]/client/[phone]/route.ts
// API to get all calls for a specific client (by phone) in a campaign

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string; phone: string }>
}

// GET /api/campaigns/[id]/client/[phone] - Get all calls for a client
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId, phone } = await params
    const decodedPhone = decodeURIComponent(phone)

    // Get all scheduled calls for this phone number in this campaign
    const scheduledCalls = await sql`
      SELECT
        sc.id,
        sc.name,
        sc.phone,
        sc.scheduled_at,
        sc.status,
        sc.retry_count,
        sc.created_at
      FROM scheduled_calls sc
      WHERE sc.campaign_id = ${campaignId}
        AND sc.phone = ${decodedPhone}
      ORDER BY sc.created_at DESC
    `

    if (scheduledCalls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Client not found in this campaign' },
        { status: 404 }
      )
    }

    // Get the client name from the first scheduled call
    const clientName = scheduledCalls[0].name || 'Unknown'

    // Get all call logs for these scheduled calls
    const scheduledCallIds = scheduledCalls.map(sc => sc.id)

    const callLogs = await sql`
      SELECT
        cl.id,
        cl.scheduled_call_id,
        cl.conversation_id,
        cl.duration,
        cl.outcome,
        cl.transcript,
        cl.audio_url,
        cl.created_at
      FROM call_logs cl
      WHERE cl.scheduled_call_id = ANY(${scheduledCallIds})
      ORDER BY cl.created_at DESC
    `

    // Create a map of scheduled call ID to call logs
    const callLogMap = new Map<string, any[]>()
    for (const log of callLogs) {
      const scId = log.scheduled_call_id
      if (!callLogMap.has(scId)) {
        callLogMap.set(scId, [])
      }
      callLogMap.get(scId)!.push({
        id: log.id,
        conversationId: log.conversation_id,
        duration: log.duration,
        outcome: log.outcome,
        transcript: log.transcript,
        audioUrl: log.audio_url,
        createdAt: log.created_at
      })
    }

    // Combine scheduled calls with their call logs
    const callHistory = scheduledCalls.map(sc => ({
      id: sc.id,
      scheduledAt: sc.scheduled_at,
      status: sc.status,
      retryCount: sc.retry_count,
      createdAt: sc.created_at,
      callLogs: callLogMap.get(sc.id) || []
    }))

    // Get campaign name
    const campaigns = await sql`
      SELECT name FROM campaigns WHERE id = ${campaignId}
    `
    const campaignName = campaigns[0]?.name || 'Unknown Campaign'

    return NextResponse.json({
      success: true,
      client: {
        name: clientName,
        phone: decodedPhone,
        campaignId,
        campaignName,
        totalCalls: callLogs.length,
        callHistory
      }
    })
  } catch (error) {
    console.error('[API] Error getting client history:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get client history' },
      { status: 500 }
    )
  }
}
