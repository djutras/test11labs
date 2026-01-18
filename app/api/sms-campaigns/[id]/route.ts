// app/api/sms-campaigns/[id]/route.ts
// API endpoints for individual SMS campaign operations

import { NextResponse } from 'next/server'
import {
  initializeDatabase,
  getSmsCampaignById,
  updateSmsCampaign,
  deleteSmsCampaign,
  getSmsCampaignStats,
  getScheduledSmsByCampaign
} from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/sms-campaigns/[id] - Get SMS campaign details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    await initializeDatabase()

    const campaign = await getSmsCampaignById(id)
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'SMS campaign not found' },
        { status: 404 }
      )
    }

    const stats = await getSmsCampaignStats(id)
    const scheduledSms = await getScheduledSmsByCampaign(id)

    return NextResponse.json({
      success: true,
      campaign: { ...campaign, stats },
      scheduledSms
    })
  } catch (error) {
    console.error('[API] Error fetching SMS campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SMS campaign' },
      { status: 500 }
    )
  }
}

// PATCH /api/sms-campaigns/[id] - Update SMS campaign
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    await initializeDatabase()

    const body = await request.json()
    const { name, message, sendDays, sendStartHour, sendEndHour, frequencyType, frequencyValue, status } = body

    // Validate message length if provided
    if (message && message.length > 1600) {
      return NextResponse.json(
        { success: false, error: 'SMS message exceeds maximum length (1600 characters)' },
        { status: 400 }
      )
    }

    const campaign = await updateSmsCampaign(id, {
      name,
      message,
      sendDays,
      sendStartHour,
      sendEndHour,
      frequencyType,
      frequencyValue,
      status
    })

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'SMS campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign
    })
  } catch (error) {
    console.error('[API] Error updating SMS campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update SMS campaign' },
      { status: 500 }
    )
  }
}

// DELETE /api/sms-campaigns/[id] - Delete SMS campaign
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    await initializeDatabase()

    const success = await deleteSmsCampaign(id)
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete SMS campaign' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting SMS campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete SMS campaign' },
      { status: 500 }
    )
  }
}
