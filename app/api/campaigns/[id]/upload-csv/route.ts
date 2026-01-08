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
import { calculateScheduledTimes } from '@/lib/scheduler'
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

    // TEST MODE: Multiple calls per contact (wave-based scheduling)
    const isTestMode = campaign.mode === 'test'
    const callsPerContact = isTestMode ? 3 : 1  // 3 calls per contact in test mode
    const contactCount = contactsToSchedule.length
    const totalCalls = contactCount * callsPerContact

    if (isTestMode && callsPerContact > 1) {
      results.warnings.push(
        `Mode test: ${contactCount} contacts × ${callsPerContact} appels = ${totalCalls} appels programmés aux 10 minutes.`
      )
    }

    // Calculate scheduled times (wave-based in test mode)
    const scheduledTimes = calculateScheduledTimes({
      campaign,
      contactCount,
      callsPerContact
    })

    // Create clients and scheduled calls
    // In test mode with multiple calls: wave-based order
    // Wave 1: contact[0], contact[1], ... contact[N-1]
    // Wave 2: contact[0], contact[1], ... contact[N-1]
    // Wave 3: ...
    if (isTestMode && callsPerContact > 1) {
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

      // Then create calls wave by wave
      for (let wave = 0; wave < callsPerContact; wave++) {
        for (let i = 0; i < contactsToSchedule.length; i++) {
          const contact = contactsToSchedule[i]
          const timeIndex = wave * contactCount + i
          const scheduledAt = scheduledTimes[timeIndex]

          try {
            const contactData = { name: contact.name, phone: contact.phone, subject: contact.subject }
            const scheduledCall = await createScheduledCall({
              campaignId,
              clientId: undefined,
              phone: contact.phone,
              name: contact.name,
              firstMessage: replaceVariables(campaign.firstMessage, contactData) || undefined,
              fullPrompt: replaceVariables(campaign.fullPrompt, contactData) || undefined,
              scheduledAt: scheduledAt.toISOString(),
              status: 'pending',
              retryCount: 0
            })

            if (scheduledCall) {
              results.added++
            } else {
              results.errors.push(`Failed to schedule call ${wave + 1} for ${contact.phone}`)
              results.skipped++
            }
          } catch (err) {
            results.errors.push(`Error processing call ${wave + 1} for ${contact.phone}: ${err}`)
            results.skipped++
          }
        }
      }
    } else {
      // Production mode or single call: one call per contact
      for (let i = 0; i < contactsToSchedule.length; i++) {
        const contact = contactsToSchedule[i]
        const scheduledAt = scheduledTimes[i]

        try {
          // Create or update client
          const client = await createClient({
            name: contact.name || 'Unknown',
            phone: contact.phone,
            campaignId,
            isActive: true
          })

          if (!client) {
            results.errors.push(`Failed to create client for ${contact.phone}`)
            results.skipped++
            continue
          }

          // Create scheduled call with campaign messages (variables replaced with contact data)
          const contactData = { name: contact.name, phone: contact.phone, subject: contact.subject }
          const scheduledCall = await createScheduledCall({
            campaignId,
            clientId: undefined, // Omit to avoid FK constraint with old clients table
            phone: contact.phone,
            name: contact.name,
            firstMessage: replaceVariables(campaign.firstMessage, contactData) || undefined,
            fullPrompt: replaceVariables(campaign.fullPrompt, contactData) || undefined,
            scheduledAt: scheduledAt.toISOString(),
            status: 'pending',
            retryCount: 0
          })

          if (!scheduledCall) {
            results.errors.push(`Failed to schedule call for ${contact.phone}`)
            results.skipped++
            continue
          }

          results.added++
        } catch (err) {
          results.errors.push(`Error processing ${contact.phone}: ${err}`)
          results.skipped++
        }
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
