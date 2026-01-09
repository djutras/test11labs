// app/api/campaigns/[id]/client/[phone]/route.ts
// API to get/update calls for a specific client (by phone) in a campaign

import { NextResponse } from 'next/server'
import { getClientCallHistoryByPhone, getDb } from '@/lib/db'

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

// PATCH /api/campaigns/[id]/client/[phone] - Update client/prospect info
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId, phone } = await params
    const decodedPhone = decodeURIComponent(phone)
    const updates = await request.json()

    const db = getDb()

    // Update all scheduled_calls for this phone in this campaign
    const result = await db`
      UPDATE scheduled_calls
      SET
        name = COALESCE(${updates.name || null}, name),
        phone = COALESCE(${updates.newPhone || null}, phone),
        first_message = COALESCE(${updates.firstMessage || null}, first_message),
        full_prompt = COALESCE(${updates.fullPrompt || null}, full_prompt)
      WHERE campaign_id = ${campaignId} AND phone = ${decodedPhone}
      RETURNING id
    `

    // Also update call_logs phone if phone changed
    if (updates.newPhone && updates.newPhone !== decodedPhone) {
      await db`
        UPDATE call_logs
        SET phone = ${updates.newPhone}
        WHERE campaign_id = ${campaignId} AND phone = ${decodedPhone}
      `
    }

    return NextResponse.json({
      success: true,
      updatedCount: result.length,
      newPhone: updates.newPhone || decodedPhone
    })
  } catch (error) {
    console.error('[API] Error updating client:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update client' },
      { status: 500 }
    )
  }
}
