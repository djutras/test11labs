# Test ElevenLabs + Claude + Twilio

Application de test pour intégrer la voix IA dans ComptaIA.

## Stack

- **Next.js 14** - Framework
- **Claude Sonnet 4.5** - IA conversationnelle
- **ElevenLabs** - Text-to-Speech
- **Twilio** - Appels téléphoniques

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Copier le fichier .env
copy .env.example .env.local

# 3. Remplir les variables dans .env.local
```

## Variables d'environnement

```env
# ElevenLabs
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here

# Anthropic
ANTHROPIC_API_KEY=your_key_here

# Twilio
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Trouver ton Voice ID ElevenLabs

1. Va sur [elevenlabs.io](https://elevenlabs.io)
2. Voices → Sélectionne une voix
3. Le Voice ID est dans l'URL: `elevenlabs.io/voice-lab/[VOICE_ID]`
4. Ou clique sur "ID" dans les settings de la voix

### Voix françaises recommandées

- **Charlotte** - Française, professionnelle
- **Thomas** - Français, masculin
- Ou crée une voix custom

## Lancer l'app

```bash
npm run dev
```

Ouvre http://localhost:3000

## Tests disponibles

### 1. Test ElevenLabs (TTS)

Convertit un texte fixe en audio. Vérifie que ton API key et Voice ID fonctionnent.

### 2. Test Claude

Envoie une question à Claude et reçoit une réponse textuelle.

### 3. Test Complet

1. Claude génère une réponse
2. ElevenLabs convertit en audio
3. Tu peux écouter le résultat

### 4. Test Appels Twilio

Pour tester les appels téléphoniques:

```bash
# 1. Installe ngrok si pas fait
npm install -g ngrok

# 2. Lance ngrok
ngrok http 3000

# 3. Copie l'URL https (ex: https://abc123.ngrok.io)

# 4. Configure dans Twilio Console:
#    - Phone Numbers → ton numéro
#    - Voice & Fax → "A Call Comes In"
#    - Webhook: https://abc123.ngrok.io/api/call
#    - HTTP POST

# 5. Appelle ton numéro Twilio!
```

## Flow d'un appel

```
📞 Utilisateur appelle
        ↓
   [Twilio reçoit]
        ↓
   POST /api/call
        ↓
   "Bonjour! Comment puis-je vous aider?"
        ↓
   [Utilisateur parle]
        ↓
   POST /api/call/handle-speech
        ↓
   [Claude génère réponse]
        ↓
   [Twilio TTS lit la réponse]
        ↓
   "Avez-vous une autre question?"
        ↓
   ... (boucle) ...
```

## Prochaines étapes

Une fois que les tests passent:

1. **Remplacer Twilio TTS par ElevenLabs** pour une voix plus naturelle
2. **Ajouter la mémoire de conversation** (context)
3. **Intégrer dans ComptaIA** avec les prompts complets

## Structure des fichiers

```
/test11labs
├── app/
│   ├── layout.tsx              # Layout de base
│   ├── page.tsx                # Page de test avec boutons
│   └── api/
│       ├── test-elevenlabs/
│       │   └── route.ts        # Test TTS ElevenLabs
│       ├── test-claude/
│       │   └── route.ts        # Test Claude conversation
│       └── call/
│           ├── route.ts        # Webhook appel entrant
│           └── handle-speech/
│               └── route.ts    # Traitement de la parole
├── .env.example
├── package.json
└── README.md
```

## Troubleshooting

### ElevenLabs: 401 Unauthorized
- Vérifie ton API key
- Vérifie que tu as des crédits

### ElevenLabs: Voice not found
- Vérifie le Voice ID (pas le nom, l'ID)
- Assure-toi que la voix est dans ta bibliothèque

### Twilio: Webhook timeout
- ngrok doit être actif
- L'URL dans Twilio doit être exacte
- Vérifie les logs dans la console

### Claude: 429 Rate limit
- Attends quelques secondes
- Vérifie ton plan API

## Coûts estimés

| Service | Test typique |
|---------|-------------|
| ElevenLabs | ~0.01$ par génération |
| Claude | ~0.01$ par conversation |
| Twilio | ~0.02$ par minute d'appel |

Pour les tests, ça devrait coûter < 1$.
