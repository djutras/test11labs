// app/api/sms-campaigns/[id]/upload-csv/route.ts
// API endpoint for uploading CSV contacts to an SMS campaign

import { NextResponse } from 'next/server'
import {
  initializeDatabase,
  getSmsCampaignById,
  createScheduledSms
} from '@/lib/db'
import { calculateSmsSchedule } from '@/lib/sms-scheduler'
import { replaceSmsVariables } from '@/lib/twilio-sms'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface CsvContact {
  phone: string
  name?: string
}

// POST /api/sms-campaigns/[id]/upload-csv - Upload CSV contacts
export async function POST(request: Request, { params }: RouteParams) {
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

    const body = await request.json()
    const { contacts } = body as { contacts: CsvContact[] }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contacts provided' },
        { status: 400 }
      )
    }

    // Validate contacts have phone numbers
    const validContacts = contacts.filter(c => c.phone && c.phone.trim())
    if (validContacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid contacts with phone numbers found' },
        { status: 400 }
      )
    }

    // Calculate schedule for all contacts
    const schedule = calculateSmsSchedule({
      campaign,
      contactCount: validContacts.length
    })

    // Create scheduled SMS entries
    let created = 0
    let skipped = 0

    for (let i = 0; i < validContacts.length; i++) {
      const contact = validContacts[i]
      const scheduleEntry = schedule[i]

      if (!scheduleEntry) {
        skipped++
        continue
      }

      // Personalize message with contact variables
      const personalizedMessage = replaceSmsVariables(campaign.message, {
        name: contact.name,
        phone: contact.phone
      })

      const sms = await createScheduledSms({
        smsCampaignId: id,
        phone: contact.phone.trim(),
        name: contact.name?.trim(),
        message: personalizedMessage,
        scheduledAt: scheduleEntry.scheduledTime.toISOString(),
        status: 'pending'
      })

      if (sms) {
        created++
      } else {
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: validContacts.length
    })
  } catch (error) {
    console.error('[API] Error uploading CSV to SMS campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload contacts' },
      { status: 500 }
    )
  }
}
