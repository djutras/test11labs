// app/api/campaigns/route.ts
// Campaign CRUD API - List and Create

import { NextResponse } from 'next/server'
import {
  getCampaigns,
  createCampaign,
  getCampaignStats,
  initializeDatabase,
  type Campaign
} from '@/lib/db'

// GET /api/campaigns - List all campaigns with stats
export async function GET() {
  try {
    // Initialize database tables if needed
    await initializeDatabase()

    const campaigns = await getCampaigns()

    // Get stats for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const stats = await getCampaignStats(campaign.id)
        return {
          ...campaign,
          stats
        }
      })
    )

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithStats
    })
  } catch (error) {
    console.error('[API] Error getting campaigns:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get campaigns' },
      { status: 500 }
    )
  }
}

// POST /api/campaigns - Create a new campaign
export async function POST(request: Request) {
  try {
    // Initialize database tables if needed
    await initializeDatabase()

    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.creatorEmail) {
      return NextResponse.json(
        { success: false, error: 'Name and creator email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.creatorEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate call days
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const callDays = body.callDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    for (const day of callDays) {
      if (!validDays.includes(day.toLowerCase())) {
        return NextResponse.json(
          { success: false, error: `Invalid day: ${day}` },
          { status: 400 }
        )
      }
    }

    // Validate hours
    const callStartHour = body.callStartHour ?? 9
    const callEndHour = body.callEndHour ?? 19
    if (callStartHour < 0 || callStartHour > 23 || callEndHour < 0 || callEndHour > 23) {
      return NextResponse.json(
        { success: false, error: 'Hours must be between 0 and 23' },
        { status: 400 }
      )
    }
    if (callStartHour >= callEndHour) {
      return NextResponse.json(
        { success: false, error: 'Start hour must be before end hour' },
        { status: 400 }
      )
    }

    // Validate voicemail action
    const validVoicemailActions = ['hangup', 'leave_message', 'retry']
    const voicemailAction = body.voicemailAction || 'hangup'
    if (!validVoicemailActions.includes(voicemailAction)) {
      return NextResponse.json(
        { success: false, error: 'Invalid voicemail action' },
        { status: 400 }
      )
    }

    const campaignData: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'> = {
      name: body.name,
      creatorEmail: body.creatorEmail,
      callDays: callDays.map((d: string) => d.toLowerCase()),
      callStartHour,
      callEndHour,
      timezone: body.timezone || 'America/Toronto',
      priority: body.priority || 1,
      voicemailAction: voicemailAction as Campaign['voicemailAction'],
      voicemailMessage: body.voicemailMessage || null,
      recordingDisclosure: body.recordingDisclosure || 'This call may be recorded for quality purposes.',
      status: 'active'
    }

    const campaign = await createCampaign(campaignData)

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Failed to create campaign' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign
    }, { status: 201 })
  } catch (error) {
    console.error('[API] Error creating campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
