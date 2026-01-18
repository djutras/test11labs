'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { t } from '@/lib/translations'
import { LanguageSelector } from '@/components/LanguageSelector'

interface EmailCampaignStats {
  totalEmails: number
  pending: number
  sent: number
  failed: number
}

interface EmailCampaign {
  id: string
  name: string
  creatorEmail: string
  subject: string
  body: string
  sendDays: string[]
  sendStartHour: number
  sendEndHour: number
  timezone: string
  campaignDurationDays: number
  status: string
  createdAt: string
  stats: EmailCampaignStats
}

interface ScheduledEmail {
  id: string
  email: string
  name?: string
  subject: string
  scheduledAt: string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  errorMessage?: string
}

export default function EmailCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null)
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const { language } = useLanguage()

  useEffect(() => {
    loadCampaign()
  }, [id])

  const loadCampaign = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/email-campaigns/${id}`)
      const data = await response.json()

      if (data.success) {
        setCampaign(data.campaign)
        setScheduledEmails(data.scheduledEmails || [])
      } else {
        setError(data.error || t('errorLoadEmailCampaign', language))
      }
    } catch (err) {
      setError(t('errorLoadEmailCampaign', language))
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/email-campaigns/${id}`, {
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

  const handleDelete = async () => {
    const confirmMsg = language === 'fr'
      ? 'Êtes-vous sûr de vouloir supprimer cette campagne ? Cette action est irréversible.'
      : 'Are you sure you want to delete this campaign? This action cannot be undone.'

    if (!confirm(confirmMsg)) return

    try {
      const response = await fetch(`/api/email-campaigns/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push('/campaigns')
      }
    } catch (err) {
      console.error('Failed to delete campaign:', err)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`/api/email-campaigns/${id}/upload-csv`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setUploadSuccess(
          language === 'fr'
            ? `${data.added} ${t('contactsAdded', language)}, ${data.skipped} ${t('contactsSkipped', language)}`
            : `${data.added} contacts added, ${data.skipped} skipped`
        )
        loadCampaign()
      } else {
        setUploadError(data.error || t('errorUploadCsv', language))
      }
    } catch (err) {
      setUploadError(t('errorUploadCsv', language))
    } finally {
      setUploading(false)
      // Reset file input
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

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error || 'Campaign not found'}
        </div>
        <Link href="/campaigns" className="text-blue-400 hover:underline">
          {t('backToCampaigns', language)}
        </Link>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-600'
      case 'paused': return 'bg-yellow-600'
      case 'completed': return 'bg-blue-600'
      default: return 'bg-gray-600'
    }
  }

  const getEmailStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'text-green-400'
      case 'failed': return 'text-red-400'
      default: return 'text-yellow-400'
    }
  }

  const getProgressPercent = () => {
    if (campaign.stats.totalEmails === 0) return 0
    return Math.round((campaign.stats.sent / campaign.stats.totalEmails) * 100)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(campaign.status)}`}>
              {t(`status${campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}` as any, language)}
            </span>
          </div>
          <p className="text-gray-400 mt-1">{campaign.creatorEmail}</p>
        </div>
        <div className="flex gap-4 items-center">
          <LanguageSelector />
          <Link
            href="/campaigns"
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
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition"
          >
            {t('delete', language)}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Total</div>
          <div className="text-2xl font-bold">{campaign.stats.totalEmails}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">{t('emailPending', language)}</div>
          <div className="text-2xl font-bold text-yellow-400">{campaign.stats.pending}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">{t('emailSent', language)}</div>
          <div className="text-2xl font-bold text-green-400">{campaign.stats.sent}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">{t('emailFailed', language)}</div>
          <div className="text-2xl font-bold text-red-400">{campaign.stats.failed}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-800 rounded-lg p-4 mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">{language === 'fr' ? 'Progression' : 'Progress'}</span>
          <span>{getProgressPercent()}%</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${getProgressPercent()}%` }}
          />
        </div>
      </div>

      {/* Campaign Settings */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">{t('campaignSettings', language)}</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">{t('emailSubject', language)}:</span>
            <p className="mt-1">{campaign.subject}</p>
          </div>
          <div>
            <span className="text-gray-400">{t('sendDays', language)}:</span>
            <p className="mt-1">{campaign.sendDays.map(d => dayLabels[d] || d).join(', ')}</p>
          </div>
          <div>
            <span className="text-gray-400">{language === 'fr' ? 'Heures' : 'Hours'}:</span>
            <p className="mt-1">{campaign.sendStartHour}:00 - {campaign.sendEndHour}:00</p>
          </div>
          <div>
            <span className="text-gray-400">{t('campaignDuration', language)}:</span>
            <p className="mt-1">{campaign.campaignDurationDays} {language === 'fr' ? 'jours' : 'days'}</p>
          </div>
        </div>
      </div>

      {/* Upload CSV */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">{t('uploadCsv', language)}</h2>
        <p className="text-gray-400 text-sm mb-4">
          {t('csvEmailFormatDesc', language)}
        </p>

        {uploadError && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded mb-4">
            {uploadSuccess}
          </div>
        )}

        <label className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer transition">
          {uploading ? t('uploading', language) : t('selectFile', language)}
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Scheduled Emails */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">{t('scheduledEmails', language)}</h2>

        {scheduledEmails.length === 0 ? (
          <p className="text-gray-400">{t('noScheduledEmails', language)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3">{t('emailAddress', language)}</th>
                  <th className="pb-3">{t('name', language)}</th>
                  <th className="pb-3">{t('scheduledFor', language)}</th>
                  <th className="pb-3">{t('status', language)}</th>
                </tr>
              </thead>
              <tbody>
                {scheduledEmails.slice(0, 100).map(email => (
                  <tr key={email.id} className="border-b border-gray-700/50">
                    <td className="py-3">{email.email}</td>
                    <td className="py-3">{email.name || '-'}</td>
                    <td className="py-3">{formatDate(email.scheduledAt)}</td>
                    <td className="py-3">
                      <span className={getEmailStatusColor(email.status)}>
                        {t(`email${email.status.charAt(0).toUpperCase() + email.status.slice(1)}` as any, language)}
                      </span>
                      {email.errorMessage && (
                        <span className="text-gray-500 text-xs ml-2" title={email.errorMessage}>
                          (!)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {scheduledEmails.length > 100 && (
              <p className="text-gray-400 text-sm mt-4">
                {language === 'fr'
                  ? `Affichage des 100 premiers sur ${scheduledEmails.length} courriels`
                  : `Showing first 100 of ${scheduledEmails.length} emails`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
