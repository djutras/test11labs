// app/api/campaigns/[id]/client/[phone]/route.ts
// API to get all calls for a specific client (by phone) in a campaign

import { NextResponse } from 'next/server'
import { getClientCallHistoryByPhone } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string; phone: string }>
}

// GET /api/campaigns/[id]/client/[phone] - Get all calls for a client
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId, phone } = await params
    const decodedPhone = decodeURIComponent(phone)

    const clientHistory = await getClientCallHistoryByPhone(campaignId, decodedPhone)

    if (!clientHistory) {
      return NextResponse.json(
        { success: false, error: 'Client not found in this campaign' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      client: {
        name: clientHistory.clientName,
        phone: clientHistory.phone,
        campaignId,
        campaignName: clientHistory.campaignName,
        totalCalls: clientHistory.callLogs.length,
        callHistory: clientHistory.scheduledCalls.map(sc => ({
          ...sc,
          callLogs: clientHistory.callLogs.filter(cl => cl.scheduledCallId === sc.id)
        }))
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
