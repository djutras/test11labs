'use client'

import { useState, useEffect } from 'react'

export default function TestPage() {
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [claudeResponse, setClaudeResponse] = useState<string>('')
  const [userMessage, setUserMessage] = useState<string>("Bonjour, c'est quand la date limite pour les impôts?")
  const [origin, setOrigin] = useState<string>('')
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [fullPrompt, setFullPrompt] = useState<string>(`Tu es Nicolas, assistant virtuel de Compta I A.
Tu fais un appel sortant pour contacter un client.

RÈGLES:
- Sois professionnel et chaleureux
- Réponds en français québécois naturel
- Si question complexe, propose de transférer à un comptable
- Garde les réponses concises pour la conversation téléphonique`)
  const [firstMessage, setFirstMessage] = useState<string>("Bonjour! Ici Nicolas de Compta I A. Comment puis-je vous aider aujourd'hui?")
  const [callResult, setCallResult] = useState<any>(null)
  const [conversationId, setConversationId] = useState<string>('')
  const [conversationData, setConversationData] = useState<any>(null)
  const [callAudioUrl, setCallAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // Test 1: ElevenLabs TTS
  const testElevenLabs = async () => {
    setLoading(true)
    setStatus('Test ElevenLabs en cours...')
    setAudioUrl(null)

    try {
      const res = await fetch('/api/test-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: "Bonjour! Je suis l'assistant ComptaIA. Comment puis-je vous aider aujourd'hui?" 
        })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setStatus('✅ ElevenLabs OK! Audio généré.')
    } catch (err: any) {
      setStatus(`❌ Erreur ElevenLabs: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Test 2: Claude conversation
  const testClaude = async () => {
    setLoading(true)
    setStatus('Test Claude en cours...')
    setClaudeResponse('')

    try {
      const res = await fetch('/api/test-claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      setClaudeResponse(data.response)
      setStatus('✅ Claude OK!')
    } catch (err: any) {
      setStatus(`❌ Erreur Claude: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Test 3: Appel sortant ElevenLabs
  const makeOutboundCall = async () => {
    if (!phoneNumber) {
      setStatus('❌ Entrez un numéro de téléphone')
      return
    }

    setLoading(true)
    setStatus('📞 Initiation de l\'appel...')
    setCallResult(null)

    try {
      const res = await fetch('/api/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          firstMessage: firstMessage,
          fullPrompt: fullPrompt
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      setCallResult(data)
      if (data.conversation_id) {
        setConversationId(data.conversation_id)
      }
      setStatus('✅ Appel initié avec succès!')
    } catch (err: any) {
      setStatus(`❌ Erreur: ${err.message}`)
      setCallResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Récupérer le transcript de la conversation
  const getConversationDetails = async () => {
    if (!conversationId) {
      setStatus('❌ Pas de conversation ID')
      return
    }

    setLoading(true)
    setStatus('📝 Récupération du transcript...')

    try {
      const res = await fetch(`/api/conversation/${conversationId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      setConversationData(data)
      setStatus(`✅ Transcript récupéré (${data.status})`)
    } catch (err: any) {
      setStatus(`❌ Erreur: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Récupérer l'audio de la conversation
  const getConversationAudio = async () => {
    if (!conversationId) {
      setStatus('❌ Pas de conversation ID')
      return
    }

    setLoading(true)
    setStatus('🎧 Récupération de l\'enregistrement...')

    try {
      const res = await fetch(`/api/conversation/${conversationId}/audio`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setCallAudioUrl(url)
      setStatus('✅ Enregistrement récupéré!')
    } catch (err: any) {
      setStatus(`❌ Erreur: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Test 4: Claude + ElevenLabs ensemble
  const testFull = async () => {
    setLoading(true)
    setStatus('Test complet en cours...')
    setAudioUrl(null)
    setClaudeResponse('')

    try {
      // Étape 1: Claude répond
      setStatus('1/2 - Claude génère la réponse...')
      const claudeRes = await fetch('/api/test-claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })

      if (!claudeRes.ok) throw new Error(`Claude HTTP ${claudeRes.status}`)

      const claudeData = await claudeRes.json()
      setClaudeResponse(claudeData.response)

      // Étape 2: ElevenLabs convertit en voix
      setStatus('2/2 - ElevenLabs génère la voix...')
      const voiceRes = await fetch('/api/test-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: claudeData.response })
      })

      if (!voiceRes.ok) throw new Error(`ElevenLabs HTTP ${voiceRes.status}`)

      const blob = await voiceRes.blob()
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)

      setStatus('✅ Test complet réussi!')
    } catch (err: any) {
      setStatus(`❌ Erreur: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>🎙️ Test ElevenLabs + Claude</h1>
      
      <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <strong>Status:</strong> {status || 'Prêt'}
      </div>

      {/* Test 1: ElevenLabs seul */}
      <section style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>1. Test ElevenLabs (TTS)</h2>
        <p>Convertit un texte fixe en audio.</p>
        <button 
          onClick={testElevenLabs} 
          disabled={loading}
          style={{ padding: '10px 20px', cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? '⏳ En cours...' : '🔊 Tester ElevenLabs'}
        </button>
      </section>

      {/* Test 2: Claude seul */}
      <section style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>2. Test Claude (Conversation)</h2>
        <p>Envoie un message à Claude et reçoit une réponse.</p>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          rows={3}
          style={{ width: '100%', marginBottom: '10px', padding: '10px' }}
        />
        <button 
          onClick={testClaude} 
          disabled={loading}
          style={{ padding: '10px 20px', cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? '⏳ En cours...' : '💬 Tester Claude'}
        </button>
        
        {claudeResponse && (
          <div style={{ marginTop: '15px', padding: '15px', background: '#e8f5e9', borderRadius: '8px' }}>
            <strong>Réponse Claude:</strong>
            <p>{claudeResponse}</p>
          </div>
        )}
      </section>

      {/* Test 3: Appel Sortant */}
      <section style={{ marginBottom: '30px', padding: '20px', border: '2px solid #4caf50', borderRadius: '8px', background: '#e8f5e9' }}>
        <h2>3. 📞 Appel Sortant (ElevenLabs)</h2>
        <p>Faire un appel téléphonique avec l'agent IA ElevenLabs.</p>

        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Numéro à appeler:
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+15145551234"
          style={{ width: '100%', marginBottom: '15px', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Prompt système (instructions pour l'agent):
        </label>
        <textarea
          value={fullPrompt}
          onChange={(e) => setFullPrompt(e.target.value)}
          rows={6}
          style={{ width: '100%', marginBottom: '15px', padding: '10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'monospace' }}
        />

        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Premier message (ce que l'agent dira en premier):
        </label>
        <textarea
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          rows={3}
          style={{ width: '100%', marginBottom: '15px', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <button
          onClick={makeOutboundCall}
          disabled={loading}
          style={{
            padding: '12px 24px',
            cursor: loading ? 'wait' : 'pointer',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {loading ? '⏳ Appel en cours...' : '📞 Lancer l\'appel'}
        </button>

        <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
          L'agent ElevenLabs va appeler ce numéro et dire le premier message, puis continuer la conversation automatiquement.
        </p>

        {callResult && (
          <div style={{ marginTop: '15px', padding: '15px', background: callResult.error ? '#ffebee' : '#c8e6c9', borderRadius: '8px' }}>
            <strong>{callResult.error ? '❌ Erreur:' : '✅ Résultat:'}</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
              {JSON.stringify(callResult, null, 2)}
            </pre>
          </div>
        )}

        {/* Section Transcript et Audio */}
        <div style={{ marginTop: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px', border: '1px solid #90caf9' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>📊 Récupérer Transcript / Audio</h3>

          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Conversation ID:
          </label>
          <input
            type="text"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value)}
            placeholder="conv_xxxxx..."
            style={{ width: '100%', marginBottom: '15px', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
          />

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button
              onClick={getConversationDetails}
              disabled={loading || !conversationId}
              style={{
                padding: '8px 16px',
                cursor: (loading || !conversationId) ? 'not-allowed' : 'pointer',
                background: conversationId ? '#2196f3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              📝 Voir Transcript
            </button>
            <button
              onClick={getConversationAudio}
              disabled={loading || !conversationId}
              style={{
                padding: '8px 16px',
                cursor: (loading || !conversationId) ? 'not-allowed' : 'pointer',
                background: conversationId ? '#9c27b0' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              🎧 Télécharger Audio
            </button>
          </div>

          {/* Transcript */}
          {conversationData && (
            <div style={{ marginTop: '10px', padding: '10px', background: 'white', borderRadius: '4px' }}>
              <strong>Status: {conversationData.status}</strong>
              {conversationData.metadata && (
                <p style={{ fontSize: '12px', color: '#666' }}>
                  Durée: {conversationData.metadata.call_duration_secs}s
                </p>
              )}
              {conversationData.transcript && conversationData.transcript.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <strong>Transcript:</strong>
                  {conversationData.transcript.map((msg: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px',
                        margin: '5px 0',
                        background: msg.role === 'agent' ? '#e8f5e9' : '#fff3e0',
                        borderRadius: '4px',
                        borderLeft: `3px solid ${msg.role === 'agent' ? '#4caf50' : '#ff9800'}`
                      }}
                    >
                      <strong>{msg.role === 'agent' ? '🤖 Agent' : '👤 User'}:</strong> {msg.message}
                      <span style={{ fontSize: '10px', color: '#999', marginLeft: '10px' }}>
                        ({msg.time_in_call_secs}s)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Audio Player */}
          {callAudioUrl && (
            <div style={{ marginTop: '15px', padding: '10px', background: 'white', borderRadius: '4px' }}>
              <strong>🎧 Enregistrement de l'appel:</strong>
              <audio controls src={callAudioUrl} style={{ width: '100%', marginTop: '10px' }}>
                Votre navigateur ne supporte pas l'audio.
              </audio>
            </div>
          )}
        </div>
      </section>

      {/* Test 4: Claude + ElevenLabs */}
      <section style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff3e0' }}>
        <h2>4. Test Complet (Claude → ElevenLabs)</h2>
        <p>Claude répond, puis ElevenLabs convertit en voix.</p>
        <button 
          onClick={testFull} 
          disabled={loading}
          style={{ padding: '10px 20px', cursor: loading ? 'wait' : 'pointer', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {loading ? '⏳ En cours...' : '🚀 Test Complet'}
        </button>
      </section>

      {/* Audio Player */}
      {audioUrl && (
        <section style={{ padding: '20px', border: '2px solid #4caf50', borderRadius: '8px', background: '#e8f5e9' }}>
          <h2>🎧 Audio Généré</h2>
          <audio controls src={audioUrl} style={{ width: '100%' }}>
            Votre navigateur ne supporte pas l'audio.
          </audio>
        </section>
      )}

      {/* Info Twilio */}
      <section style={{ marginTop: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#f5f5f5' }}>
        <h2>4. Test Appels Twilio</h2>
        <p>Pour tester les appels entrants:</p>
        <ol>
          <li>Lance ngrok: <code>ngrok http 3000</code></li>
          <li>Configure le webhook Twilio: <code>https://xxx.ngrok.io/api/call</code></li>
          <li>Appelle ton numéro Twilio</li>
        </ol>
        <p><strong>Webhook URL:</strong> <code>{origin}/api/call</code></p>
      </section>
    </div>
  )
}
