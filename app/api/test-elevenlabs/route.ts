// app/api/test-elevenlabs/route.ts
// Test ElevenLabs Text-to-Speech

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    const voiceId = process.env.ELEVENLABS_VOICE_ID

    if (!apiKey || !voiceId) {
      return NextResponse.json({ 
        error: 'Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID' 
      }, { status: 500 })
    }

    console.log(`[ElevenLabs] Generating speech for: "${text.substring(0, 50)}..."`)

    // Appel API ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2', // Supporte le français
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
          }
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[ElevenLabs] Error: ${response.status} - ${errorText}`)
      return NextResponse.json({ 
        error: `ElevenLabs API error: ${response.status}` 
      }, { status: response.status })
    }

    // Retourner l'audio
    const audioBuffer = await response.arrayBuffer()
    
    console.log(`[ElevenLabs] Success! Audio size: ${audioBuffer.byteLength} bytes`)

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
