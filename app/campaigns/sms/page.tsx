'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { t } from '@/lib/translations'
import { LanguageSelector } from '@/components/LanguageSelector'

interface SmsCampaignStats {
  totalSms: number
  pending: number
  sent: number
  failed: number
  paused: number
}

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
  stats: SmsCampaignStats
}

export default function SmsCampaignsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { language } = useLanguage()

  useEffect(() => {
    const auth = localStorage.getItem('authenticated')
    if (auth !== 'true') {
      router.push('/login')
    } else {
      setIsAuthenticated(true)
      loadCampaigns()
    }
  }, [router])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sms-campaigns')
      const data = await response.json()

      if (data.success) {
        setCampaigns(data.campaigns)
      } else {
        setError(data.error || t('errorLoadSmsCampaign', language))
      }
    } catch (err) {
      setError(t('errorLoadSmsCampaign', language))
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/sms-campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        loadCampaigns()
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const handleDelete = async (campaignId: string) => {
    const confirmMsg = language === 'fr'
      ? 'Êtes-vous sûr de vouloir supprimer cette campagne ? Cette action est irréversible.'
      : 'Are you sure you want to delete this campaign? This action cannot be undone.'

    if (!confirm(confirmMsg)) {
      return
    }

    try {
      const response = await fetch(`/api/sms-campaigns/${campaignId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadCampaigns()
      }
    } catch (err) {
      console.error('Failed to delete campaign:', err)
    }
  }

  if (isAuthenticated === null || loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">{t('loading', language)}</div>
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('statusActive', language)
      case 'paused': return t('statusPaused', language)
      case 'completed': return t('statusCompleted', language)
      default: return status
    }
  }

  const getProgressPercent = (stats: SmsCampaignStats) => {
    if (stats.totalSms === 0) return 0
    return Math.round((stats.sent / stats.totalSms) * 100)
  }

  const getFrequencyLabel = (campaign: SmsCampaign) => {
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

  const dayLabels: Record<string, string> = {
    monday: t('monday', language),
    tuesday: t('tuesday', language),
    wednesday: t('wednesday', language),
    thursday: t('thursday', language),
    friday: t('friday', language),
    saturday: t('saturday', language),
    sunday: t('sunday', language)
  }

  const formatSendDays = (days: string[]) => {
    if (!days || days.length === 0) return language === 'fr' ? 'Aucun jour défini' : 'No days set'
    return days.map(d => dayLabels[d] || d).join(', ')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('smsCampaignsTitle', language)}</h1>
          <p className="text-gray-400 mt-1">{t('smsCampaignsSubtitle', language)}</p>
        </div>
        <div className="flex gap-4 items-center">
          <LanguageSelector />
          <Link
            href="/campaigns"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            {t('backToCampaigns', language)}
          </Link>
          <Link
            href="/campaigns/sms/new"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
          >
            + {t('newSmsCampaign', language)}
          </Link>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Campaigns list */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <p className="text-gray-400 text-lg mb-4">
            {language === 'fr' ? 'Aucune campagne SMS pour le moment' : 'No SMS campaigns yet'}
          </p>
          <Link
            href="/campaigns/sms/new"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
          >
            {language === 'fr' ? 'Créer votre première campagne SMS' : 'Create your first SMS campaign'}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition"
            >
              <div className="flex justify-between items-start">
                {/* Campaign info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link
                      href={`/campaigns/sms/${campaign.id}`}
                      className="text-xl font-semibold hover:text-purple-400 transition"
                    >
                      {campaign.name}
                    </Link>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {getStatusLabel(campaign.status)}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {getFrequencyLabel(campaign)}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm mb-3">
                    {campaign.creatorEmail} &bull; {formatSendDays(campaign.sendDays)} &bull; {campaign.sendStartHour}h-{campaign.sendEndHour}h
                  </p>

                  {/* Message preview */}
                  <p className="text-gray-500 text-sm mb-3 truncate max-w-xl">
                    {campaign.message}
                  </p>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{language === 'fr' ? 'Progression' : 'Progress'}</span>
                      <span className="text-gray-300">
                        {campaign.stats.sent} / {campaign.stats.totalSms} ({getProgressPercent(campaign.stats)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all"
                        style={{ width: `${getProgressPercent(campaign.stats)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 text-sm">
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

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  {campaign.status === 'active' ? (
                    <button
                      onClick={() => handleStatusChange(campaign.id, 'paused')}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-sm transition"
                    >
                      {language === 'fr' ? 'Pause' : 'Pause'}
                    </button>
                  ) : campaign.status === 'paused' ? (
                    <button
                      onClick={() => handleStatusChange(campaign.id, 'active')}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm transition"
                    >
                      {language === 'fr' ? 'Reprendre' : 'Resume'}
                    </button>
                  ) : null}
                  <Link
                    href={`/campaigns/sms/${campaign.id}`}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm transition"
                  >
                    {language === 'fr' ? 'Voir' : 'View'}
                  </Link>
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm transition"
                  >
                    {t('delete', language)}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
