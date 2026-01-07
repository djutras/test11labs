'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

interface FutureCall {
  id: string
  scheduledAt: string
  status: string
  retryCount: number
  createdAt: string
}

interface ClientData {
  name: string
  phone: string
  campaignId: string
  campaignName: string
  totalFutureCalls: number
  futureCalls: FutureCall[]
}

export default function ClientFutureCallsPage() {
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

  // Fetch future calls
  useEffect(() => {
    if (!isAuthenticated || !campaignId || !phone) return

    const fetchFutureCalls = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/campaigns/${campaignId}/client/${encodeURIComponent(phone)}/future`)
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch future calls')
        }

        setClient(data.client)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchFutureCalls()
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

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      calling: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      answered: 'bg-green-100 text-green-800',
      no_answer: 'bg-orange-100 text-orange-800',
      voicemail: 'bg-purple-100 text-purple-800',
      busy: 'bg-red-100 text-red-800',
      failed: 'bg-red-100 text-red-800',
      invalid: 'bg-gray-100 text-gray-800'
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { fr: string; en: string }> = {
      pending: { fr: 'En attente', en: 'Pending' },
      calling: { fr: 'Appel en cours', en: 'Calling' },
      in_progress: { fr: 'En cours', en: 'In Progress' },
      completed: { fr: 'Complété', en: 'Completed' },
      answered: { fr: 'Répondu', en: 'Answered' },
      no_answer: { fr: 'Pas de réponse', en: 'No Answer' },
      voicemail: { fr: 'Messagerie', en: 'Voicemail' },
      busy: { fr: 'Occupé', en: 'Busy' },
      failed: { fr: 'Échoué', en: 'Failed' },
      invalid: { fr: 'Invalide', en: 'Invalid' }
    }
    return labels[status]?.[language] || status
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
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📅</span>
            <h1 className="text-2xl font-bold text-gray-900">
              {client.name}
            </h1>
          </div>
          <p className="text-gray-600 text-lg mb-2">{client.phone}</p>
          <p className="text-gray-500">
            {client.totalFutureCalls} {language === 'fr' ? 'appel(s) programmé(s)' : 'scheduled call(s)'}
          </p>
        </div>

        {/* Future calls */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {language === 'fr' ? 'Appels programmés' : 'Scheduled Calls'}
          </h2>

          {client.futureCalls.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-500">
              {language === 'fr' ? 'Aucun appel programmé' : 'No scheduled calls'}
            </div>
          ) : (
            client.futureCalls.map((call, index) => (
              <div
                key={call.id || index}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatDate(call.scheduledAt)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(call.status)}`}>
                          {getStatusLabel(call.status)}
                        </span>
                        {call.retryCount > 0 && (
                          <span className="text-gray-500 text-sm">
                            {language === 'fr' ? `${call.retryCount} tentative(s)` : `${call.retryCount} retry(ies)`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Link to history */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link
            href={`/campaigns/${campaignId}/client/${encodeURIComponent(client.phone)}`}
            className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-800"
          >
            <span>📜</span>
            <span>{language === 'fr' ? 'Voir l\'historique passé' : 'View past history'}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
