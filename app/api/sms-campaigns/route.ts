// app/api/sms-campaigns/route.ts
// API endpoints for listing and creating SMS campaigns

import { NextResponse } from 'next/server'
import {
  initializeDatabase,
  createSmsCampaign,
  getSmsCampaigns,
  getSmsCampaignStats
} from '@/lib/db'

// GET /api/sms-campaigns - List all SMS campaigns with stats
export async function GET() {
  try {
    await initializeDatabase()
    const campaigns = await getSmsCampaigns()

    // Fetch stats for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const stats = await getSmsCampaignStats(campaign.id)
        return { ...campaign, stats }
      })
    )

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithStats
    })
  } catch (error) {
    console.error('[API] Error fetching SMS campaigns:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SMS campaigns' },
      { status: 500 }
    )
  }
}

// POST /api/sms-campaigns - Create a new SMS campaign
export async function POST(request: Request) {
  try {
    await initializeDatabase()
    const body = await request.json()

    const {
      name,
      creatorEmail,
      message,
      sendDays,
      sendStartHour,
      sendEndHour,
      timezone,
      frequencyType,
      frequencyValue
    } = body

    // Validate required fields
    if (!name || !creatorEmail || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, creatorEmail, message' },
        { status: 400 }
      )
    }

    if (!sendDays || sendDays.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one send day is required' },
        { status: 400 }
      )
    }

    // Validate message length
    if (message.length > 1600) {
      return NextResponse.json(
        { success: false, error: 'SMS message exceeds maximum length (1600 characters)' },
        { status: 400 }
      )
    }

    // Validate frequency
    const validFrequencyType = frequencyType === 'monthly' ? 'monthly' : 'weekly'
    let validFrequencyValue = frequencyValue ?? 1

    if (validFrequencyType === 'weekly') {
      validFrequencyValue = Math.min(Math.max(1, validFrequencyValue), 4) // 1-4 weeks
    } else {
      validFrequencyValue = Math.min(Math.max(1, validFrequencyValue), 12) // 1-12 months
    }

    const campaign = await createSmsCampaign({
      name,
      creatorEmail,
      message,
      sendDays: sendDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      sendStartHour: sendStartHour ?? 9,
      sendEndHour: sendEndHour ?? 17,
      timezone: timezone || 'America/Toronto',
      frequencyType: validFrequencyType,
      frequencyValue: validFrequencyValue,
      status: 'active'
    })

    return NextResponse.json({
      success: true,
      campaign
    })
  } catch (error) {
    console.error('[API] Error creating SMS campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create SMS campaign' },
      { status: 500 }
    )
  }
}
