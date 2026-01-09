// app/api/calls/complete/route.ts
// Webhook called when a call ends - fetches transcript, sends email, updates status

import { NextResponse } from 'next/server'
import {
  updateScheduledCall,
  updateCallLog,
  getCallLogById,
  getCampaignById,
  getClientById,
  createCallLog,
  getClientFutureCallsByPhone
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

        // Build audio URL through our proxy (to handle authentication)
        const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'
        audioUrl = `${baseUrl}/api/audio/${conversationId}`
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

    // Send email notification only if there were actual exchanges
    if (campaignId && outcome !== 'failed') {
      if (!hasValidTranscriptExchanges(transcript)) {
        console.log('[CallComplete] Skipping email - no valid transcript exchanges (no user response)')
      } else {
        try {
          const emailSent = await sendEmailNotification({
            campaignId,
            phone: body.phone,
            clientName: body.clientName,
            outcome,
            duration,
            transcript,
            audioUrl,
            conversationId
          })

          // Update email_sent flag in call_log
          if (emailSent && callLogId) {
            await updateCallLog(callLogId, { emailSent: true })
          }

          // Pause other pending calls for this prospect since we had a valid exchange
          if (emailSent && body.phone) {
            try {
              const futureData = await getClientFutureCallsByPhone(campaignId, body.phone)
              if (futureData?.futureCalls) {
                let pausedCount = 0
                for (const call of futureData.futureCalls) {
                  if (call.status === 'pending') {
                    await updateScheduledCall(call.id, {
                      status: 'paused',
                      skippedReason: 'Paused - email sent after successful exchange'
                    })
                    pausedCount++
                  }
                }
                if (pausedCount > 0) {
                  console.log(`[CallComplete] Paused ${pausedCount} pending calls for ${body.phone}`)
                }
              }
            } catch (pauseErr) {
              console.error('[CallComplete] Error pausing future calls:', pauseErr)
            }
          }
        } catch (err) {
          console.error('[CallComplete] Error sending email:', err)
        }
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

// Helper function to check if transcript has valid exchanges (user + agent messages)
function hasValidTranscriptExchanges(transcript: any): boolean {
  let messages: any[] = [];

  if (Array.isArray(transcript)) {
    messages = transcript;
  } else if (transcript?.transcript && Array.isArray(transcript.transcript)) {
    messages = transcript.transcript;
  }

  if (messages.length < 2) return false;

  const hasUserMessage = messages.some(t => t.role === 'user' && t.message?.trim());
  const hasAgentMessage = messages.some(t => t.role === 'agent' && t.message?.trim());

  return hasUserMessage && hasAgentMessage;
}

// Helper function to send email notification
// Returns true if email was sent successfully
async function sendEmailNotification(params: {
  campaignId: string
  phone?: string
  clientName?: string
  outcome: string
  duration?: number
  transcript?: any
  audioUrl?: string | null
  conversationId?: string
}): Promise<boolean> {
  const campaign = await getCampaignById(params.campaignId)
  if (!campaign) return false

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
  const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'
  const reactivateUrl = `${baseUrl}/api/campaigns/${params.campaignId}/reactivate-client/${encodeURIComponent(params.phone || '')}`

  const emailSubject = `[${campaign.name}] Call ${params.outcome}: ${params.clientName || params.phone}`

  // Escape HTML in transcript to prevent XSS
  const escapeHtml = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const safeTranscript = escapeHtml(transcriptText)

  const emailBodyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #1f2937;">Appel terminé</h2>

  <p><strong>Campagne:</strong> ${campaign.name}</p>
  <p><strong>Client:</strong> ${params.clientName || 'Unknown'}</p>
  <p><strong>Téléphone:</strong> ${params.phone || 'Unknown'}</p>
  <p><strong>Résultat:</strong> ${params.outcome}</p>
  <p><strong>Durée:</strong> ${durationText}</p>

  ${params.audioUrl ? `<p><a href="${params.audioUrl}" style="color: #2563eb; text-decoration: none;">🔊 Enregistrement Audio</a></p>` : ''}

  <h3 style="color: #1f2937;">Transcript:</h3>
  <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap; font-family: monospace; font-size: 14px;">${safeTranscript}</pre>

  <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">

  <p><a href="${reactivateUrl}" style="color: #2563eb; text-decoration: none;">🔄 Réactiver les appels pour ce client</a></p>
  <p><a href="${baseUrl}/campaigns/${params.campaignId}" style="color: #2563eb; text-decoration: none;">📊 Voir dans le dashboard</a></p>
</body>
</html>
`

  // Send email using SendGrid
  if (process.env.SENDGRID_API_KEY) {
    try {
      console.log(`[CallComplete] Sending email to ${campaign.creatorEmail}`)
      console.log(`[CallComplete] Subject: ${emailSubject}`)

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
          content: [{ type: 'text/html', value: emailBodyHtml }]
        })
      })

      if (response.ok || response.status === 202) {
        console.log(`[CallComplete] Email sent successfully to ${campaign.creatorEmail}`)
        return true
      } else {
        const errorText = await response.text()
        console.error(`[CallComplete] Email send failed (${response.status}):`, errorText)
        return false
      }
    } catch (err) {
      console.error('[CallComplete] Email error:', err)
      return false
    }
  } else {
    console.log('[CallComplete] SENDGRID_API_KEY not set, skipping email')
    console.log('[CallComplete] Would send email to:', campaign.creatorEmail)
    console.log('[CallComplete] Subject:', emailSubject)
    return false
  }
}
