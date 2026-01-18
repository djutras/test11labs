// app/api/generate-message/route.ts
// API endpoint to generate first_message or full_prompt using Gemini via OpenRouter

import { NextResponse } from 'next/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export async function POST(request: Request) {
  try {
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { type, context } = body

    if (!type || !['first_message', 'full_prompt'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "first_message" or "full_prompt"' },
        { status: 400 }
      )
    }

    const systemPrompt = type === 'first_message'
      ? `Tu es un expert en communication telephonique pour des entreprises de comptabilite.
Genere un premier message d'accueil pour un appel sortant.
Le message doit:
- Etre professionnel et chaleureux
- Etre en francais quebecois naturel
- Utiliser {{name}} comme placeholder pour le nom du contact
- Etre court (1-2 phrases maximum)
- Se presenter et demander comment aider

Contexte fourni par l'utilisateur: ${context || 'Appel de suivi client standard'}

Reponds UNIQUEMENT avec le message, sans explication ni formatage.`
      : `Tu es un expert en communication telephonique pour des entreprises de comptabilite.
Genere un prompt systeme complet pour un agent IA qui fait des appels sortants.
Le prompt doit:
- Definir le role de l'agent (Nicolas, assistant virtuel)
- Utiliser {{name}} comme placeholder pour le nom du contact
- Utiliser {{phone}} comme placeholder pour le numero
- Inclure des regles de comportement claires
- Etre en francais
- Couvrir: ton, langue, limites, gestion des questions complexes

Contexte fourni par l'utilisateur: ${context || 'Appels de suivi client pour cabinet comptable'}

Reponds UNIQUEMENT avec le prompt, sans explication ni formatage additionnel.`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Compta IA Campaign Manager'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          {
            role: 'user',
            content: systemPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API] OpenRouter error:', errorText)
      return NextResponse.json(
        { success: false, error: `OpenRouter error: ${errorText}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    const generatedMessage = data.choices?.[0]?.message?.content?.trim()

    if (!generatedMessage) {
      return NextResponse.json(
        { success: false, error: 'No message generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: generatedMessage
    })
  } catch (error) {
    console.error('[API] Error generating message:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate message' },
      { status: 500 }
    )
  }
}
