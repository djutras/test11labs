// app/api/campaigns/[id]/pause-client/[phone]/route.ts
// Pause all pending calls for a specific client

import { NextResponse } from 'next/server'
import { getCampaignById } from '@/lib/db'
import { neon } from '@neondatabase/serverless'

// POST /api/campaigns/[campaignId]/pause-client/[phone]
// Pauses all pending calls for this client
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; phone: string }> }
) {
  try {
    const { id: campaignId, phone: encodedPhone } = await params
    const phone = decodeURIComponent(encodedPhone)

    // Get campaign info
    const campaign = await getCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Normalize phone to match with or without + prefix
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`
    const phoneWithoutPlus = phone.replace(/^\+/, '')

    // Create fresh DB connection
    const sql = neon(process.env.DATABASE_URL!)

    // Pause all pending calls for this phone
    const pausedCalls = await sql`
      UPDATE scheduled_calls
      SET status = 'paused',
          skipped_reason = 'Manually paused',
          updated_at = NOW()
      WHERE campaign_id = ${campaignId}
        AND (phone = ${normalizedPhone} OR phone = ${phoneWithoutPlus})
        AND status = 'pending'
      RETURNING id, name
    `

    if (pausedCalls.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending calls to pause',
        pausedCount: 0
      })
    }

    const clientName = pausedCalls[0]?.name || phone
    console.log(`[PauseClient] Paused ${pausedCalls.length} calls for ${clientName} (${phone}) in campaign ${campaignId}`)

    return NextResponse.json({
      success: true,
      message: `Paused ${pausedCalls.length} call(s) for ${clientName}`,
      pausedCount: pausedCalls.length,
      clientName
    })

  } catch (error) {
    console.error('[PauseClient] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to pause calls' },
      { status: 500 }
    )
  }
}
