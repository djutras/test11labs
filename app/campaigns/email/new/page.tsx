'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { t, getDaysOfWeek } from '@/lib/translations'
import { LanguageSelector } from '@/components/LanguageSelector'

const DURATION_OPTIONS = [
  { value: 1, labelKey: 'duration1Day' },
  { value: 2, labelKey: 'duration2Days' },
  { value: 3, labelKey: 'duration3Days' },
  { value: 4, labelKey: 'duration4Days' },
  { value: 5, labelKey: 'duration5Days' },
  { value: 6, labelKey: 'duration6Days' },
  { value: 7, labelKey: 'duration7Days' },
  { value: 8, labelKey: 'duration8Days' },
  { value: 9, labelKey: 'duration9Days' },
  { value: 10, labelKey: 'duration10Days' },
  { value: 999, labelKey: 'durationContinuous' },
  { value: 28, labelKey: 'duration4Weeks' },
  { value: 84, labelKey: 'duration12Weeks' },
  { value: 168, labelKey: 'duration24Weeks' },
  { value: 336, labelKey: 'duration48Weeks' },
]

export default function NewEmailCampaignPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const daysOfWeek = getDaysOfWeek(language)

  const [formData, setFormData] = useState({
    name: '',
    creatorEmail: '',
    subject: '',
    body: '',
    sendDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    sendStartHour: 9,
    sendEndHour: 17,
    timezone: 'America/Toronto',
    campaignDurationDays: 5
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingSubject, setGeneratingSubject] = useState(false)
  const [generatingBody, setGeneratingBody] = useState(false)

  const handleDayToggle = (dayId: string) => {
    setFormData(prev => ({
      ...prev,
      sendDays: prev.sendDays.includes(dayId)
        ? prev.sendDays.filter(d => d !== dayId)
        : [...prev.sendDays, dayId]
    }))
  }

  const handleGenerateSubject = async () => {
    setGeneratingSubject(true)
    try {
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email_subject',
          context: formData.name || 'Campagne de suivi client'
        })
      })

      const data = await response.json()
      if (data.success) {
        setFormData(prev => ({ ...prev, subject: data.content }))
      } else {
        setError(data.error || t('errorGenerateEmail', language))
      }
    } catch (err) {
      setError(t('errorGenerateEmail', language))
    } finally {
      setGeneratingSubject(false)
    }
  }

  const handleGenerateBody = async () => {
    setGeneratingBody(true)
    try {
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email_body',
          context: formData.name || 'Campagne de suivi client'
        })
      })

      const data = await response.json()
      if (data.success) {
        setFormData(prev => ({ ...prev, body: data.content }))
      } else {
        setError(data.error || t('errorGenerateEmail', language))
      }
    } catch (err) {
      setError(t('errorGenerateEmail', language))
    } finally {
      setGeneratingBody(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation
    if (!formData.name) {
      setError(t('errorCampaignName', language))
      setLoading(false)
      return
    }
    if (!formData.creatorEmail) {
      setError(t('errorCreatorEmail', language))
      setLoading(false)
      return
    }
    if (!formData.subject) {
      setError(language === 'fr' ? 'Le sujet est requis' : 'Subject is required')
      setLoading(false)
      return
    }
    if (!formData.body) {
      setError(language === 'fr' ? 'Le corps du courriel est requis' : 'Email body is required')
      setLoading(false)
      return
    }
    if (formData.sendDays.length === 0) {
      setError(t('errorCallDays', language))
      setLoading(false)
      return
    }
    if (formData.sendStartHour >= formData.sendEndHour) {
      setError(t('errorCallHours', language))
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/campaigns/email/${data.campaign.id}`)
      } else {
        setError(data.error || t('errorCreateEmailCampaign', language))
      }
    } catch (err) {
      setError(t('errorCreateEmailCampaign', language))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('createEmailCampaignTitle', language)}</h1>
          <p className="text-gray-400 mt-1">{t('createEmailCampaignSubtitle', language)}</p>
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
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
        {/* Campaign Name */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('campaignName', language)} *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            placeholder={t('campaignNamePlaceholder', language)}
          />
        </div>

        {/* Creator Email */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('creatorEmail', language)} *
            <span className="text-gray-400 font-normal ml-2">({t('creatorEmailDesc', language)})</span>
          </label>
          <input
            type="email"
            value={formData.creatorEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, creatorEmail: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            placeholder="email@example.com"
          />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('emailSubject', language)} *
          </label>
          <div className="space-y-2">
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder={t('emailSubjectPlaceholder', language)}
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-400">
                {t('variables', language)}: {'{{name}}'}, {'{{phone}}'}, {'{{subject}}'}
              </p>
              <button
                type="button"
                onClick={handleGenerateSubject}
                disabled={generatingSubject}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-sm transition disabled:opacity-50"
              >
                {generatingSubject ? t('generating', language) : t('generateWithGemini', language)}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('emailBody', language)} *
            <span className="text-gray-400 font-normal ml-2">({t('emailBodyDesc', language)})</span>
          </label>
          <div className="space-y-2">
            <textarea
              value={formData.body}
              onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 min-h-[200px]"
              placeholder={t('emailBodyPlaceholder', language)}
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-400">
                {t('variables', language)}: {'{{name}}'}, {'{{phone}}'}, {'{{subject}}'}
              </p>
              <button
                type="button"
                onClick={handleGenerateBody}
                disabled={generatingBody}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-sm transition disabled:opacity-50"
              >
                {generatingBody ? t('generating', language) : t('generateWithGemini', language)}
              </button>
            </div>
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('campaignDuration', language)}
          </label>
          <select
            value={formData.campaignDurationDays}
            onChange={(e) => setFormData(prev => ({ ...prev, campaignDurationDays: parseInt(e.target.value) }))}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          >
            {DURATION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey as any, language)}
              </option>
            ))}
          </select>
        </div>

        {/* Send Days */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('sendDays', language)}
          </label>
          <div className="flex flex-wrap gap-2">
            {daysOfWeek.map(day => (
              <button
                key={day.id}
                type="button"
                onClick={() => handleDayToggle(day.id)}
                className={`px-4 py-2 rounded-lg transition ${
                  formData.sendDays.includes(day.id)
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Send Hours */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('sendStartHour', language)}
            </label>
            <select
              value={formData.sendStartHour}
              onChange={(e) => setFormData(prev => ({ ...prev, sendStartHour: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i}:00</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('sendEndHour', language)}
            </label>
            <select
              value={formData.sendEndHour}
              onChange={(e) => setFormData(prev => ({ ...prev, sendEndHour: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i}:00</option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? t('creating', language) : t('createCampaign', language)}
          </button>
        </div>
      </form>
    </div>
  )
}
