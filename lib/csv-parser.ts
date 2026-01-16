// lib/csv-parser.ts
// CSV parsing utility for campaign contact uploads
// Note: first_message and full_prompt are now at the campaign level, not per-contact

export interface CsvContact {
  phone: string
  name?: string
  email?: string
  subject?: string
}

export interface ParseResult {
  success: boolean
  contacts: CsvContact[]
  errors: string[]
  warnings: string[]
  duplicates: string[]
}

/**
 * Parse CSV content into contacts
 * Expected columns: phone (required), name (optional)
 */
export function parseCsv(csvContent: string): ParseResult {
  const result: ParseResult = {
    success: true,
    contacts: [],
    errors: [],
    warnings: [],
    duplicates: []
  }

  // Split into lines and filter empty ones
  const lines = csvContent
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)

  if (lines.length === 0) {
    result.success = false
    result.errors.push('CSV file is empty')
    return result
  }

  // Parse header row
  const headerLine = lines[0]
  const headers = parseRow(headerLine).map(h => h.toLowerCase().trim())

  // Find column indexes
  const phoneIndex = headers.findIndex(h =>
    h === 'phone' || h === 'telephone' || h === 'tel' || h === 'phone_number' || h === 'phonenumber'
  )
  const nameIndex = headers.findIndex(h =>
    h === 'name' || h === 'nom' || h === 'client' || h === 'client_name' || h === 'clientname'
  )
  const emailIndex = headers.findIndex(h =>
    h === 'email' || h === 'courriel' || h === 'e-mail' || h === 'mail' || h === 'email_address'
  )
  const subjectIndex = headers.findIndex(h =>
    h === 'subject' || h === 'sujet' || h === 'reason' || h === 'raison' || h === 'topic'
  )

  if (phoneIndex === -1) {
    result.success = false
    result.errors.push('CSV must have a "phone" column')
    return result
  }

  // Track seen phones for duplicate detection
  const seenPhones = new Set<string>()

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    try {
      const values = parseRow(line)

      // Get phone number
      const rawPhone = values[phoneIndex]?.trim() || ''
      if (!rawPhone) {
        result.warnings.push(`Line ${lineNumber}: Missing phone number, skipping`)
        continue
      }

      // Normalize phone number
      const phone = normalizePhone(rawPhone)
      if (!phone) {
        result.warnings.push(`Line ${lineNumber}: Invalid phone number "${rawPhone}", skipping`)
        continue
      }

      // Check for duplicates
      if (seenPhones.has(phone)) {
        result.duplicates.push(phone)
        result.warnings.push(`Line ${lineNumber}: Duplicate phone "${phone}", skipping`)
        continue
      }
      seenPhones.add(phone)

      // Build contact object
      const contact: CsvContact = {
        phone,
        name: nameIndex >= 0 ? values[nameIndex]?.trim() || undefined : undefined,
        email: emailIndex >= 0 ? values[emailIndex]?.trim() || undefined : undefined,
        subject: subjectIndex >= 0 ? values[subjectIndex]?.trim() || undefined : undefined
      }

      result.contacts.push(contact)
    } catch (err) {
      result.warnings.push(`Line ${lineNumber}: Failed to parse, skipping`)
    }
  }

  if (result.contacts.length === 0) {
    result.success = false
    result.errors.push('No valid contacts found in CSV')
  }

  return result
}

/**
 * Parse a single CSV row, handling quoted values
 */
function parseRow(row: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    const nextChar = row[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++
      } else if (char === '"') {
        // End of quoted value
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        // Start of quoted value
        inQuotes = true
      } else if (char === ',' || char === ';') {
        // Field separator
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }

  // Add last value
  values.push(current)

  return values
}

/**
 * Normalize phone number to a consistent format
 * Returns null if invalid
 */
function normalizePhone(phone: string): string | null {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')

  // Handle various formats
  if (cleaned.startsWith('+1')) {
    cleaned = cleaned
  } else if (cleaned.startsWith('1') && cleaned.length === 11) {
    cleaned = '+' + cleaned
  } else if (cleaned.length === 10) {
    // Assume North American number
    cleaned = '+1' + cleaned
  } else if (cleaned.startsWith('+')) {
    // International number, keep as is
  } else {
    return null // Invalid format
  }

  // Validate length (E.164 format: 1-15 digits after +)
  const digits = cleaned.replace('+', '')
  if (digits.length < 10 || digits.length > 15) {
    return null
  }

  return cleaned
}

/**
 * Generate a sample CSV template
 */
export function generateCsvTemplate(): string {
  return `phone,name,email,subject
+15145551234,John Smith,john.smith@email.com,Tax return follow-up
+15145555678,Marie Tremblay,marie.tremblay@email.com,Invoice question
5145559012,Pierre Dubois,pierre.dubois@email.com,New client consultation`
}
