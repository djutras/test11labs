'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { t } from '@/lib/translations'
import { LanguageSelector } from '@/components/LanguageSelector'

interface CampaignStats {
  totalContacts: number
  pending: number
  completed: number
  answered: number
  failed: number
  avgDuration: number
}

interface Campaign {
  id: string
  name: string
  creatorEmail: string
  callDays: string[]
  callStartHour: number
  callEndHour: number
  timezone: string
  priority: number
  voicemailAction: string
  status: string
  createdAt: string
  stats: CampaignStats
}

export default function CampaignsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
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
      const response = await fetch('/api/campaigns')
      const data = await response.json()

      if (data.success) {
        setCampaigns(data.campaigns)
      } else {
        setError(data.error || t('errorLoadCampaign', language))
      }
    } catch (err) {
      setError(t('errorLoadCampaign', language))
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
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
      const response = await fetch(`/api/campaigns/${campaignId}`, {
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

  const getProgressPercent = (stats: CampaignStats) => {
    if (stats.totalContacts === 0) return 0
    return Math.round((stats.completed / stats.totalContacts) * 100)
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  }

  // Day translations for display
  const dayLabels: Record<string, string> = {
    monday: t('monday', language),
    tuesday: t('tuesday', language),
    wednesday: t('wednesday', language),
    thursday: t('thursday', language),
    friday: t('friday', language),
    saturday: t('saturday', language),
    sunday: t('sunday', language)
  }

  const formatCallDays = (days: string[]) => {
    if (!days || days.length === 0) return language === 'fr' ? 'Aucun jour défini' : 'No days set'
    return days.map(d => dayLabels[d] || d).join(', ')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('campaignsTitle', language)}</h1>
          <p className="text-gray-400 mt-1">{t('campaignsSubtitle', language)}</p>
        </div>
        <div className="flex gap-4 items-center">
          <LanguageSelector />
          <Link
            href="/"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            Dashboard
          </Link>
          <Link
            href="/campaigns/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
          >
            + {t('newCampaign', language)}
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
          <p className="text-gray-400 text-lg mb-4">{t('noCampaigns', language)}</p>
          <Link
            href="/campaigns/new"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
          >
            {t('noCampaignsDesc', language)}
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
                      href={`/campaigns/${campaign.id}`}
                      className="text-xl font-semibold hover:text-blue-400 transition"
                    >
                      {campaign.name}
                    </Link>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {getStatusLabel(campaign.status)}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {t('priority', language)}: {campaign.priority}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm mb-3">
                    {campaign.creatorEmail} &bull; {formatCallDays(campaign.callDays)} &bull; {campaign.callStartHour ?? 9}h-{campaign.callEndHour ?? 19}h ({campaign.timezone || 'America/Toronto'})
                  </p>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{language === 'fr' ? 'Progression' : 'Progress'}</span>
                      <span className="text-gray-300">
                        {campaign.stats.completed} / {campaign.stats.totalContacts} ({getProgressPercent(campaign.stats)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${getProgressPercent(campaign.stats)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-gray-500">{language === 'fr' ? 'En attente' : 'Pending'}:</span>
                      <span className="ml-2 text-yellow-400">{campaign.stats.pending}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{language === 'fr' ? 'Répondu' : 'Answered'}:</span>
                      <span className="ml-2 text-green-400">{campaign.stats.answered}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{language === 'fr' ? 'Échoué' : 'Failed'}:</span>
                      <span className="ml-2 text-red-400">{campaign.stats.failed}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{language === 'fr' ? 'Durée moy.' : 'Avg Duration'}:</span>
                      <span className="ml-2 text-gray-300">{formatDuration(campaign.stats.avgDuration)}</span>
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
                    href={`/campaigns/${campaign.id}`}
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
