// app/api/outbound-call/route.ts
// Appel sortant via ElevenLabs Conversational AI

import { NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID
const ELEVENLABS_PHONE_NUMBER_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID

export async function POST(req: Request) {
  try {
    const { phoneNumber, firstMessage, fullPrompt } = await req.json()

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID || !ELEVENLABS_PHONE_NUMBER_ID) {
      return NextResponse.json({
        error: 'Missing ElevenLabs configuration',
        missing: {
          apiKey: !ELEVENLABS_API_KEY,
          agentId: !ELEVENLABS_AGENT_ID,
          phoneNumberId: !ELEVENLABS_PHONE_NUMBER_ID
        }
      }, { status: 500 })
    }

    console.log(`[ElevenLabs] Initiating outbound call to ${phoneNumber}`)

    // Prompt par défaut
    const defaultPrompt = `Tu es Nicolas, assistant virtuel de Compta I A.
Tu fais un appel sortant pour contacter un client.

RÈGLES:
- Sois professionnel et chaleureux
- Réponds en français québécois naturel
- Si question complexe, propose de transférer à un comptable
- Garde les réponses concises pour la conversation téléphonique`

    const defaultFirstMessage = "Bonjour! Ici Nicolas de Compta I A. Comment puis-je vous aider aujourd'hui?"

    // Appel API ElevenLabs pour initier l'appel (Twilio integration)
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/twilio/outbound-call`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          agent_id: ELEVENLABS_AGENT_ID,
          agent_phone_number_id: ELEVENLABS_PHONE_NUMBER_ID,
          to_number: phoneNumber,
          conversation_initiation_client_data: {
            dynamic_variables: {
              full_prompt: fullPrompt || defaultPrompt,
              first_message: firstMessage || defaultFirstMessage
            }
          }
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[ElevenLabs] Error: ${response.status} - ${errorText}`)
      return NextResponse.json({
        error: `ElevenLabs API error: ${response.status}`,
        details: errorText
      }, { status: response.status })
    }

    const data = await response.json()
    console.log(`[ElevenLabs] Call initiated:`, data)

    return NextResponse.json({
      success: true,
      message: `Appel initié vers ${phoneNumber}`,
      conversation_id: data.conversation_id,
      callSid: data.callSid
    })

  } catch (error: any) {
    console.error('[ElevenLabs] Exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET: Info sur la configuration
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    configured: {
      apiKey: !!ELEVENLABS_API_KEY,
      agentId: !!ELEVENLABS_AGENT_ID,
      phoneNumberId: !!ELEVENLABS_PHONE_NUMBER_ID
    },
    agentId: ELEVENLABS_AGENT_ID,
    phoneNumberId: ELEVENLABS_PHONE_NUMBER_ID
  })
}
