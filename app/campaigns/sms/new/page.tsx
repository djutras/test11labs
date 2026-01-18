'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { t, getDaysOfWeek } from '@/lib/translations'
import { LanguageSelector } from '@/components/LanguageSelector'

const WEEKLY_OPTIONS = [
  { value: 1, label: { en: '1 week', fr: '1 semaine' } },
  { value: 2, label: { en: '2 weeks', fr: '2 semaines' } },
  { value: 3, label: { en: '3 weeks', fr: '3 semaines' } },
  { value: 4, label: { en: '4 weeks', fr: '4 semaines' } },
]

const MONTHLY_OPTIONS = [
  { value: 1, label: { en: '1 month', fr: '1 mois' } },
  { value: 2, label: { en: '2 months', fr: '2 mois' } },
  { value: 3, label: { en: '3 months', fr: '3 mois' } },
  { value: 4, label: { en: '4 months', fr: '4 mois' } },
  { value: 5, label: { en: '5 months', fr: '5 mois' } },
  { value: 6, label: { en: '6 months', fr: '6 mois' } },
  { value: 7, label: { en: '7 months', fr: '7 mois' } },
  { value: 8, label: { en: '8 months', fr: '8 mois' } },
  { value: 9, label: { en: '9 months', fr: '9 mois' } },
  { value: 10, label: { en: '10 months', fr: '10 mois' } },
  { value: 11, label: { en: '11 months', fr: '11 mois' } },
  { value: 12, label: { en: '12 months', fr: '12 mois' } },
]

export default function NewSmsCampaignPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const daysOfWeek = getDaysOfWeek(language)

  const [formData, setFormData] = useState({
    name: '',
    creatorEmail: '',
    message: '',
    sendDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    sendStartHour: 9,
    sendEndHour: 17,
    timezone: 'America/Toronto',
    frequencyType: 'weekly' as 'weekly' | 'monthly',
    frequencyValue: 1
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const handleDayToggle = (dayId: string) => {
    setFormData(prev => ({
      ...prev,
      sendDays: prev.sendDays.includes(dayId)
        ? prev.sendDays.filter(d => d !== dayId)
        : [...prev.sendDays, dayId]
    }))
  }

  const handleFrequencyTypeChange = (type: 'weekly' | 'monthly') => {
    setFormData(prev => ({
      ...prev,
      frequencyType: type,
      frequencyValue: 1  // Reset to 1 when changing type
    }))
  }

  const handleGenerateMessage = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/generate-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: formData.name || 'Client follow-up message',
          language
        })
      })

      const data = await response.json()
      if (data.success) {
        setFormData(prev => ({ ...prev, message: data.content }))
      } else {
        setError(data.error || t('errorGenerateSms', language))
      }
    } catch (err) {
      setError(t('errorGenerateSms', language))
    } finally {
      setGenerating(false)
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
    if (!formData.message) {
      setError(language === 'fr' ? 'Le message SMS est requis' : 'SMS message is required')
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
      const response = await fetch('/api/sms-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/campaigns/sms/${data.campaign.id}`)
      } else {
        setError(data.error || t('errorCreateSmsCampaign', language))
      }
    } catch (err) {
      setError(t('errorCreateSmsCampaign', language))
    } finally {
      setLoading(false)
    }
  }

  const messageLength = formData.message.length
  const smsSegments = messageLength <= 160 ? 1 : Math.ceil(messageLength / 153)
  const remainingChars = 160 - messageLength

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('createSmsCampaignTitle', language)}</h1>
          <p className="text-gray-400 mt-1">{t('createSmsCampaignSubtitle', language)}</p>
        </div>
        <div className="flex gap-4 items-center">
          <LanguageSelector />
          <Link
            href="/campaigns/sms"
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
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
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
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
            placeholder="email@example.com"
          />
        </div>

        {/* SMS Message */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('smsMessage', language)} *
            <span className="text-gray-400 font-normal ml-2">({t('smsMessageDesc', language)})</span>
          </label>
          <div className="space-y-2">
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              className={`w-full px-4 py-2 bg-gray-800 border rounded-lg focus:outline-none focus:border-purple-500 min-h-[100px] ${
                messageLength > 160 ? 'border-yellow-500' : 'border-gray-700'
              }`}
              placeholder={t('smsMessagePlaceholder', language)}
              maxLength={1600}
            />
            <div className="flex justify-between items-center">
              <div className="flex gap-4">
                <p className="text-xs text-gray-400">
                  {t('variables', language)}: {'{{name}}'}
                </p>
                <p className={`text-xs ${remainingChars < 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {messageLength} {t('characterCount', language)}
                  {smsSegments > 1 && ` (${smsSegments} ${t('smsSegments', language)})`}
                  {remainingChars >= 0 && ` - ${remainingChars} ${t('charactersRemaining', language)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateMessage}
                disabled={generating}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-sm transition disabled:opacity-50"
              >
                {generating ? t('generating', language) : t('generateWithAI', language)}
              </button>
            </div>
          </div>
        </div>

        {/* Frequency Type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('frequencyType', language)}
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleFrequencyTypeChange('weekly')}
              className={`px-6 py-2 rounded-lg transition ${
                formData.frequencyType === 'weekly'
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {t('frequencyWeekly', language)}
            </button>
            <button
              type="button"
              onClick={() => handleFrequencyTypeChange('monthly')}
              className={`px-6 py-2 rounded-lg transition ${
                formData.frequencyType === 'monthly'
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {t('frequencyMonthly', language)}
            </button>
          </div>
        </div>

        {/* Frequency Value */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('frequencyValue', language)}
          </label>
          <select
            value={formData.frequencyValue}
            onChange={(e) => setFormData(prev => ({ ...prev, frequencyValue: parseInt(e.target.value) }))}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
          >
            {(formData.frequencyType === 'weekly' ? WEEKLY_OPTIONS : MONTHLY_OPTIONS).map(option => (
              <option key={option.value} value={option.value}>
                {option.label[language]}
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
                    ? 'bg-purple-600 hover:bg-purple-500'
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
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
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
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
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
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition disabled:opacity-50"
          >
            {loading ? t('creating', language) : t('createCampaign', language)}
          </button>
        </div>
      </form>
    </div>
  )
}
