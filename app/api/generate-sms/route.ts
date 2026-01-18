// app/api/generate-sms/route.ts
// API endpoint to generate SMS content using Claude via OpenRouter

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
    const { context, language } = body

    const isFrench = language === 'fr'

    const systemPrompt = isFrench
      ? `Tu es un expert en marketing SMS pour des entreprises.
Genere un message SMS professionnel et engageant.
Le message doit:
- Etre professionnel mais chaleureux
- Etre en francais quebecois naturel
- Utiliser {{name}} comme placeholder pour le nom du contact si pertinent
- Etre TRES court (maximum 160 caracteres pour rester dans un seul SMS)
- Avoir un appel a l'action clair
- Ne pas utiliser d'emojis excessifs (1-2 maximum si pertinent)

Contexte fourni par l'utilisateur: ${context || 'Message de suivi client standard'}

IMPORTANT: Le message doit faire MOINS de 160 caracteres.
Reponds UNIQUEMENT avec le message SMS, sans explication ni formatage.`
      : `You are an expert in SMS marketing for businesses.
Generate a professional and engaging SMS message.
The message must:
- Be professional but warm
- Use {{name}} as a placeholder for the contact's name if relevant
- Be VERY short (maximum 160 characters to stay in a single SMS)
- Have a clear call to action
- Not use excessive emojis (1-2 maximum if relevant)

Context provided by user: ${context || 'Standard client follow-up message'}

IMPORTANT: The message must be LESS than 160 characters.
Reply ONLY with the SMS message, without explanation or formatting.`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'SMS Campaign Manager'
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
        max_tokens: 200
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API] OpenRouter error:', errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to generate SMS content' },
        { status: 500 }
      )
    }

    const data = await response.json()
    let generatedContent = data.choices?.[0]?.message?.content?.trim()

    if (!generatedContent) {
      return NextResponse.json(
        { success: false, error: 'No content generated' },
        { status: 500 }
      )
    }

    // Truncate to 160 chars if needed (shouldn't happen with good prompt)
    if (generatedContent.length > 160) {
      generatedContent = generatedContent.substring(0, 157) + '...'
    }

    return NextResponse.json({
      success: true,
      content: generatedContent,
      length: generatedContent.length
    })
  } catch (error) {
    console.error('[API] Error generating SMS content:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate SMS content' },
      { status: 500 }
    )
  }
}
