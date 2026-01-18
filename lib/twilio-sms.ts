// lib/twilio-sms.ts
// Twilio SMS sending utility

import Twilio from 'twilio'

interface SendSmsResult {
  success: boolean
  sid?: string
  error?: string
}

let twilioClient: Twilio.Twilio | null = null

function getTwilioClient(): Twilio.Twilio {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required')
    }

    twilioClient = Twilio(accountSid, authToken)
  }
  return twilioClient
}

/**
 * Send an SMS via Twilio
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  try {
    const client = getTwilioClient()
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!fromNumber) {
      return {
        success: false,
        error: 'TWILIO_PHONE_NUMBER is not configured'
      }
    }

    // Normalize phone number to E.164 format
    const normalizedTo = normalizePhoneNumber(to)

    console.log(`[Twilio SMS] Sending to ${normalizedTo}...`)

    const message = await client.messages.create({
      to: normalizedTo,
      from: fromNumber,
      body: body
    })

    console.log(`[Twilio SMS] Sent successfully. SID: ${message.sid}`)

    return {
      success: true,
      sid: message.sid
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Twilio SMS] Failed to send:`, errorMessage)

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Normalize phone number to E.164 format
 * Assumes North American numbers if no country code provided
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '')

  // If it starts with 1 and is 11 digits, it's already in good format
  if (digits.startsWith('1') && digits.length === 11) {
    return '+' + digits
  }

  // If it's 10 digits, add +1 (North America)
  if (digits.length === 10) {
    return '+1' + digits
  }

  // If it already has a + prefix, keep it
  if (phone.startsWith('+')) {
    return '+' + digits
  }

  // Otherwise, assume it needs +1
  return '+1' + digits
}

/**
 * Validate SMS message length
 * Standard SMS is 160 characters, but longer messages are split
 */
export function validateSmsLength(message: string): {
  valid: boolean
  length: number
  segments: number
  warning?: string
} {
  const length = message.length

  // Calculate number of segments
  // Single segment: up to 160 chars
  // Multi-segment: up to 153 chars per segment (7 chars for header)
  let segments: number
  if (length <= 160) {
    segments = 1
  } else {
    segments = Math.ceil(length / 153)
  }

  return {
    valid: length > 0 && length <= 1600, // Max 10 segments
    length,
    segments,
    warning: segments > 1 ? `Message will be split into ${segments} segments` : undefined
  }
}

/**
 * Replace template variables in SMS message
 */
export function replaceSmsVariables(
  template: string,
  variables: { name?: string; phone?: string }
): string {
  let result = template
  result = result.replace(/\{\{name\}\}/gi, variables.name || '')
  result = result.replace(/\{\{phone\}\}/gi, variables.phone || '')
  return result
}
