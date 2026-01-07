// app/api/audio/[conversationId]/route.ts
// Proxy endpoint to fetch audio from ElevenLabs with API key

import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ conversationId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { conversationId } = await params

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    // Fetch audio from ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Audio Proxy] ElevenLabs error: ${response.status} - ${errorText}`)
      return NextResponse.json(
        { error: `Failed to fetch audio: ${response.status}` },
        { status: response.status }
      )
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer()

    // Return the audio with proper headers
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('[Audio Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audio' },
      { status: 500 }
    )
  }
}
