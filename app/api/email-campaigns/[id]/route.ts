// app/api/email-campaigns/[id]/route.ts
// API endpoints for individual email campaign operations

import { NextResponse } from 'next/server'
import {
  initializeDatabase,
  getEmailCampaignById,
  updateEmailCampaign,
  deleteEmailCampaign,
  getEmailCampaignStats,
  getScheduledEmailsByCampaign
} from '@/lib/db'

// GET /api/email-campaigns/[id] - Get campaign details with scheduled emails
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase()
    const { id } = await params

    const campaign = await getEmailCampaignById(id)
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    const stats = await getEmailCampaignStats(id)
    const scheduledEmails = await getScheduledEmailsByCampaign(id)

    return NextResponse.json({
      success: true,
      campaign: { ...campaign, stats },
      scheduledEmails
    })
  } catch (error) {
    console.error('[API] Error fetching email campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email campaign' },
      { status: 500 }
    )
  }
}

// PATCH /api/email-campaigns/[id] - Update campaign
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase()
    const { id } = await params
    const body = await request.json()

    const campaign = await getEmailCampaignById(id)
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    const updatedCampaign = await updateEmailCampaign(id, body)

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign
    })
  } catch (error) {
    console.error('[API] Error updating email campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update email campaign' },
      { status: 500 }
    )
  }
}

// DELETE /api/email-campaigns/[id] - Delete campaign
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase()
    const { id } = await params

    const campaign = await getEmailCampaignById(id)
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    await deleteEmailCampaign(id)

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully'
    })
  } catch (error) {
    console.error('[API] Error deleting email campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete email campaign' },
      { status: 500 }
    )
  }
}
