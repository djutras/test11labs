// app/api/call/handle-speech/route.ts
// Traite ce que l'utilisateur a dit et répond via Claude

import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `Tu es l'assistant vocal ComptaIA au téléphone.

RÈGLES POUR APPEL TÉLÉPHONIQUE:
- Réponds en 1-2 phrases MAXIMUM (sera lu à voix haute)
- Sois direct et utile
- Français québécois naturel
- Si question complexe: "Je vous transfère à un comptable"

INFOS CLÉS:
- Impôts particuliers: 30 avril
- TPS 5%, TVQ 9.975%
- REER max: 32,490$`

function twiml(content: string): NextResponse {
  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const speechResult = formData.get('SpeechResult') as string
    const confidence = formData.get('Confidence') as string
    const callSid = formData.get('CallSid') as string

    console.log(`[Speech] Received: "${speechResult}" (confidence: ${confidence})`)

    if (!speechResult) {
      return twiml(`
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-CA">
    Je n'ai pas compris. Pouvez-vous répéter?
  </Say>
  <Gather input="speech" language="fr-CA" action="/api/call/handle-speech" method="POST" timeout="5">
    <Say voice="alice" language="fr-CA">Je vous écoute.</Say>
  </Gather>
</Response>`)
    }

    // Envoyer à Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 150, // Très court pour la voix
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: speechResult }
      ]
    })

    const claudeResponse = response.content[0].type === 'text' 
      ? response.content[0].text 
      : "Désolé, je n'ai pas pu traiter votre demande."

    console.log(`[Claude] Response: "${claudeResponse}"`)

    // Vérifier si l'utilisateur veut terminer
    const endKeywords = ['merci', 'au revoir', 'bye', 'terminé', 'fini']
    const wantsToEnd = endKeywords.some(kw => 
      speechResult.toLowerCase().includes(kw)
    )

    if (wantsToEnd) {
      return twiml(`
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-CA">
    ${claudeResponse}
    Merci d'avoir appelé ComptaIA. Bonne journée!
  </Say>
  <Hangup/>
</Response>`)
    }

    // Continuer la conversation
    return twiml(`
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-CA">
    ${claudeResponse}
  </Say>
  <Gather input="speech" language="fr-CA" action="/api/call/handle-speech" method="POST" timeout="5">
    <Say voice="alice" language="fr-CA">
      Avez-vous une autre question?
    </Say>
  </Gather>
  <Say voice="alice" language="fr-CA">
    Je n'ai pas entendu de réponse. Merci d'avoir appelé. Au revoir!
  </Say>
</Response>`)

  } catch (error: any) {
    console.error('[Speech] Error:', error)
    return twiml(`
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-CA">
    Désolé, une erreur est survenue. Merci de rappeler plus tard.
  </Say>
  <Hangup/>
</Response>`)
  }
}
