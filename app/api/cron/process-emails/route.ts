// app/api/cron/process-emails/route.ts
// Cron job to process and send scheduled emails

import { NextResponse } from 'next/server'
import {
  initializeDatabase,
  getPendingEmailsToSend,
  updateScheduledEmail
} from '@/lib/db'
import { sendEmail, isSendGridConfigured } from '@/lib/sendgrid'

// Maximum emails to process per cron run
const BATCH_SIZE = 10

// Delay between emails (ms) to avoid rate limiting
const DELAY_BETWEEN_EMAILS = 500

export async function GET(request: Request) {
  try {
    // Verify cron secret (optional, for security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron] Unauthorized access attempt')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if SendGrid is configured
    if (!isSendGridConfigured()) {
      console.log('[Cron] SendGrid not configured, skipping email processing')
      return NextResponse.json({
        success: true,
        message: 'SendGrid not configured',
        processed: 0,
        sent: 0,
        failed: 0
      })
    }

    await initializeDatabase()

    // Get pending emails that are due to be sent
    const pendingEmails = await getPendingEmailsToSend(BATCH_SIZE)

    if (pendingEmails.length === 0) {
      console.log('[Cron] No pending emails to process')
      return NextResponse.json({
        success: true,
        message: 'No pending emails',
        processed: 0,
        sent: 0,
        failed: 0
      })
    }

    console.log(`[Cron] Processing ${pendingEmails.length} emails`)

    let sentCount = 0
    let failedCount = 0
    const results: Array<{ email: string; status: 'sent' | 'failed'; error?: string }> = []

    for (const scheduledEmail of pendingEmails) {
      try {
        // Send the email
        const result = await sendEmail({
          to: scheduledEmail.email,
          subject: scheduledEmail.subject,
          body: scheduledEmail.body
        })

        if (result.success) {
          // Update status to sent
          await updateScheduledEmail(scheduledEmail.id, {
            status: 'sent',
            sentAt: new Date().toISOString()
          })
          sentCount++
          results.push({ email: scheduledEmail.email, status: 'sent' })
          console.log(`[Cron] Email sent successfully to ${scheduledEmail.email}`)
        } else {
          // Update status to failed with error message
          await updateScheduledEmail(scheduledEmail.id, {
            status: 'failed',
            errorMessage: result.error
          })
          failedCount++
          results.push({ email: scheduledEmail.email, status: 'failed', error: result.error })
          console.error(`[Cron] Failed to send email to ${scheduledEmail.email}: ${result.error}`)
        }
      } catch (error: any) {
        // Handle unexpected errors
        await updateScheduledEmail(scheduledEmail.id, {
          status: 'failed',
          errorMessage: error.message || 'Unknown error'
        })
        failedCount++
        results.push({ email: scheduledEmail.email, status: 'failed', error: error.message })
        console.error(`[Cron] Error processing email to ${scheduledEmail.email}:`, error)
      }

      // Delay between emails
      if (DELAY_BETWEEN_EMAILS > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS))
      }
    }

    console.log(`[Cron] Completed: ${sentCount} sent, ${failedCount} failed`)

    return NextResponse.json({
      success: true,
      message: `Processed ${pendingEmails.length} emails`,
      processed: pendingEmails.length,
      sent: sentCount,
      failed: failedCount,
      results
    })
  } catch (error) {
    console.error('[Cron] Error processing emails:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process emails' },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering
export async function POST(request: Request) {
  return GET(request)
}
