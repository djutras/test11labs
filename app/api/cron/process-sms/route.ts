// app/api/cron/process-sms/route.ts
// Cron job to process pending SMS messages via Twilio

import { NextResponse } from 'next/server'
import {
  initializeDatabase,
  getPendingSmsToSend,
  updateScheduledSms,
  getSmsCampaignById
} from '@/lib/db'
import { sendSms } from '@/lib/twilio-sms'
import { isWithinSmsHours } from '@/lib/sms-scheduler'

// GET /api/cron/process-sms - Process pending SMS messages
export async function GET(request: Request) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  try {
    await initializeDatabase()

    // Get pending SMS (limit to prevent overwhelming Twilio)
    const pendingSms = await getPendingSmsToSend(10)

    if (pendingSms.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending SMS to process',
        processed: 0
      })
    }

    let sent = 0
    let failed = 0
    let skipped = 0

    for (const sms of pendingSms) {
      try {
        // Get campaign to check if within sending hours
        const campaign = await getSmsCampaignById(sms.smsCampaignId)
        if (!campaign) {
          console.log(`[SMS Cron] Campaign not found for SMS ${sms.id}, skipping`)
          skipped++
          continue
        }

        // Check if within sending hours
        if (!isWithinSmsHours(campaign)) {
          console.log(`[SMS Cron] Outside sending hours for campaign ${campaign.id}, skipping SMS ${sms.id}`)
          skipped++
          continue
        }

        // Send SMS via Twilio
        console.log(`[SMS Cron] Sending SMS ${sms.id} to ${sms.phone}...`)
        const result = await sendSms(sms.phone, sms.message)

        if (result.success) {
          await updateScheduledSms(sms.id, {
            status: 'sent',
            twilioSid: result.sid
          })
          sent++
          console.log(`[SMS Cron] SMS ${sms.id} sent successfully. SID: ${result.sid}`)
        } else {
          await updateScheduledSms(sms.id, {
            status: 'failed',
            errorMessage: result.error
          })
          failed++
          console.error(`[SMS Cron] SMS ${sms.id} failed: ${result.error}`)
        }

        // Small delay between SMS to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`[SMS Cron] Error processing SMS ${sms.id}:`, error)
        await updateScheduledSms(sms.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      processed: pendingSms.length,
      sent,
      failed,
      skipped
    })
  } catch (error) {
    console.error('[SMS Cron] Error processing SMS:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process SMS' },
      { status: 500 }
    )
  }
}
