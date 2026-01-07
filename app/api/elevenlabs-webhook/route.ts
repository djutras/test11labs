// app/api/elevenlabs-webhook/route.ts
// Webhook endpoint for ElevenLabs conversation events

import { NextResponse } from 'next/server'
import {
  updateScheduledCall,
  getScheduledCallById,
  getCallLogByConversationId,
  updateCallLog
} from '@/lib/db'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// POST /api/elevenlabs-webhook
// Called by ElevenLabs when a conversation ends
export async function POST(request: Request) {
  try {
    // Get query params for metadata (may not be present since this is a global webhook)
    const url = new URL(request.url)
    let scheduledCallId = url.searchParams.get('scheduledCallId')
    let campaignId = url.searchParams.get('campaignId')

    // Parse webhook payload
    const body = await request.json()

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

    // Get phone number from scheduled call if still not available
    if (scheduledCallId && !phone) {
      const scheduledCall = await getScheduledCallById(scheduledCallId)
      if (scheduledCall) {
        phone = scheduledCall.phone
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
        callLogId
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
