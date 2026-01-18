'use client'

import { useState, useEffect } from 'react'
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
  sendDays: string[]
  sendStartHour: number
  sendEndHour: number
  timezone: string
  status: string
  createdAt: string
  stats: EmailCampaignStats
}

export default function EmailCampaignsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
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
      const response = await fetch('/api/email-campaigns')
      const data = await response.json()

      if (data.success) {
        setCampaigns(data.campaigns)
      } else {
        setError(data.error || t('errorLoadEmailCampaign', language))
      }
    } catch (err) {
      setError(t('errorLoadEmailCampaign', language))
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/email-campaigns/${campaignId}`, {
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

    if (!confirm(confirmMsg)) return

    try {
      const response = await fetch(`/api/email-campaigns/${campaignId}`, {
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

  const getProgressPercent = (stats: EmailCampaignStats) => {
    if (stats.totalEmails === 0) return 0
    return Math.round((stats.sent / stats.totalEmails) * 100)
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
          <h1 className="text-3xl font-bold">{t('emailCampaignsTitle', language)}</h1>
          <p className="text-gray-400 mt-1">{t('emailCampaignsSubtitle', language)}</p>
        </div>
        <div className="flex gap-4 items-center">
          <LanguageSelector />
          <Link
            href="/campaigns"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            {language === 'fr' ? 'Campagnes appels' : 'Call Campaigns'}
          </Link>
          <Link
            href="/campaigns/email/new"
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition"
          >
            + {t('newEmailCampaign', language)}
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
            {language === 'fr' ? 'Aucune campagne courriel' : 'No email campaigns yet'}
          </p>
          <Link
            href="/campaigns/email/new"
            className="inline-block px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg transition"
          >
            {language === 'fr'
              ? 'Créez votre première campagne courriel'
              : 'Create your first email campaign'}
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
                      href={`/campaigns/email/${campaign.id}`}
                      className="text-xl font-semibold hover:text-green-400 transition"
                    >
                      {campaign.name}
                    </Link>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {t(`status${campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}` as any, language)}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm mb-3">
                    {campaign.creatorEmail} &bull; {campaign.sendDays.map(d => dayLabels[d] || d).join(', ')} &bull; {campaign.sendStartHour}h-{campaign.sendEndHour}h
                  </p>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{language === 'fr' ? 'Progression' : 'Progress'}</span>
                      <span className="text-gray-300">
                        {campaign.stats.sent} / {campaign.stats.totalEmails} ({getProgressPercent(campaign.stats)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${getProgressPercent(campaign.stats)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-gray-500">{t('emailPending', language)}:</span>
                      <span className="ml-2 text-yellow-400">{campaign.stats.pending}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('emailSent', language)}:</span>
                      <span className="ml-2 text-green-400">{campaign.stats.sent}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('emailFailed', language)}:</span>
                      <span className="ml-2 text-red-400">{campaign.stats.failed}</span>
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
                    href={`/campaigns/email/${campaign.id}`}
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
