// app/api/call/route.ts
// Webhook Twilio pour appels entrants → ElevenLabs avec variables dynamiques

import { NextResponse } from 'next/server'
import { findClientByPhone } from '@/lib/db'

const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_4901kd1rcehff86917zw59fddfkv'
const FORWARD_PHONE_NUMBER = process.env.FORWARD_PHONE_NUMBER || '+15145640115'

// Twilio répond avec TwiML (XML)
function twiml(content: string): NextResponse {
  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// POST: Appel entrant initial
export async function POST(req: Request) {
  try {
    // Forward call to human - simple and fast
    const response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>${FORWARD_PHONE_NUMBER}</Dial>
</Response>`

    return twiml(response)

  } catch (error: any) {
    console.error('[Twilio] Error:', error)

    // Fallback en cas d'erreur - utiliser TTS Twilio basique
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-CA">
    Désolé, une erreur technique est survenue. Veuillez rappeler dans quelques instants.
  </Say>
  <Hangup/>
</Response>`)
  }
}

// GET: Pour tester que le webhook fonctionne
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Twilio webhook ready for ElevenLabs',
    agent_id: ELEVENLABS_AGENT_ID,
    features: {
      dynamicVariables: true,
      clientLookup: true,
      conversationRelay: true
    }
  })
}
