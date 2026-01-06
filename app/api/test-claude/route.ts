// app/api/test-claude/route.ts
// Test Claude conversation pour ComptaIA via OpenRouter

import { NextResponse } from 'next/server'

// System prompt simplifié pour le test
const SYSTEM_PROMPT = `Tu es l'assistant vocal ComptaIA, un réceptionniste intelligent pour cabinets comptables au Québec.

RÈGLES IMPORTANTES POUR LA VOIX:
- Réponds de façon CONCISE (2-3 phrases max)
- Utilise un français québécois naturel
- Évite les listes et les formatages complexes
- Parle comme dans une vraie conversation téléphonique

CONNAISSANCES CLÉS:
- Date limite impôts particuliers: 30 avril (15 juin si travailleur autonome)
- TPS: 5%, TVQ: 9.975% (total 14.975%)
- REER 2025: max 32,490$ ou 18% du revenu
- Inscription taxes obligatoire si ventes > 30,000$/an

Si tu ne sais pas quelque chose, propose de transférer à un comptable.`

export async function POST(req: Request) {
  try {
    const { message } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    console.log(`[Claude] Received: "${message}"`)

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        max_tokens: 300,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Claude] OpenRouter error: ${response.status} - ${errorText}`)
      return NextResponse.json({ error: `OpenRouter error: ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    const claudeResponse = data.choices?.[0]?.message?.content || ''

    console.log(`[Claude] Response: "${claudeResponse}"`)
    console.log(`[Claude] Tokens: ${data.usage?.prompt_tokens} in, ${data.usage?.completion_tokens} out`)

    return NextResponse.json({
      response: claudeResponse,
      usage: data.usage
    })

  } catch (error: any) {
    console.error('[Claude] Exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
