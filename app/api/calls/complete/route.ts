// app/api/calls/complete/route.ts
// Webhook called when a call ends - fetches transcript, sends email, updates status

import { NextResponse } from 'next/server'
import {
  updateScheduledCall,
  updateCallLog,
  getCallLogById,
  getCampaignById,
  getClientById,
  createCallLog
} from '@/lib/db'

// POST /api/calls/complete
// Called by Twilio/ElevenLabs when a call ends
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      scheduledCallId,
      campaignId,
      conversationId,
      callSid,
      duration,
      outcome, // 'answered', 'voicemail', 'no_answer', 'busy', 'invalid', 'failed'
      callLogId
    } = body

    console.log(`[CallComplete] Processing: scheduledCallId=${scheduledCallId}, outcome=${outcome}`)

    // Determine the final status based on outcome
    let finalStatus = outcome || 'completed'
    let shouldRetry = false

    switch (outcome) {
      case 'answered':
        finalStatus = 'answered'
        break
      case 'voicemail':
      case 'no_answer':
      case 'busy':
        // Check if we should retry (only retry once same day)
        shouldRetry = true
        finalStatus = outcome
        break
      case 'invalid':
        finalStatus = 'invalid'
        // Could add to DNC here
        break
      case 'failed':
        finalStatus = 'failed'
        shouldRetry = true
        break
      default:
        finalStatus = 'completed'
    }

    // Update scheduled call status
    if (scheduledCallId) {
      await updateScheduledCall(scheduledCallId, {
        status: finalStatus as any
      })
    }

    // Fetch transcript from ElevenLabs if we have a conversation ID
    let transcript = null
    let audioUrl = null

    if (conversationId) {
      try {
        // Fetch transcript
        const transcriptResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
          {
            headers: {
              'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
            }
          }
        )

        if (transcriptResponse.ok) {
          const transcriptData = await transcriptResponse.json()
          transcript = transcriptData.transcript || transcriptData
        }

        // Fetch audio URL
        audioUrl = `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`
      } catch (err) {
        console.error('[CallComplete] Error fetching transcript:', err)
      }
    }

    // Update or create call log
    if (callLogId) {
      await updateCallLog(callLogId, {
        duration,
        outcome: outcome as any,
        transcript: transcript || undefined,
        audioUrl: audioUrl || undefined
      })
    } else if (scheduledCallId && campaignId) {
      // Create a new call log if one doesn't exist
      await createCallLog({
        campaignId,
        scheduledCallId,
        conversationId,
        callSid,
        direction: 'outbound',
        phone: body.phone || '',
        duration,
        outcome: outcome as any,
        transcript: transcript || undefined,
        audioUrl: audioUrl || undefined,
        reviewStatus: 'pending',
        emailSent: false
      })
    }

    // Send email notification
    if (campaignId && outcome !== 'failed') {
      try {
        await sendEmailNotification({
          campaignId,
          phone: body.phone,
          clientName: body.clientName,
          outcome,
          duration,
          transcript,
          audioUrl,
          conversationId
        })
      } catch (err) {
        console.error('[CallComplete] Error sending email:', err)
      }
    }

    // If retry needed, schedule it
    if (shouldRetry && scheduledCallId) {
      // TODO: Implement retry scheduling
      // For now, just log it
      console.log(`[CallComplete] Would schedule retry for ${scheduledCallId}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Call completion processed',
      status: finalStatus
    })
  } catch (error) {
    console.error('[CallComplete] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process call completion' },
      { status: 500 }
    )
  }
}

// Helper function to send email notification
async function sendEmailNotification(params: {
  campaignId: string
  phone?: string
  clientName?: string
  outcome: string
  duration?: number
  transcript?: any
  audioUrl?: string | null
  conversationId?: string
}) {
  const campaign = await getCampaignById(params.campaignId)
  if (!campaign) return

  // Format transcript for email
  let transcriptText = 'No transcript available'
  if (Array.isArray(params.transcript)) {
    // Direct array format
    transcriptText = params.transcript
      .map((t: any) => `${t.role}: ${t.message}`)
      .join('\n')
  } else if (params.transcript?.transcript) {
    // Nested format (transcript.transcript)
    transcriptText = params.transcript.transcript
      .map((t: any) => `${t.role}: ${t.message}`)
      .join('\n')
  } else if (typeof params.transcript === 'string') {
    transcriptText = params.transcript
  }

  // Format duration
  const durationText = params.duration
    ? `${Math.floor(params.duration / 60)}m ${params.duration % 60}s`
    : 'Unknown'

  // Build email content
  const emailSubject = `[${campaign.name}] Call ${params.outcome}: ${params.clientName || params.phone}`
  const emailBody = `
Call Completed

Campaign: ${campaign.name}
Client: ${params.clientName || 'Unknown'}
Phone: ${params.phone || 'Unknown'}
Outcome: ${params.outcome}
Duration: ${durationText}

${params.audioUrl ? `Audio Recording: ${params.audioUrl}` : ''}

Transcript:
${transcriptText}

---
View in dashboard: ${process.env.URL || process.env.DEPLOY_URL}/campaigns/${params.campaignId}
`

  // Send email using SendGrid
  if (process.env.SENDGRID_API_KEY) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: campaign.creatorEmail }] }],
          from: { email: 'info@opportunitesparcourriel.com', name: 'Call Campaigns' },
          subject: emailSubject,
          content: [{ type: 'text/plain', value: emailBody }]
        })
      })

      if (response.ok || response.status === 202) {
        console.log(`[CallComplete] Email sent to ${campaign.creatorEmail}`)
      } else {
        console.error('[CallComplete] Email send failed:', await response.text())
      }
    } catch (err) {
      console.error('[CallComplete] Email error:', err)
    }
  } else {
    console.log('[CallComplete] SENDGRID_API_KEY not set, skipping email')
    console.log('[CallComplete] Would send email to:', campaign.creatorEmail)
    console.log('[CallComplete] Subject:', emailSubject)
  }
}
