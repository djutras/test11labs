'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { t } from '@/lib/translations'
import { LanguageSelector } from '@/components/LanguageSelector'

interface SmsCampaign {
  id: string
  name: string
  creatorEmail: string
  message: string
  sendDays: string[]
  sendStartHour: number
  sendEndHour: number
  timezone: string
  frequencyType: 'weekly' | 'monthly'
  frequencyValue: number
  status: string
  createdAt: string
  stats: {
    totalSms: number
    pending: number
    sent: number
    failed: number
    paused: number
  }
}

interface ScheduledSms {
  id: string
  smsCampaignId: string
  phone: string
  name?: string
  message: string
  scheduledAt: string
  status: 'pending' | 'sent' | 'failed' | 'paused'
  twilioSid?: string
  errorMessage?: string
  createdAt: string
}

export default function SmsCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [campaign, setCampaign] = useState<SmsCampaign | null>(null)
  const [scheduledSms, setScheduledSms] = useState<ScheduledSms[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ created: number; skipped: number } | null>(null)
  const router = useRouter()
  const { language } = useLanguage()

  useEffect(() => {
    const auth = localStorage.getItem('authenticated')
    if (auth !== 'true') {
      router.push('/login')
    } else {
      loadCampaign()
    }
  }, [router, id])

  const loadCampaign = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/sms-campaigns/${id}`)
      const data = await response.json()

      if (data.success) {
        setCampaign(data.campaign)
        setScheduledSms(data.scheduledSms || [])
      } else {
        setError(data.error || t('errorLoadSmsCampaign', language))
      }
    } catch (err) {
      setError(t('errorLoadSmsCampaign', language))
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/sms-campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        loadCampaign()
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const handleToggleSms = async (smsId: string) => {
    try {
      const response = await fetch(`/api/sms-campaigns/${id}/toggle-sms/${smsId}`, {
        method: 'POST'
      })

      if (response.ok) {
        loadCampaign()
      }
    } catch (err) {
      console.error('Failed to toggle SMS status:', err)
    }
  }

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadResult(null)
    setError(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length === 0) {
        setError(language === 'fr' ? 'Le fichier CSV est vide' : 'CSV file is empty')
        setUploading(false)
        return
      }

      // Parse CSV
      const header = lines[0].toLowerCase().split(',').map(h => h.trim())
      const phoneIndex = header.findIndex(h => h === 'phone' || h === 'telephone' || h === 'tel')
      const nameIndex = header.findIndex(h => h === 'name' || h === 'nom')

      if (phoneIndex === -1) {
        setError(language === 'fr' ? 'Colonne "phone" non trouvée dans le CSV' : 'Column "phone" not found in CSV')
        setUploading(false)
        return
      }

      const contacts = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
        return {
          phone: values[phoneIndex] || '',
          name: nameIndex !== -1 ? values[nameIndex] : undefined
        }
      }).filter(c => c.phone)

      if (contacts.length === 0) {
        setError(language === 'fr' ? 'Aucun contact valide trouvé' : 'No valid contacts found')
        setUploading(false)
        return
      }

      // Upload contacts
      const response = await fetch(`/api/sms-campaigns/${id}/upload-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts })
      })

      const data = await response.json()

      if (data.success) {
        setUploadResult({ created: data.created, skipped: data.skipped })
        loadCampaign()
      } else {
        setError(data.error || (language === 'fr' ? 'Erreur lors de l\'importation' : 'Error during import'))
      }
    } catch (err) {
      setError(language === 'fr' ? 'Erreur lors de la lecture du fichier' : 'Error reading file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">{t('loading', language)}</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl text-red-400">
          {language === 'fr' ? 'Campagne non trouvée' : 'Campaign not found'}
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-600'
      case 'paused': return 'bg-yellow-600'
      case 'completed': return 'bg-blue-600'
      case 'pending': return 'bg-yellow-600'
      case 'sent': return 'bg-green-600'
      case 'failed': return 'bg-red-600'
      default: return 'bg-gray-600'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('statusActive', language)
      case 'paused': return t('smsPaused', language)
      case 'completed': return t('statusCompleted', language)
      case 'pending': return t('smsPending', language)
      case 'sent': return t('smsSent', language)
      case 'failed': return t('smsFailed', language)
      default: return status
    }
  }

  const dayLabels: Record<string, string> = {
    monday: t('monday', language),
    tuesday: t('tuesday', language),
    wednesday: t('wednesday', language),
    thursday: t('thursday', language),
    friday: t('friday', language),
    saturday: t('saturday', language),
    sunday: t('sunday', language)
  }

  const getFrequencyLabel = () => {
    if (campaign.frequencyType === 'weekly') {
      return campaign.frequencyValue === 1
        ? (language === 'fr' ? '1 semaine' : '1 week')
        : `${campaign.frequencyValue} ${language === 'fr' ? 'semaines' : 'weeks'}`
    } else {
      return campaign.frequencyValue === 1
        ? (language === 'fr' ? '1 mois' : '1 month')
        : `${campaign.frequencyValue} ${language === 'fr' ? 'mois' : 'months'}`
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <p className="text-gray-400 mt-1">{campaign.creatorEmail}</p>
        </div>
        <div className="flex gap-4 items-center">
          <LanguageSelector />
          <Link
            href="/campaigns/sms"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            {t('backToCampaigns', language)}
          </Link>
          {campaign.status === 'active' ? (
            <button
              onClick={() => handleStatusChange('paused')}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition"
            >
              {language === 'fr' ? 'Pause' : 'Pause'}
            </button>
          ) : campaign.status === 'paused' ? (
            <button
              onClick={() => handleStatusChange('active')}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition"
            >
              {language === 'fr' ? 'Reprendre' : 'Resume'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Upload result */}
      {uploadResult && (
        <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded mb-6">
          {uploadResult.created} {t('contactsAdded', language)}, {uploadResult.skipped} {t('contactsSkipped', language)}
        </div>
      )}

      {/* Campaign Info Card */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(campaign.status)}`}>
            {getStatusLabel(campaign.status)}
          </span>
          <span className="text-gray-400">
            {t('frequencyType', language)}: {campaign.frequencyType === 'weekly' ? t('frequencyWeekly', language) : t('frequencyMonthly', language)} - {getFrequencyLabel()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">{t('sendDays', language)}</h3>
            <p>{campaign.sendDays.map(d => dayLabels[d] || d).join(', ')}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">{language === 'fr' ? 'Heures d\'envoi' : 'Send Hours'}</h3>
            <p>{campaign.sendStartHour}:00 - {campaign.sendEndHour}:00 ({campaign.timezone})</p>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">{t('smsMessage', language)}</h3>
          <p className="bg-gray-700 p-3 rounded-lg text-sm">{campaign.message}</p>
          <p className="text-xs text-gray-500 mt-1">{campaign.message.length} {t('characterCount', language)}</p>
        </div>

        {/* Stats */}
        <div className="flex gap-8 pt-4 border-t border-gray-700">
          <div>
            <span className="text-gray-500">{language === 'fr' ? 'Total' : 'Total'}:</span>
            <span className="ml-2 text-white font-medium">{campaign.stats.totalSms}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('smsPending', language)}:</span>
            <span className="ml-2 text-yellow-400">{campaign.stats.pending}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('smsSent', language)}:</span>
            <span className="ml-2 text-green-400">{campaign.stats.sent}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('smsFailed', language)}:</span>
            <span className="ml-2 text-red-400">{campaign.stats.failed}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('smsPaused', language)}:</span>
            <span className="ml-2 text-gray-400">{campaign.stats.paused}</span>
          </div>
        </div>
      </div>

      {/* CSV Upload Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{t('uploadCsv', language)}</h2>
        <p className="text-gray-400 text-sm mb-4">
          {t('csvSmsFormatDesc', language)}
        </p>
        <div className="flex gap-4 items-center">
          <label className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? t('uploading', language) : t('selectFile', language)}
          </label>
        </div>
      </div>

      {/* Scheduled SMS Table */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">{t('scheduledSms', language)}</h2>

        {scheduledSms.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>{t('noScheduledSms', language)}</p>
            <p className="text-sm mt-2">{t('noScheduledSmsDesc', language)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                  <th className="pb-3">{t('phone', language)}</th>
                  <th className="pb-3">{t('name', language)}</th>
                  <th className="pb-3">{t('scheduledFor', language)}</th>
                  <th className="pb-3">{t('status', language)}</th>
                  <th className="pb-3">{language === 'fr' ? 'Action' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {scheduledSms.map((sms) => (
                  <tr key={sms.id} className="border-b border-gray-700/50 hover:bg-gray-750">
                    <td className="py-3">{sms.phone}</td>
                    <td className="py-3 text-gray-400">{sms.name || '-'}</td>
                    <td className="py-3 text-gray-400 text-sm">{formatDate(sms.scheduledAt)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(sms.status)}`}>
                        {getStatusLabel(sms.status)}
                      </span>
                      {sms.errorMessage && (
                        <span className="ml-2 text-xs text-red-400" title={sms.errorMessage}>
                          ⚠️
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {(sms.status === 'pending' || sms.status === 'paused') && (
                        <button
                          onClick={() => handleToggleSms(sms.id)}
                          className={`px-3 py-1 rounded text-sm transition ${
                            sms.status === 'pending'
                              ? 'bg-yellow-600 hover:bg-yellow-500'
                              : 'bg-green-600 hover:bg-green-500'
                          }`}
                        >
                          {sms.status === 'pending' ? t('stopSms', language) : t('resumeSms', language)}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
