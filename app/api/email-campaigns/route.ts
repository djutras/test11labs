// app/api/email-campaigns/route.ts
// API endpoints for listing and creating email campaigns

import { NextResponse } from 'next/server'
import {
  initializeDatabase,
  createEmailCampaign,
  getEmailCampaigns,
  getEmailCampaignStats
} from '@/lib/db'

// GET /api/email-campaigns - List all email campaigns with stats
export async function GET() {
  try {
    await initializeDatabase()
    const campaigns = await getEmailCampaigns()

    // Fetch stats for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const stats = await getEmailCampaignStats(campaign.id)
        return { ...campaign, stats }
      })
    )

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithStats
    })
  } catch (error) {
    console.error('[API] Error fetching email campaigns:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email campaigns' },
      { status: 500 }
    )
  }
}

// POST /api/email-campaigns - Create a new email campaign
export async function POST(request: Request) {
  try {
    await initializeDatabase()
    const body = await request.json()

    const {
      name,
      creatorEmail,
      subject,
      body: emailBody,
      sendDays,
      sendStartHour,
      sendEndHour,
      timezone,
      campaignDurationDays
    } = body

    // Validate required fields
    if (!name || !creatorEmail || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, creatorEmail, subject, body' },
        { status: 400 }
      )
    }

    if (!sendDays || sendDays.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one send day is required' },
        { status: 400 }
      )
    }

    const campaign = await createEmailCampaign({
      name,
      creatorEmail,
      subject,
      body: emailBody,
      sendDays: sendDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      sendStartHour: sendStartHour ?? 9,
      sendEndHour: sendEndHour ?? 17,
      timezone: timezone || 'America/Toronto',
      campaignDurationDays: campaignDurationDays ?? 5,
      status: 'active'
    })

    return NextResponse.json({
      success: true,
      campaign
    })
  } catch (error) {
    console.error('[API] Error creating email campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create email campaign' },
      { status: 500 }
    )
  }
}
