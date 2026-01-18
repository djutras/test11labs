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
    const formData = await req.formData()
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const callSid = formData.get('CallSid') as string

    console.log(`[Twilio] Incoming call from ${from} to ${to} (SID: ${callSid})`)

    // Chercher le client dans la base de données
    const client = await findClientByPhone(from)

    // Générer les prompts dynamiques
    let fullPrompt: string
    let firstMessage: string

    if (client) {
      console.log(`[Twilio] Client found: ${client.name}`)

      fullPrompt = `Tu es Nicolas, assistant virtuel de Compta I A.
Tu parles à ${client.name}, client de ${client.accountant || 'Compta I A'}.
${client.lastInteraction ? `Contexte de la dernière interaction: ${client.lastInteraction}` : ''}

RÈGLES:
- Sois professionnel et chaleureux
- Réponds en français québécois naturel
- Si question complexe, propose de transférer à un comptable
- Garde les réponses concises pour la conversation téléphonique`

      firstMessage = `Bonjour ${client.name}! Ici Nicolas de Compta I A. Comment puis-je vous aider aujourd'hui?`
    } else {
      console.log(`[Twilio] New caller: ${from}`)

      fullPrompt = `Tu es Nicolas, assistant virtuel de Compta I A.
Un nouveau client appelle. Identifie ses besoins et collecte ses informations.

RÈGLES:
- Sois professionnel et accueillant
- Demande le nom du client
- Comprends ses besoins comptables
- Réponds en français québécois naturel
- Si question complexe, propose de transférer à un comptable`

      firstMessage = `Bonjour! Ici Nicolas de Compta I A. À qui ai-je le plaisir de parler?`
    }

    // Forward call to human instead of ElevenLabs AI
    const response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${to}">${FORWARD_PHONE_NUMBER}</Dial>
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
