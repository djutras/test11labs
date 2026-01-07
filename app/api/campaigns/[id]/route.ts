// app/api/campaigns/[id]/route.ts
// Single campaign API - Get, Update, Delete

import { NextResponse } from 'next/server'
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  getScheduledCallsByCampaign,
  type Campaign
} from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/campaigns/[id] - Get a single campaign with stats and clients
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    const campaign = await getCampaignById(id)

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get campaign statistics
    const stats = await getCampaignStats(id)

    // Get scheduled calls for this campaign
    const scheduledCalls = await getScheduledCallsByCampaign(id)

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        stats,
        scheduledCalls
      }
    })
  } catch (error) {
    console.error('[API] Error getting campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get campaign' },
      { status: 500 }
    )
  }
}

// PATCH /api/campaigns/[id] - Update a campaign
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check if campaign exists
    const existingCampaign = await getCampaignById(id)
    if (!existingCampaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Validate call days if provided
    if (body.callDays) {
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      for (const day of body.callDays) {
        if (!validDays.includes(day.toLowerCase())) {
          return NextResponse.json(
            { success: false, error: `Invalid day: ${day}` },
            { status: 400 }
          )
        }
      }
      body.callDays = body.callDays.map((d: string) => d.toLowerCase())
    }

    // Validate hours if provided
    if (body.callStartHour !== undefined || body.callEndHour !== undefined) {
      const startHour = body.callStartHour ?? existingCampaign.callStartHour
      const endHour = body.callEndHour ?? existingCampaign.callEndHour

      if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
        return NextResponse.json(
          { success: false, error: 'Hours must be between 0 and 23' },
          { status: 400 }
        )
      }
      if (startHour >= endHour) {
        return NextResponse.json(
          { success: false, error: 'Start hour must be before end hour' },
          { status: 400 }
        )
      }
    }

    // Validate voicemail action if provided
    if (body.voicemailAction) {
      const validVoicemailActions = ['hangup', 'leave_message', 'retry']
      if (!validVoicemailActions.includes(body.voicemailAction)) {
        return NextResponse.json(
          { success: false, error: 'Invalid voicemail action' },
          { status: 400 }
        )
      }
    }

    // Validate status if provided
    if (body.status) {
      const validStatuses = ['active', 'paused', 'completed']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status' },
          { status: 400 }
        )
      }
    }

    const updates: Partial<Campaign> = {}
    if (body.name) updates.name = body.name
    if (body.callDays) updates.callDays = body.callDays
    if (body.callStartHour !== undefined) updates.callStartHour = body.callStartHour
    if (body.callEndHour !== undefined) updates.callEndHour = body.callEndHour
    if (body.priority !== undefined) updates.priority = body.priority
    if (body.voicemailAction) updates.voicemailAction = body.voicemailAction
    if (body.voicemailMessage !== undefined) updates.voicemailMessage = body.voicemailMessage
    if (body.recordingDisclosure) updates.recordingDisclosure = body.recordingDisclosure
    if (body.status) updates.status = body.status

    const campaign = await updateCampaign(id, updates)

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Failed to update campaign' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign
    })
  } catch (error) {
    console.error('[API] Error updating campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update campaign' },
      { status: 500 }
    )
  }
}

// DELETE /api/campaigns/[id] - Delete a campaign
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    // Check if campaign exists
    const existingCampaign = await getCampaignById(id)
    if (!existingCampaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    const deleted = await deleteCampaign(id)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete campaign' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully'
    })
  } catch (error) {
    console.error('[API] Error deleting campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}
