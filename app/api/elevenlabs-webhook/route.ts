// app/api/elevenlabs-webhook/route.ts
// Webhook endpoint for ElevenLabs conversation events

import { NextResponse } from 'next/server'
import {
  updateScheduledCall,
  createCallLog,
  getScheduledCallById
} from '@/lib/db'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// POST /api/elevenlabs-webhook
// Called by ElevenLabs when a conversation ends
export async function POST(request: Request) {
  try {
    // Get query params for metadata
    const url = new URL(request.url)
    const scheduledCallId = url.searchParams.get('scheduledCallId')
    const campaignId = url.searchParams.get('campaignId')

    // Parse webhook payload
    const body = await request.json()

    console.log('[ElevenLabs Webhook] Received:', JSON.stringify(body, null, 2))
    console.log('[ElevenLabs Webhook] scheduledCallId:', scheduledCallId)
    console.log('[ElevenLabs Webhook] campaignId:', campaignId)

    // Extract data from ElevenLabs webhook payload
    // The exact structure depends on ElevenLabs webhook format
    const conversationId = body.conversation_id || body.conversationId
    const callStatus = body.status || body.call_status
    const callDuration = body.duration || body.call_duration || 0

    // Map ElevenLabs status to our status
    let outcome: 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'invalid' | 'failed' = 'answered'
    if (callStatus === 'completed' || callStatus === 'ended') {
      outcome = 'answered'
    } else if (callStatus === 'no-answer' || callStatus === 'no_answer') {
      outcome = 'no_answer'
    } else if (callStatus === 'busy') {
      outcome = 'busy'
    } else if (callStatus === 'failed') {
      outcome = 'failed'
    }

    // Forward to our existing call complete logic
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'

    // Get phone number from scheduled call if available
    let phone = body.to_number || body.phone || ''
    if (scheduledCallId && !phone) {
      const scheduledCall = await getScheduledCallById(scheduledCallId)
      if (scheduledCall) {
        phone = scheduledCall.phone
      }
    }

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
        phone
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
