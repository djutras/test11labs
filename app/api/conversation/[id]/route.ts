// app/api/conversation/[id]/route.ts
// Récupérer les détails d'une conversation (transcript)

import { NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
    }

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 })
    }

    console.log(`[ElevenLabs] Getting conversation: ${conversationId}`)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
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
    console.log(`[ElevenLabs] Conversation status: ${data.status}`)

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('[ElevenLabs] Exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
