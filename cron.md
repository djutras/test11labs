# Plan: Cron Job Fallback pour les Webhooks ElevenLabs

## Objectif
Utiliser le cron job comme fallback pour traiter les appels "stuck" après 5 minutes si le webhook ElevenLabs ne se déclenche pas.

## Problème actuel
- Le cron détecte déjà les appels "stuck" après 5 minutes (status = 'calling')
- Mais il les marque simplement comme "failed"
- Il ne déclenche PAS le traitement complet (transcript, email, mise à jour DB)

## Solution
Modifier `netlify/functions/process-calls.ts` pour appeler `/api/calls/complete` au lieu de marquer directement comme "failed".

## Fichier à modifier
`netlify/functions/process-calls.ts` (lignes 83-129)

## Changements

### Code actuel (lignes 92-124):
Le cron query ElevenLabs pour le status mais ne fait que marquer "failed".

### Nouveau comportement:
1. Récupérer conversation_id, callLogId, phone, name des appels stuck
2. Query ElevenLabs pour déterminer le vrai outcome (answered vs failed)
3. Appeler `/api/calls/complete` avec toutes les infos
4. `/api/calls/complete` s'occupe du reste (transcript, email, DB)

### Code à ajouter après ligne 129:

```typescript
// Pour chaque appel stuck, appeler /api/calls/complete comme fallback
for (const stuckCall of stuckCalls) {
  let outcome = 'failed'
  let duration = 0

  // On a déjà queryé ElevenLabs plus haut, utiliser le status
  if (stuckCall.conversationId && process.env.ELEVENLABS_API_KEY) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${stuckCall.conversationId}`,
        { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
      )
      if (response.ok) {
        const data = await response.json()
        if (data.status === 'done' || data.call?.status === 'ended') {
          outcome = 'answered'
        }
        duration = data.metadata?.call_duration_secs || 0
      }
    } catch (err) {
      console.error('[ProcessCalls] Error querying ElevenLabs:', err)
    }
  }

  // Appeler /api/calls/complete comme fallback
  try {
    await fetch(`${baseUrl}/api/calls/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledCallId: stuckCall.id,
        campaignId: stuckCall.campaignId,
        conversationId: stuckCall.conversationId,
        duration,
        outcome,
        phone: stuckCall.phone,
        clientName: stuckCall.name
      })
    })
    console.log(`[ProcessCalls] Fallback processed: ${stuckCall.phone}`)
  } catch (err) {
    console.error('[ProcessCalls] Fallback error:', err)
  }
}
```

## Flux après modification

1. **Appel initié** -> status = 'calling'
2. **Cas normal**: Webhook ElevenLabs -> `/api/calls/complete`
3. **Cas fallback** (webhook rate):
   - Cron détecte après 5 min
   - Query ElevenLabs pour status
   - Appelle `/api/calls/complete`
   - Transcript + email envoyés

## Vérification
1. Désactiver temporairement le webhook ElevenLabs
2. Déclencher un appel test
3. Attendre 5+ minutes
4. Vérifier que le cron traite l'appel
5. Vérifier email reçu avec transcript
