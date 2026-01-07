'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { t, getDaysOfWeek } from '@/lib/translations'
import { LanguageSelector } from '@/components/LanguageSelector'

const DEFAULT_FIRST_MESSAGE = "Bonjour {{name}}! Ici Nicolas de Compta I A. Comment puis-je vous aider aujourd'hui?"

const DEFAULT_FULL_PROMPT = `Tu es Nicolas, assistant virtuel de Compta I A.
Tu fais un appel sortant pour contacter {{name}}.

REGLES:
- Sois professionnel et chaleureux
- Reponds en francais quebecois naturel
- Si question complexe, propose de transferer a un comptable
- Ne fais jamais de promesses sur des delais ou des prix
- Note les informations importantes pour le suivi`

export default function NewCampaignPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { language } = useLanguage()

  // Form state
  const [name, setName] = useState('')
  const [creatorEmail, setCreatorEmail] = useState('')
  const [callDays, setCallDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  const [callStartHour, setCallStartHour] = useState(9)
  const [callEndHour, setCallEndHour] = useState(19)
  const [priority, setPriority] = useState(1)
  const [voicemailAction, setVoicemailAction] = useState<'hangup' | 'leave_message' | 'retry'>('hangup')
  const [voicemailMessage, setVoicemailMessage] = useState('')
  const [recordingDisclosure, setRecordingDisclosure] = useState('This call may be recorded for quality purposes.')
  const [firstMessage, setFirstMessage] = useState(DEFAULT_FIRST_MESSAGE)
  const [fullPrompt, setFullPrompt] = useState(DEFAULT_FULL_PROMPT)
  const [generatingFirstMessage, setGeneratingFirstMessage] = useState(false)
  const [generatingFullPrompt, setGeneratingFullPrompt] = useState(false)

  useEffect(() => {
    const auth = localStorage.getItem('authenticated')
    if (auth !== 'true') {
      router.push('/login')
    } else {
      setIsAuthenticated(true)
    }
  }, [router])

  const toggleDay = (day: string) => {
    if (callDays.includes(day)) {
      setCallDays(callDays.filter(d => d !== day))
    } else {
      setCallDays([...callDays, day])
    }
  }

  const generateWithGemini = async (type: 'first_message' | 'full_prompt') => {
    const setGenerating = type === 'first_message' ? setGeneratingFirstMessage : setGeneratingFullPrompt
    const setMessage = type === 'first_message' ? setFirstMessage : setFullPrompt

    setGenerating(true)
    try {
      const response = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          context: name ? `Campagne: ${name}` : ''
        })
      })

      const data = await response.json()
      if (data.success && data.message) {
        setMessage(data.message)
      } else {
        setError(data.error || t('errorGenerateMessage', language))
      }
    } catch (err) {
      setError(t('errorGenerateMessage', language))
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!name.trim()) {
      setError(t('errorCampaignName', language))
      return
    }
    if (!creatorEmail.trim()) {
      setError(t('errorCreatorEmail', language))
      return
    }
    if (callDays.length === 0) {
      setError(t('errorCallDays', language))
      return
    }
    if (callStartHour >= callEndHour) {
      setError(t('errorCallHours', language))
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          creatorEmail: creatorEmail.trim(),
          callDays,
          callStartHour,
          callEndHour,
          timezone: 'America/Toronto',
          priority,
          voicemailAction,
          voicemailMessage: voicemailAction === 'leave_message' ? voicemailMessage : null,
          recordingDisclosure,
          firstMessage,
          fullPrompt
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/campaigns/${data.campaign.id}`)
      } else {
        setError(data.error || t('errorCreateCampaign', language))
      }
    } catch (err) {
      setError(t('errorCreateCampaign', language))
    } finally {
      setLoading(false)
    }
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">{t('loading', language)}</div>
      </div>
    )
  }

  const DAYS_OF_WEEK = getDaysOfWeek(language)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('createCampaignTitle', language)}</h1>
          <p className="text-gray-400 mt-1">{t('createCampaignSubtitle', language)}</p>
        </div>
        <div className="flex gap-4 items-center">
          <LanguageSelector />
          <Link
            href="/campaigns"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            {t('backToCampaigns', language)}
          </Link>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-gray-800 rounded-lg p-6 space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('campaignName', language)} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('campaignNamePlaceholder', language)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Creator Email */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('creatorEmail', language)} * ({t('creatorEmailDesc', language)})</label>
            <input
              type="email"
              value={creatorEmail}
              onChange={(e) => setCreatorEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* First Message */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('firstMessage', language)} ({t('firstMessageDesc', language)})</label>
            <textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder={t('firstMessagePlaceholder', language)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-gray-400 text-sm">
                {t('variables', language)}: <code className="bg-gray-700 px-1 rounded">{'{{name}}'}</code>, <code className="bg-gray-700 px-1 rounded">{'{{phone}}'}</code>, <code className="bg-gray-700 px-1 rounded">{'{{subject}}'}</code>
              </p>
              <button
                type="button"
                onClick={() => generateWithGemini('first_message')}
                disabled={generatingFirstMessage}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded text-sm transition flex items-center gap-2"
              >
                {generatingFirstMessage ? (
                  <>
                    <span className="animate-spin">&#9696;</span>
                    {t('generating', language)}
                  </>
                ) : (
                  <>
                    <span>&#10024;</span>
                    {t('generateWithGemini', language)}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Full Prompt */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('fullPrompt', language)} ({t('fullPromptDesc', language)})</label>
            <textarea
              value={fullPrompt}
              onChange={(e) => setFullPrompt(e.target.value)}
              placeholder={t('fullPromptPlaceholder', language)}
              rows={8}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-gray-400 text-sm">
                {t('variables', language)}: <code className="bg-gray-700 px-1 rounded">{'{{name}}'}</code>, <code className="bg-gray-700 px-1 rounded">{'{{phone}}'}</code>, <code className="bg-gray-700 px-1 rounded">{'{{subject}}'}</code>
              </p>
              <button
                type="button"
                onClick={() => generateWithGemini('full_prompt')}
                disabled={generatingFullPrompt}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded text-sm transition flex items-center gap-2"
              >
                {generatingFullPrompt ? (
                  <>
                    <span className="animate-spin">&#9696;</span>
                    {t('generating', language)}
                  </>
                ) : (
                  <>
                    <span>&#10024;</span>
                    {t('generateWithGemini', language)}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Call Days */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('callDays', language)} *</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  className={`px-4 py-2 rounded-lg transition ${
                    callDays.includes(day.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Call Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('startHour', language)}</label>
              <select
                value={callStartHour}
                onChange={(e) => setCallStartHour(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('endHour', language)}</label>
              <select
                value={callEndHour}
                onChange={(e) => setCallEndHour(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}:00</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-gray-400 text-sm -mt-4">{t('timezone', language)}: America/Toronto (EST/EDT)</p>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('priority', language)} (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
              className="w-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <p className="text-gray-400 text-sm mt-1">{t('priorityDesc', language)}</p>
          </div>

          {/* Voicemail Action */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('voicemailAction', language)}</label>
            <select
              value={voicemailAction}
              onChange={(e) => setVoicemailAction(e.target.value as 'hangup' | 'leave_message' | 'retry')}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="hangup">{t('voicemailHangup', language)}</option>
              <option value="leave_message">{t('voicemailLeaveMessage', language)}</option>
              <option value="retry">{t('voicemailRetry', language)}</option>
            </select>
          </div>

          {/* Voicemail Message (conditional) */}
          {voicemailAction === 'leave_message' && (
            <div>
              <label className="block text-sm font-medium mb-2">{t('voicemailMessage', language)}</label>
              <textarea
                value={voicemailMessage}
                onChange={(e) => setVoicemailMessage(e.target.value)}
                placeholder={t('voicemailMessagePlaceholder', language)}
                rows={3}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Recording Disclosure */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('recordingDisclosure', language)}</label>
            <textarea
              value={recordingDisclosure}
              onChange={(e) => setRecordingDisclosure(e.target.value)}
              placeholder={t('recordingDisclosurePlaceholder', language)}
              rows={2}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <p className="text-gray-400 text-sm mt-1">{t('recordingDisclosureDesc', language)}</p>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium transition"
          >
            {loading ? t('creating', language) : t('createCampaign', language)}
          </button>
          <Link
            href="/campaigns"
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
          >
            {t('cancel', language)}
          </Link>
        </div>
      </form>
    </div>
  )
}
