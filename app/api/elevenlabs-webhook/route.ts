// app/api/elevenlabs-webhook/route.ts
// Webhook endpoint for ElevenLabs conversation events

import { NextResponse } from 'next/server'
import {
  updateScheduledCall,
  getScheduledCallById,
  getCallLogByConversationId,
  updateCallLog
} from '@/lib/db'
import crypto from 'crypto'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET

// Verify HMAC signature from ElevenLabs
async function verifySignature(payload: string, signature: string | null): Promise<boolean> {
  if (!ELEVENLABS_WEBHOOK_SECRET) {
    console.log('[ElevenLabs Webhook] No webhook secret configured, skipping verification')
    return true // Skip verification if no secret is configured (for backward compatibility)
  }

  if (!signature) {
    console.log('[ElevenLabs Webhook] No signature header provided')
    return false
  }

  try {
    const hmac = crypto.createHmac('sha256', ELEVENLABS_WEBHOOK_SECRET)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')

    // ElevenLabs sends signature in format: "sha256=<hex>"
    const receivedSignature = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    )

    if (!isValid) {
      console.log('[ElevenLabs Webhook] Signature verification failed')
      console.log('[ElevenLabs Webhook] Expected:', expectedSignature.slice(0, 20) + '...')
      console.log('[ElevenLabs Webhook] Received:', receivedSignature.slice(0, 20) + '...')
    }

    return isValid
  } catch (err) {
    console.error('[ElevenLabs Webhook] Signature verification error:', err)
    return false
  }
}

// POST /api/elevenlabs-webhook
// Called by ElevenLabs when a conversation ends
export async function POST(request: Request) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()

    // Verify HMAC signature
    const signature = request.headers.get('elevenlabs-signature') || request.headers.get('x-elevenlabs-signature')
    const isValid = await verifySignature(rawBody, signature)

    if (!isValid && ELEVENLABS_WEBHOOK_SECRET) {
      console.log('[ElevenLabs Webhook] Invalid signature, rejecting request')
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse the body after verification
    const body = JSON.parse(rawBody)

    // Get query params for metadata (may not be present since this is a global webhook)
    const url = new URL(request.url)
    let scheduledCallId = url.searchParams.get('scheduledCallId')
    let campaignId = url.searchParams.get('campaignId')

    console.log('[ElevenLabs Webhook] Received:', JSON.stringify(body, null, 2))

    // Extract data from ElevenLabs webhook payload
    // ElevenLabs sends data nested under 'data' field for post_call_transcription type
    const webhookType = body.type
    const data = body.data || body

    const conversationId = data.conversation_id || data.conversationId || body.conversation_id || body.conversationId
    const callStatus = data.status || data.call_status || body.status || body.call_status
    const callDuration = data.call_duration_secs || data.duration || data.call_duration || body.duration || body.call_duration || 0

    console.log('[ElevenLabs Webhook] type:', webhookType)
    console.log('[ElevenLabs Webhook] conversationId:', conversationId)
    console.log('[ElevenLabs Webhook] callStatus:', callStatus)
    console.log('[ElevenLabs Webhook] callDuration:', callDuration)

    // If we don't have scheduledCallId/campaignId from query params,
    // look them up from the call_log using conversation_id
    let callLogId: string | undefined
    let phone = data.to_number || data.user_id || data.phone || body.to_number || body.phone || ''
    console.log('[ElevenLabs Webhook] phone:', phone)

    if (conversationId && (!scheduledCallId || !campaignId)) {
      const callLog = await getCallLogByConversationId(conversationId)
      if (callLog) {
        console.log('[ElevenLabs Webhook] Found call log:', callLog.id)
        callLogId = callLog.id
        scheduledCallId = scheduledCallId || callLog.scheduledCallId || null
        campaignId = campaignId || callLog.campaignId || null
        phone = phone || callLog.phone || ''
      }
    }

    console.log('[ElevenLabs Webhook] scheduledCallId:', scheduledCallId)
    console.log('[ElevenLabs Webhook] campaignId:', campaignId)

    // Map ElevenLabs status to our status
    let outcome: 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'invalid' | 'failed' = 'answered'
    if (callStatus === 'completed' || callStatus === 'ended' || callStatus === 'done') {
      outcome = 'answered'
    } else if (callStatus === 'no-answer' || callStatus === 'no_answer') {
      outcome = 'no_answer'
    } else if (callStatus === 'busy') {
      outcome = 'busy'
    } else if (callStatus === 'failed') {
      outcome = 'failed'
    }

    // Get phone number and client name from scheduled call
    let clientName: string | undefined
    if (scheduledCallId) {
      const scheduledCall = await getScheduledCallById(scheduledCallId)
      if (scheduledCall) {
        if (!phone) phone = scheduledCall.phone
        clientName = scheduledCall.name || undefined
      }
    }

    // Forward to our existing call complete logic
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'

    const completeResponse = await fetch(`${baseUrl}/api/calls/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledCallId,
        campaignId,
        conversationId,
        callSid: body.call_sid || body.callSid,
        duration: callDuration,
        outcome,
        phone,
        callLogId,
        clientName
      })
    })

    const result = await completeResponse.json()

    return NextResponse.json({
      success: true,
      message: 'Webhook processed',
      result
    })
  } catch (error) {
    console.error('[ElevenLabs Webhook] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

// GET endpoint to verify webhook is working
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'ElevenLabs webhook endpoint is active'
  })
}
