// app/api/campaigns/[id]/client/[phone]/future/route.ts
// API to get future scheduled calls for a specific client

import { NextResponse } from 'next/server'
import { getClientFutureCallsByPhone } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string; phone: string }>
}

// GET /api/campaigns/[id]/client/[phone]/future - Get future calls for a client
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId, phone } = await params
    const decodedPhone = decodeURIComponent(phone)

    const futureData = await getClientFutureCallsByPhone(campaignId, decodedPhone)

    if (!futureData) {
      return NextResponse.json(
        { success: false, error: 'Client not found in this campaign' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      client: {
        name: futureData.clientName,
        phone: futureData.phone,
        campaignId,
        campaignName: futureData.campaignName,
        totalFutureCalls: futureData.futureCalls.length,
        futureCalls: futureData.futureCalls
      }
    })
  } catch (error) {
    console.error('[API] Error getting future calls:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get future calls' },
      { status: 500 }
    )
  }
}
