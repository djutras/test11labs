// app/api/conversation/[id]/audio/route.ts
// Récupérer l'enregistrement audio d'une conversation

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

    console.log(`[ElevenLabs] Getting audio for conversation: ${conversationId}`)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
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

    // Retourner l'audio
    const audioBuffer = await response.arrayBuffer()

    console.log(`[ElevenLabs] Audio size: ${audioBuffer.byteLength} bytes`)

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    })

  } catch (error: any) {
    console.error('[ElevenLabs] Exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
