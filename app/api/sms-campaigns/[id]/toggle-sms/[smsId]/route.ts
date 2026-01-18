// app/api/sms-campaigns/[id]/toggle-sms/[smsId]/route.ts
// API endpoint for toggling SMS status between pending and paused

import { NextResponse } from 'next/server'
import {
  initializeDatabase,
  toggleSmsStatus
} from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string; smsId: string }>
}

// POST /api/sms-campaigns/[id]/toggle-sms/[smsId] - Toggle SMS status
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { smsId } = await params
    await initializeDatabase()

    const sms = await toggleSmsStatus(smsId)

    if (!sms) {
      return NextResponse.json(
        { success: false, error: 'SMS not found or cannot toggle status' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      sms
    })
  } catch (error) {
    console.error('[API] Error toggling SMS status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to toggle SMS status' },
      { status: 500 }
    )
  }
}
