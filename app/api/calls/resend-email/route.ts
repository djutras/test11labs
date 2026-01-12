// app/api/calls/resend-email/route.ts
// Endpoint to resend email notification for a specific call log

import { NextResponse } from 'next/server'
import { getCallLogById, getCampaignById, getClientById, updateCallLog } from '@/lib/db'

// POST /api/calls/resend-email
// Body: { callLogId: string }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { callLogId } = body

    if (!callLogId) {
      return NextResponse.json(
        { error: 'callLogId is required' },
        { status: 400 }
      )
    }

    console.log(`[ResendEmail] Resending email for callLogId=${callLogId}`)

    // Get the call log
    const callLog = await getCallLogById(callLogId)
    if (!callLog) {
      return NextResponse.json(
        { error: 'Call log not found' },
        { status: 404 }
      )
    }

    // Get campaign info
    if (!callLog.campaignId) {
      return NextResponse.json(
        { error: 'Call log has no campaign associated' },
        { status: 400 }
      )
    }

    const campaign = await getCampaignById(callLog.campaignId)
    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get client name if available
    let clientName = 'Unknown'
    if (callLog.clientId) {
      const client = await getClientById(callLog.clientId)
      if (client) {
        clientName = client.name
      }
    }

    // Build audio URL
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'
    const audioUrl = callLog.conversationId
      ? `${baseUrl}/api/audio/${callLog.conversationId}`
      : null

    // Send the email
    const emailSent = await sendEmailNotification({
      campaignId: callLog.campaignId,
      phone: callLog.phone,
      clientName,
      outcome: callLog.outcome || 'unknown',
      duration: callLog.duration,
      transcript: callLog.transcript,
      audioUrl,
      conversationId: callLog.conversationId
    })

    if (emailSent) {
      // Update call log to mark email as sent
      await updateCallLog(callLogId, { emailSent: true })

      console.log(`[ResendEmail] Email resent successfully for callLogId=${callLogId}`)
      return NextResponse.json({
        success: true,
        message: 'Email resent successfully',
        recipient: campaign.creatorEmail
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[ResendEmail] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

// Helper function to send email notification (copied from complete/route.ts)
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
    transcriptText = params.transcript
      .map((t: any) => `${t.role}: ${t.message}`)
      .join('\n')
  } else if (params.transcript?.transcript) {
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
  const phoneForUrl = (params.phone || '').replace(/^\+/, '')
  const reactivateUrl = `${baseUrl}/api/campaigns/${params.campaignId}/reactivate-client/${phoneForUrl}`

  const emailSubject = `[${campaign.name}] Call ${params.outcome}: ${params.clientName || params.phone}`

  // Escape HTML in transcript
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
      console.log(`[ResendEmail] Sending email to ${campaign.creatorEmail}`)
      console.log(`[ResendEmail] Subject: ${emailSubject}`)

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
        console.log(`[ResendEmail] Email sent successfully to ${campaign.creatorEmail}`)
        return true
      } else {
        const errorText = await response.text()
        console.error(`[ResendEmail] Email send failed (${response.status}):`, errorText)
        return false
      }
    } catch (err) {
      console.error('[ResendEmail] Email error:', err)
      return false
    }
  } else {
    console.log('[ResendEmail] SENDGRID_API_KEY not set, skipping email')
    // In development, return true to simulate success
    if (process.env.NODE_ENV === 'development') {
      console.log('[ResendEmail] DEV MODE: Would send to', campaign.creatorEmail)
      return true
    }
    return false
  }
}
