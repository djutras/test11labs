'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

interface CallLog {
  id: string
  conversationId?: string
  duration?: number
  outcome?: string
  transcript?: Array<{ role: string; message: string }> | null
  audioUrl?: string
  createdAt: string
}

interface CallHistoryItem {
  id: string
  scheduledAt: string
  status: string
  retryCount: number
  createdAt: string
  callLogs: CallLog[]
}

interface ClientData {
  name: string
  phone: string
  campaignId: string
  campaignName: string
  totalCalls: number
  callHistory: CallHistoryItem[]
}

export default function ClientHistoryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string
  const phone = params.phone as string
  const { language } = useLanguage()

  // Check authentication
  useEffect(() => {
    const authStatus = localStorage.getItem('authenticated')
    if (authStatus !== 'true') {
      router.push('/login')
    } else {
      setIsAuthenticated(true)
    }
  }, [router])

  // Fetch client history
  useEffect(() => {
    if (!isAuthenticated || !campaignId || !phone) return

    const fetchClientHistory = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/campaigns/${campaignId}/client/${encodeURIComponent(phone)}`)
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch client history')
        }

        setClient(data.client)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchClientHistory()
  }, [isAuthenticated, campaignId, phone])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return language === 'fr' ? '0s' : '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      answered: 'bg-green-100 text-green-800',
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      calling: 'bg-blue-100 text-blue-800',
      no_answer: 'bg-orange-100 text-orange-800',
      voicemail: 'bg-purple-100 text-purple-800',
      busy: 'bg-red-100 text-red-800',
      failed: 'bg-red-100 text-red-800',
      invalid: 'bg-gray-100 text-gray-800'
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  if (isAuthenticated === null || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">
          {language === 'fr' ? 'Chargement...' : 'Loading...'}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href={`/campaigns/${campaignId}`}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← {language === 'fr' ? 'Retour à la campagne' : 'Back to campaign'}
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href={`/campaigns/${campaignId}`}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← {language === 'fr' ? 'Retour à la campagne' : 'Back to campaign'}
          </Link>
          <div className="text-gray-600">
            {language === 'fr' ? 'Client non trouvé' : 'Client not found'}
          </div>
        </div>
      </div>
    )
  }

  // Flatten all call logs for display
  const allCallLogs = client.callHistory.flatMap(item =>
    item.callLogs.map(log => ({
      ...log,
      scheduledAt: item.scheduledAt,
      scheduledStatus: item.status
    }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        {/* Back link */}
        <Link
          href={`/campaigns/${campaignId}`}
          className="text-blue-600 hover:text-blue-800 mb-6 inline-flex items-center gap-2"
        >
          <span>←</span>
          <span>{language === 'fr' ? 'Retour à' : 'Back to'} {client.campaignName}</span>
        </Link>

        {/* Client header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {client.name}
          </h1>
          <p className="text-gray-600 text-lg mb-2">{client.phone}</p>
          <p className="text-gray-500">
            {client.totalCalls} {language === 'fr' ? 'appel(s) au total' : 'total call(s)'}
          </p>
        </div>

        {/* Call history */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {language === 'fr' ? 'Historique des appels' : 'Call History'}
          </h2>

          {allCallLogs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-500">
              {language === 'fr' ? 'Aucun appel enregistré' : 'No calls recorded'}
            </div>
          ) : (
            allCallLogs.map((callLog, index) => (
              <div
                key={callLog.id || index}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                {/* Call header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatDate(callLog.createdAt)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(callLog.outcome || 'pending')}`}>
                          {callLog.outcome || 'pending'}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {formatDuration(callLog.duration)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Audio button */}
                  {callLog.audioUrl && (
                    <a
                      href={callLog.audioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <span>🔊</span>
                      <span>{language === 'fr' ? 'Écouter' : 'Listen'}</span>
                    </a>
                  )}
                </div>

                {/* Transcript */}
                {callLog.transcript && Array.isArray(callLog.transcript) && callLog.transcript.length > 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {callLog.transcript.map((entry: any, idx: number) => (
                      <div key={idx} className={`flex gap-3 ${entry.role === 'agent' ? '' : 'flex-row-reverse'}`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                          entry.role === 'agent' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {entry.role === 'agent' ? '🤖' : '👤'}
                        </div>
                        <div className={`flex-1 p-3 rounded-lg ${
                          entry.role === 'agent' ? 'bg-blue-50 text-gray-800' : 'bg-green-50 text-gray-800'
                        }`}>
                          <p className="text-xs text-gray-500 mb-1 font-medium">
                            {entry.role === 'agent' ? 'Agent' : (language === 'fr' ? 'Client' : 'User')}
                          </p>
                          <p className="text-sm">{entry.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                    {language === 'fr' ? 'Pas de transcript disponible' : 'No transcript available'}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
