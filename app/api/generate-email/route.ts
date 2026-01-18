// app/api/generate-email/route.ts
// API endpoint to generate email subject or body using Claude via OpenRouter

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

    if (!type || !['email_subject', 'email_body'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "email_subject" or "email_body"' },
        { status: 400 }
      )
    }

    const systemPrompt = type === 'email_subject'
      ? `Tu es un expert en marketing par courriel pour des entreprises de comptabilite.
Genere un sujet de courriel accrocheur et professionnel.
Le sujet doit:
- Etre professionnel mais engageant
- Etre en francais quebecois naturel
- Utiliser {{name}} comme placeholder pour le nom du contact si pertinent
- Etre court (moins de 60 caracteres idealement)
- Inciter a ouvrir le courriel

Contexte fourni par l'utilisateur: ${context || 'Courriel de suivi client standard'}

Reponds UNIQUEMENT avec le sujet, sans explication ni formatage.`
      : `Tu es un expert en marketing par courriel pour des entreprises de comptabilite.
Genere le contenu HTML d'un courriel professionnel.
Le courriel doit:
- Etre professionnel et chaleureux
- Etre en francais quebecois naturel
- Utiliser {{name}} comme placeholder pour le nom du contact
- Utiliser {{phone}} comme placeholder pour le numero si pertinent
- Utiliser {{subject}} comme placeholder pour le sujet si pertinent
- Avoir une structure claire: salutation, corps, appel a l'action, signature
- Utiliser du HTML simple (p, br, strong, a) pour le formatage
- Inclure un appel a l'action clair

Contexte fourni par l'utilisateur: ${context || 'Courriel de suivi client pour cabinet comptable'}

Reponds UNIQUEMENT avec le contenu HTML du courriel, sans explication ni formatage additionnel.
Ne pas inclure les balises html, head, ou body - juste le contenu.`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Compta IA Email Campaign Manager'
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
        max_tokens: type === 'email_subject' ? 100 : 1000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API] OpenRouter error:', errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to generate email content' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const generatedContent = data.choices?.[0]?.message?.content?.trim()

    if (!generatedContent) {
      return NextResponse.json(
        { success: false, error: 'No content generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      content: generatedContent
    })
  } catch (error) {
    console.error('[API] Error generating email content:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate email content' },
      { status: 500 }
    )
  }
}
