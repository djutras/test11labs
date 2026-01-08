// app/api/campaigns/[id]/upload-csv/route.ts
// CSV upload endpoint for adding contacts to a campaign

import { NextResponse } from 'next/server'
import {
  getCampaignById,
  createClient,
  createScheduledCall,
  isPhoneOnDnc,
  getScheduledCallsByCampaign,
  initializeDatabase
} from '@/lib/db'
import { parseCsv, type CsvContact } from '@/lib/csv-parser'
import { calculateMultiDaySchedule } from '@/lib/scheduler'
import { replaceVariables } from '@/lib/variable-replacer'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/campaigns/[id]/upload-csv
export async function POST(request: Request, { params }: RouteParams) {
  try {
    // Initialize database tables
    await initializeDatabase()

    const { id: campaignId } = await params

    // Get campaign
    const campaign = await getCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Check if campaign is active
    if (campaign.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Campaign is not active' },
        { status: 400 }
      )
    }

    // Get CSV content from request
    const contentType = request.headers.get('content-type') || ''

    let csvContent: string

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file uploaded' },
          { status: 400 }
        )
      }

      // Validate file type
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        return NextResponse.json(
          { success: false, error: 'File must be a CSV' },
          { status: 400 }
        )
      }

      csvContent = await file.text()
    } else if (contentType.includes('application/json')) {
      // JSON body with CSV content
      const body = await request.json()
      csvContent = body.csvContent

      if (!csvContent) {
        return NextResponse.json(
          { success: false, error: 'No CSV content provided' },
          { status: 400 }
        )
      }
    } else {
      // Plain text CSV
      csvContent = await request.text()
    }

    // Parse CSV
    const parseResult = parseCsv(csvContent)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse CSV',
          errors: parseResult.errors
        },
        { status: 400 }
      )
    }

    // Get existing scheduled calls to check for duplicates in campaign
    const existingCalls = await getScheduledCallsByCampaign(campaignId)
    const existingPhones = new Set(existingCalls.map(c => c.phone))

    // Process contacts
    const results = {
      added: 0,
      skipped: 0,
      dncSkipped: 0,
      duplicateInCampaign: 0,
      errors: [] as string[],
      warnings: [...parseResult.warnings]
    }

    // Filter out contacts already in this campaign
    const newContacts: CsvContact[] = []
    for (const contact of parseResult.contacts) {
      if (existingPhones.has(contact.phone)) {
        results.duplicateInCampaign++
        results.warnings.push(`Phone ${contact.phone} already in campaign, skipping`)
      } else {
        newContacts.push(contact)
      }
    }

    // Check DNC for remaining contacts
    let contactsToSchedule: CsvContact[] = []
    for (const contact of newContacts) {
      const isOnDnc = await isPhoneOnDnc(contact.phone, campaignId)
      if (isOnDnc) {
        results.dncSkipped++
        results.warnings.push(`Phone ${contact.phone} is on DNC list, skipping`)
      } else {
        contactsToSchedule.push(contact)
      }
    }

    // Calculate multi-day schedule using campaign settings
    const callsPerDay = campaign.callsPerDayPerContact ?? 1
    const durationDays = campaign.campaignDurationDays ?? 5
    const contactCount = contactsToSchedule.length
    const totalCalls = contactCount * callsPerDay * durationDays

    results.warnings.push(
      `Campagne: ${contactCount} contacts × ${callsPerDay} appel(s)/jour × ${durationDays} jours = ${totalCalls} appels programmés.`
    )

    // Calculate scheduled times using multi-day scheduler
    const scheduleResults = calculateMultiDaySchedule({
      campaign,
      contactCount
    })

    // First, create all clients
    for (const contact of contactsToSchedule) {
      try {
        await createClient({
          name: contact.name || 'Unknown',
          phone: contact.phone,
          campaignId,
          isActive: true
        })
      } catch (err) {
        // Client may already exist, continue
      }
    }

    // Create scheduled calls based on multi-day schedule
    // Schedule results are ordered by: day -> callNumber -> contactIndex
    for (const scheduleItem of scheduleResults) {
      const contact = contactsToSchedule[scheduleItem.contactIndex]
      if (!contact) continue

      try {
        const contactData = { name: contact.name, phone: contact.phone, subject: contact.subject }
        const scheduledCall = await createScheduledCall({
          campaignId,
          clientId: undefined,
          phone: contact.phone,
          name: contact.name,
          firstMessage: replaceVariables(campaign.firstMessage, contactData) || undefined,
          fullPrompt: replaceVariables(campaign.fullPrompt, contactData) || undefined,
          scheduledAt: scheduleItem.scheduledTime.toISOString(),
          status: 'pending',
          retryCount: 0
        })

        if (scheduledCall) {
          results.added++
        } else {
          results.errors.push(`Failed to schedule call day ${scheduleItem.dayNumber} for ${contact.phone}`)
          results.skipped++
        }
      } catch (err) {
        results.errors.push(`Error processing day ${scheduleItem.dayNumber} call for ${contact.phone}: ${err}`)
        results.skipped++
      }
    }

    // Return results
    return NextResponse.json({
      success: true,
      results: {
        totalInCsv: parseResult.contacts.length,
        added: results.added,
        skipped: results.skipped,
        dncSkipped: results.dncSkipped,
        duplicateInCampaign: results.duplicateInCampaign,
        duplicatesInCsv: parseResult.duplicates.length
      },
      warnings: results.warnings.length > 0 ? results.warnings : undefined,
      errors: results.errors.length > 0 ? results.errors : undefined
    })
  } catch (error) {
    console.error('[API] Error uploading CSV:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process CSV upload' },
      { status: 500 }
    )
  }
}
