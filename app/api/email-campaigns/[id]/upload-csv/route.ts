// app/api/email-campaigns/[id]/upload-csv/route.ts
// API endpoint for uploading CSV contacts to an email campaign

import { NextResponse } from 'next/server'
import {
  initializeDatabase,
  getEmailCampaignById,
  createScheduledEmail
} from '@/lib/db'
import { calculateEmailSchedule, replaceEmailVariables } from '@/lib/email-scheduler'
import { isValidEmail } from '@/lib/sendgrid'

interface CsvContact {
  email: string
  name?: string
  subject?: string
  phone?: string
}

// POST /api/email-campaigns/[id]/upload-csv - Upload contacts CSV
export async function POST(
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

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Read and parse CSV
    const csvText = await file.text()
    const contacts = parseCsv(csvText)

    if (contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid contacts found in CSV' },
        { status: 400 }
      )
    }

    // Filter valid emails
    const validContacts = contacts.filter(c => c.email && isValidEmail(c.email))
    const skippedCount = contacts.length - validContacts.length

    if (validContacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid email addresses found in CSV' },
        { status: 400 }
      )
    }

    // Calculate schedule for all contacts
    const schedule = calculateEmailSchedule({
      campaign,
      contactCount: validContacts.length
    })

    // Create scheduled emails
    let addedCount = 0
    const errors: string[] = []

    for (let i = 0; i < schedule.length; i++) {
      const scheduleItem = schedule[i]
      const contact = validContacts[scheduleItem.contactIndex]

      if (!contact) continue

      // Replace variables in subject and body
      const personalizedSubject = replaceEmailVariables(campaign.subject, {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        subject: contact.subject
      })

      const personalizedBody = replaceEmailVariables(campaign.body, {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        subject: contact.subject
      })

      try {
        await createScheduledEmail({
          emailCampaignId: id,
          email: contact.email,
          name: contact.name,
          subject: personalizedSubject,
          body: personalizedBody,
          scheduledAt: scheduleItem.scheduledTime.toISOString(),
          status: 'pending'
        })
        addedCount++
      } catch (error: any) {
        errors.push(`Failed to schedule email for ${contact.email}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      added: addedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully scheduled ${addedCount} emails`
    })
  } catch (error) {
    console.error('[API] Error uploading CSV:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process CSV file' },
      { status: 500 }
    )
  }
}

/**
 * Parse CSV text into contacts array
 */
function parseCsv(csvText: string): CsvContact[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return [] // Need header + at least one data row

  // Parse header
  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim())

  // Find column indices
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'courriel' || h === 'e-mail')
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'nom')
  const subjectIdx = headers.findIndex(h => h === 'subject' || h === 'sujet')
  const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'telephone' || h === 'téléphone')

  if (emailIdx === -1) {
    console.error('[CSV] No email column found in headers:', headers)
    return []
  }

  // Parse data rows
  const contacts: CsvContact[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue

    const email = values[emailIdx]?.trim()
    if (!email) continue

    contacts.push({
      email,
      name: nameIdx >= 0 ? values[nameIdx]?.trim() : undefined,
      subject: subjectIdx >= 0 ? values[subjectIdx]?.trim() : undefined,
      phone: phoneIdx >= 0 ? values[phoneIdx]?.trim() : undefined
    })
  }

  return contacts
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}
