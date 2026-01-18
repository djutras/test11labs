// lib/sendgrid.ts
// SendGrid email sending utility

import sgMail from '@sendgrid/mail'

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  fromEmail?: string
  fromName?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, body, fromEmail, fromName } = options

  if (!process.env.SENDGRID_API_KEY) {
    console.error('[SendGrid] API key not configured')
    return {
      success: false,
      error: 'SendGrid API key not configured'
    }
  }

  const senderEmail = fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@comptaia.ca'
  const senderName = fromName || process.env.SENDGRID_FROM_NAME || 'ComptaIA'

  const msg = {
    to,
    from: {
      email: senderEmail,
      name: senderName
    },
    subject,
    html: body,
    text: stripHtml(body) // Plain text version
  }

  try {
    console.log(`[SendGrid] Sending email to ${to}`)
    const response = await sgMail.send(msg)

    // SendGrid returns an array with response info
    const messageId = response[0]?.headers?.['x-message-id'] || 'unknown'

    console.log(`[SendGrid] Email sent successfully to ${to}, messageId: ${messageId}`)
    return {
      success: true,
      messageId
    }
  } catch (error: any) {
    console.error('[SendGrid] Error sending email:', error)

    // Extract error message from SendGrid response
    let errorMessage = 'Failed to send email'
    if (error.response?.body?.errors) {
      errorMessage = error.response.body.errors.map((e: any) => e.message).join(', ')
    } else if (error.message) {
      errorMessage = error.message
    }

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Send multiple emails in batch (with rate limiting)
 */
export async function sendEmailBatch(
  emails: SendEmailOptions[],
  delayMs: number = 100
): Promise<SendEmailResult[]> {
  const results: SendEmailResult[] = []

  for (const email of emails) {
    const result = await sendEmail(email)
    results.push(result)

    // Add small delay between emails to avoid rate limiting
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Strip HTML tags to create plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/**
 * Check if SendGrid is properly configured
 */
export function isSendGridConfigured(): boolean {
  return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL)
}
