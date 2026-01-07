'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { t, getDaysOfWeek } from '@/lib/translations'
import { LanguageSelector } from '@/components/LanguageSelector'

interface CallLogData {
  id: string
  conversationId?: string
  duration?: number
  outcome?: string
  transcript?: { transcript?: Array<{ role: string; message: string }> } | null
  audioUrl?: string
}

interface ScheduledCall {
  id: string
  phone: string
  name: string | null
  firstMessage: string | null
  scheduledAt: string
  status: string
  retryCount: number
  callLog?: CallLogData | null
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
  voicemailMessage: string | null
  recordingDisclosure: string | null
  firstMessage: string | null
  fullPrompt: string | null
  status: string
  createdAt: string
  stats: {
    totalContacts: number
    pending: number
    completed: number
    answered: number
    failed: number
    avgDuration: number
  }
  scheduledCalls: ScheduledCall[]
}

export default function CampaignDetailPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string
  const { language } = useLanguage()

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    callDays: [] as string[],
    callStartHour: 9,
    callEndHour: 19,
    priority: 1,
    voicemailAction: 'hangup' as 'hangup' | 'leave_message' | 'retry',
    voicemailMessage: '',
    recordingDisclosure: '',
    firstMessage: '',
    fullPrompt: ''
  })
  const [generatingFirstMessage, setGeneratingFirstMessage] = useState(false)
  const [generatingFullPrompt, setGeneratingFullPrompt] = useState(false)

  // Transcript modal state
  const [showTranscriptModal, setShowTranscriptModal] = useState(false)
  const [selectedTranscript, setSelectedTranscript] = useState<CallLogData | null>(null)
  const [selectedCallName, setSelectedCallName] = useState<string>('')

  // Call in progress state
  const [callingId, setCallingId] = useState<string | null>(null)

  const handleMakeCall = async (scheduledCallId: string, phone: string, name: string | null) => {
    if (callingId) return // Already calling

    setCallingId(scheduledCallId)
    setError(null)

    try {
      const response = await fetch('/api/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          scheduledCallId,
          campaignId,
          firstMessage: campaign?.firstMessage || undefined,
          fullPrompt: campaign?.fullPrompt || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        // Refresh campaign to get updated status
        await loadCampaign()
      } else {
        setError(data.error || (language === 'fr' ? 'Erreur lors de l\'appel' : 'Call failed'))
      }
    } catch (err) {
      setError(language === 'fr' ? 'Erreur lors de l\'appel' : 'Call failed')
    } finally {
      setCallingId(null)
    }
  }

  const openTranscriptModal = (callLog: CallLogData, name: string) => {
    setSelectedTranscript(callLog)
    setSelectedCallName(name)
    setShowTranscriptModal(true)
  }

  useEffect(() => {
    const auth = localStorage.getItem('authenticated')
    if (auth !== 'true') {
      router.push('/login')
    } else {
      setIsAuthenticated(true)
      loadCampaign()
    }
  }, [router, campaignId])

  const loadCampaign = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}`)
      const data = await response.json()

      if (data.success) {
        setCampaign(data.campaign)
      } else {
        setError(data.error || t('errorLoadCampaign', language))
      }
    } catch (err) {
      setError(t('errorLoadCampaign', language))
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadResult(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/campaigns/${campaignId}/upload-csv`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setUploadResult(data.results)
        loadCampaign() // Refresh data
      } else {
        setError(data.error || t('errorUploadCsv', language))
        if (data.errors) {
          setError(data.errors.join(', '))
        }
      }
    } catch (err) {
      setError(t('errorUploadCsv', language))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
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

  const openEditModal = () => {
    if (campaign) {
      setEditForm({
        name: campaign.name,
        callDays: campaign.callDays || [],
        callStartHour: campaign.callStartHour ?? 9,
        callEndHour: campaign.callEndHour ?? 19,
        priority: campaign.priority ?? 1,
        voicemailAction: (campaign.voicemailAction as 'hangup' | 'leave_message' | 'retry') || 'hangup',
        voicemailMessage: campaign.voicemailMessage || '',
        recordingDisclosure: campaign.recordingDisclosure || '',
        firstMessage: campaign.firstMessage || '',
        fullPrompt: campaign.fullPrompt || ''
      })
      setShowEditModal(true)
    }
  }

  const toggleEditDay = (day: string) => {
    if (editForm.callDays.includes(day)) {
      setEditForm({ ...editForm, callDays: editForm.callDays.filter(d => d !== day) })
    } else {
      setEditForm({ ...editForm, callDays: [...editForm.callDays, day] })
    }
  }

  const generateWithGemini = async (type: 'first_message' | 'full_prompt') => {
    const setGenerating = type === 'first_message' ? setGeneratingFirstMessage : setGeneratingFullPrompt

    setGenerating(true)
    try {
      const response = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          context: editForm.name ? `Campagne: ${editForm.name}` : ''
        })
      })

      const data = await response.json()
      if (data.success && data.message) {
        if (type === 'first_message') {
          setEditForm({ ...editForm, firstMessage: data.message })
        } else {
          setEditForm({ ...editForm, fullPrompt: data.message })
        }
      } else {
        setError(data.error || t('errorGenerateMessage', language))
      }
    } catch (err) {
      setError(t('errorGenerateMessage', language))
    } finally {
      setGenerating(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!editForm.name.trim()) {
      setError(t('errorCampaignName', language))
      return
    }
    if (editForm.callDays.length === 0) {
      setError(t('errorCallDays', language))
      return
    }
    if (editForm.callStartHour >= editForm.callEndHour) {
      setError(t('errorCallHours', language))
      return
    }

    setEditLoading(true)

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          callDays: editForm.callDays,
          callStartHour: editForm.callStartHour,
          callEndHour: editForm.callEndHour,
          priority: editForm.priority,
          voicemailAction: editForm.voicemailAction,
          voicemailMessage: editForm.voicemailAction === 'leave_message' ? editForm.voicemailMessage : null,
          recordingDisclosure: editForm.recordingDisclosure,
          firstMessage: editForm.firstMessage,
          fullPrompt: editForm.fullPrompt
        })
      })

      const data = await response.json()

      if (data.success) {
        setShowEditModal(false)
        loadCampaign()
      } else {
        setError(data.error || t('errorUpdateCampaign', language))
      }
    } catch (err) {
      setError(t('errorUpdateCampaign', language))
    } finally {
      setEditLoading(false)
    }
  }

  const DAYS_OF_WEEK = getDaysOfWeek(language)

  // Day labels for display
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

  if (isAuthenticated === null || loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">{t('loading', language)}</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-400 mb-4">{error || (language === 'fr' ? 'Campagne non trouvée' : 'Campaign not found')}</div>
          <Link href="/campaigns" className="text-blue-400 hover:underline">
            {t('backToCampaigns', language)}
          </Link>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-600'
      case 'paused': return 'bg-yellow-600'
      case 'completed': return 'bg-blue-600'
      case 'pending': return 'bg-gray-500'
      case 'answered': return 'bg-green-500'
      case 'failed': case 'invalid': return 'bg-red-500'
      case 'voicemail': case 'no_answer': case 'busy': return 'bg-yellow-500'
      default: return 'bg-gray-600'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('statusActive', language)
      case 'paused': return t('statusPaused', language)
      case 'completed': return t('statusCompleted', language)
      case 'pending': return t('callPending', language)
      case 'in_progress': return t('callInProgress', language)
      case 'answered': return language === 'fr' ? 'Répondu' : 'Answered'
      case 'failed': return t('callFailed', language)
      case 'no_answer': return t('callNoAnswer', language)
      case 'voicemail': return t('callVoicemail', language)
      default: return status
    }
  }

  const getProgressPercent = () => {
    if (campaign.stats.totalContacts === 0) return 0
    return Math.round((campaign.stats.completed / campaign.stats.totalContacts) * 100)
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(campaign.status)}`}>
              {getStatusLabel(campaign.status)}
            </span>
          </div>
          <p className="text-gray-400">
            {campaign.creatorEmail} &bull; {t('priority', language)}: {campaign.priority}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {formatCallDays(campaign.callDays)} &bull; {campaign.callStartHour ?? 9}h-{campaign.callEndHour ?? 19}h ({campaign.timezone || 'America/Toronto'})
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <LanguageSelector />
          <button
            onClick={openEditModal}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
          >
            {t('editCampaign', language)}
          </button>
          {campaign.status === 'active' ? (
            <button
              onClick={() => handleStatusChange('paused')}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition"
            >
              {language === 'fr' ? 'Mettre en pause' : 'Pause Campaign'}
            </button>
          ) : campaign.status === 'paused' ? (
            <button
              onClick={() => handleStatusChange('active')}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition"
            >
              {language === 'fr' ? 'Reprendre' : 'Resume Campaign'}
            </button>
          ) : null}
          <Link
            href="/campaigns"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            {language === 'fr' ? 'Retour' : 'Back'}
          </Link>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold">{campaign.stats.totalContacts}</div>
          <div className="text-gray-400 text-sm">{language === 'fr' ? 'Total contacts' : 'Total Contacts'}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-yellow-400">{campaign.stats.pending}</div>
          <div className="text-gray-400 text-sm">{language === 'fr' ? 'En attente' : 'Pending'}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-400">{campaign.stats.answered}</div>
          <div className="text-gray-400 text-sm">{language === 'fr' ? 'Répondu' : 'Answered'}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-400">{campaign.stats.failed}</div>
          <div className="text-gray-400 text-sm">{language === 'fr' ? 'Échoué' : 'Failed'}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold">{formatDuration(campaign.stats.avgDuration)}</div>
          <div className="text-gray-400 text-sm">{language === 'fr' ? 'Durée moy.' : 'Avg Duration'}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-800 rounded-lg p-4 mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">{language === 'fr' ? 'Progression de la campagne' : 'Campaign Progress'}</span>
          <span className="text-gray-300">
            {campaign.stats.completed} / {campaign.stats.totalContacts} ({getProgressPercent()}%)
          </span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${getProgressPercent()}%` }}
          />
        </div>
      </div>

      {/* CSV Upload */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">{language === 'fr' ? 'Importer des contacts' : 'Upload Contacts'}</h2>
        <p className="text-gray-400 text-sm mb-4">
          {language === 'fr'
            ? 'Importez un fichier CSV avec les colonnes : phone (requis), name (optionnel), subject (optionnel)'
            : 'Upload a CSV file with columns: phone (required), name (optional), subject (optional)'}
        </p>

        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={uploading || campaign.status !== 'active'}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${
              uploading || campaign.status !== 'active'
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {uploading
              ? (language === 'fr' ? 'Importation...' : 'Uploading...')
              : (language === 'fr' ? 'Choisir un fichier CSV' : 'Choose CSV File')}
          </label>
          {campaign.status !== 'active' && (
            <span className="text-yellow-400 text-sm">
              {language === 'fr' ? 'La campagne doit être active pour importer' : 'Campaign must be active to upload'}
            </span>
          )}
        </div>

        {/* Upload result */}
        {uploadResult && (
          <div className="mt-4 p-4 bg-gray-700 rounded-lg">
            <h3 className="font-medium mb-2">{language === 'fr' ? 'Résultat de l\'importation' : 'Upload Result'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">{language === 'fr' ? 'Total dans le CSV' : 'Total in CSV'}:</span>
                <span className="ml-2">{uploadResult.totalInCsv}</span>
              </div>
              <div>
                <span className="text-gray-400">{language === 'fr' ? 'Ajoutés' : 'Added'}:</span>
                <span className="ml-2 text-green-400">{uploadResult.added}</span>
              </div>
              <div>
                <span className="text-gray-400">{language === 'fr' ? 'Ignorés (DNC)' : 'Skipped (DNC)'}:</span>
                <span className="ml-2 text-yellow-400">{uploadResult.dncSkipped}</span>
              </div>
              <div>
                <span className="text-gray-400">{language === 'fr' ? 'Doublons' : 'Duplicates'}:</span>
                <span className="ml-2 text-gray-400">{uploadResult.duplicateInCampaign + uploadResult.duplicatesInCsv}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scheduled Calls */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          {language === 'fr' ? 'Appels programmés' : 'Scheduled Calls'} ({campaign.scheduledCalls.length})
        </h2>

        {campaign.scheduledCalls.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            {language === 'fr' ? 'Aucun contact pour le moment. Importez un CSV pour commencer.' : 'No contacts yet. Upload a CSV to get started.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">{t('name', language)}</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">{t('phone', language)}</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">{language === 'fr' ? 'Prévu' : 'Scheduled'}</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">{t('status', language)}</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">{language === 'fr' ? 'Tentatives' : 'Retries'}</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">{language === 'fr' ? 'Actions' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {campaign.scheduledCalls.slice(0, 50).map((call) => (
                  <tr key={call.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4">{call.name || (language === 'fr' ? 'Inconnu' : 'Unknown')}</td>
                    <td className="py-3 px-4 font-mono text-sm">{call.phone}</td>
                    <td className="py-3 px-4 text-sm">{formatDate(call.scheduledAt)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(call.status)}`}>
                        {getStatusLabel(call.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">{call.retryCount}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {/* Call button for pending calls */}
                        {(call.status === 'pending' || call.status === 'no_answer' || call.status === 'failed') && (
                          <button
                            onClick={() => handleMakeCall(call.id, call.phone, call.name)}
                            disabled={callingId !== null}
                            className={`px-2 py-1 rounded text-xs transition ${
                              callingId === call.id
                                ? 'bg-yellow-600 cursor-wait'
                                : callingId
                                ? 'bg-gray-600 cursor-not-allowed'
                                : 'bg-orange-600 hover:bg-orange-500'
                            }`}
                            title={language === 'fr' ? 'Lancer l\'appel' : 'Make call'}
                          >
                            {callingId === call.id
                              ? (language === 'fr' ? 'Appel...' : 'Calling...')
                              : (language === 'fr' ? 'Appeler' : 'Call')}
                          </button>
                        )}
                        {/* Transcript/Audio buttons when call completed */}
                        {call.callLog && (
                          <>
                            {call.callLog.transcript && (
                              <button
                                onClick={() => openTranscriptModal(call.callLog!, call.name || call.phone)}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs transition"
                                title={language === 'fr' ? 'Voir le transcript' : 'View transcript'}
                              >
                                {language === 'fr' ? 'Transcript' : 'Transcript'}
                              </button>
                            )}
                            {call.callLog.audioUrl && (
                              <a
                                href={`/api/conversation/${call.callLog.conversationId}/audio`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs transition"
                                title={language === 'fr' ? 'Écouter l\'enregistrement' : 'Listen to recording'}
                              >
                                {language === 'fr' ? 'Audio' : 'Audio'}
                              </a>
                            )}
                          </>
                        )}
                        {/* Show dash if no actions available */}
                        {!call.callLog && call.status !== 'pending' && call.status !== 'no_answer' && call.status !== 'failed' && (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {campaign.scheduledCalls.length > 50 && (
              <p className="text-gray-400 text-sm text-center py-4">
                {language === 'fr'
                  ? `Affichage des 50 premiers sur ${campaign.scheduledCalls.length} contacts`
                  : `Showing first 50 of ${campaign.scheduledCalls.length} contacts`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('editCampaign', language)}</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-6">
                {/* Campaign Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('campaignName', language)} *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* First Message */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('firstMessage', language)} ({t('firstMessageDesc', language)})</label>
                  <textarea
                    value={editForm.firstMessage}
                    onChange={(e) => setEditForm({ ...editForm, firstMessage: e.target.value })}
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
                    value={editForm.fullPrompt}
                    onChange={(e) => setEditForm({ ...editForm, fullPrompt: e.target.value })}
                    placeholder={t('fullPromptPlaceholder', language)}
                    rows={6}
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
                        onClick={() => toggleEditDay(day.id)}
                        className={`px-3 py-1 rounded-lg transition text-sm ${
                          editForm.callDays.includes(day.id)
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
                      value={editForm.callStartHour}
                      onChange={(e) => setEditForm({ ...editForm, callStartHour: parseInt(e.target.value) })}
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
                      value={editForm.callEndHour}
                      onChange={(e) => setEditForm({ ...editForm, callEndHour: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i}:00</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('priority', language)} (1-10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) || 1 })}
                    className="w-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Voicemail Action */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('voicemailAction', language)}</label>
                  <select
                    value={editForm.voicemailAction}
                    onChange={(e) => setEditForm({ ...editForm, voicemailAction: e.target.value as 'hangup' | 'leave_message' | 'retry' })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="hangup">{t('voicemailHangup', language)}</option>
                    <option value="leave_message">{t('voicemailLeaveMessage', language)}</option>
                    <option value="retry">{t('voicemailRetry', language)}</option>
                  </select>
                </div>

                {/* Voicemail Message (conditional) */}
                {editForm.voicemailAction === 'leave_message' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('voicemailMessage', language)}</label>
                    <textarea
                      value={editForm.voicemailMessage}
                      onChange={(e) => setEditForm({ ...editForm, voicemailMessage: e.target.value })}
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
                    value={editForm.recordingDisclosure}
                    onChange={(e) => setEditForm({ ...editForm, recordingDisclosure: e.target.value })}
                    placeholder={t('recordingDisclosurePlaceholder', language)}
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium transition"
                  >
                    {editLoading ? t('saving', language) : t('save', language)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
                  >
                    {t('cancel', language)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Modal */}
      {showTranscriptModal && selectedTranscript && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">
                  {language === 'fr' ? 'Transcript' : 'Transcript'} - {selectedCallName}
                </h2>
                <button
                  onClick={() => setShowTranscriptModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  &times;
                </button>
              </div>

              {/* Call info */}
              {selectedTranscript.duration && (
                <div className="mb-4 text-sm text-gray-400">
                  {language === 'fr' ? 'Durée' : 'Duration'}: {Math.floor(selectedTranscript.duration / 60)}m {selectedTranscript.duration % 60}s
                  {selectedTranscript.outcome && (
                    <span className="ml-4">
                      {language === 'fr' ? 'Résultat' : 'Outcome'}: {selectedTranscript.outcome}
                    </span>
                  )}
                </div>
              )}

              {/* Transcript content */}
              <div className="bg-gray-900 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                {/* Handle both formats: transcript as array or transcript.transcript as array */}
                {(Array.isArray(selectedTranscript.transcript) ? selectedTranscript.transcript : selectedTranscript.transcript?.transcript) ? (
                  (Array.isArray(selectedTranscript.transcript) ? selectedTranscript.transcript : selectedTranscript.transcript.transcript).map((entry: any, index: number) => (
                    <div key={index} className={`flex gap-3 ${entry.role === 'agent' ? '' : 'flex-row-reverse'}`}>
                      <div className={`px-3 py-2 rounded-lg max-w-[80%] ${
                        entry.role === 'agent'
                          ? 'bg-blue-600/20 text-blue-100'
                          : 'bg-green-600/20 text-green-100'
                      }`}>
                        <div className="text-xs text-gray-400 mb-1">
                          {entry.role === 'agent' ? 'AI' : (language === 'fr' ? 'Client' : 'Client')}
                        </div>
                        <div>{entry.message}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-center">
                    {language === 'fr' ? 'Aucun transcript disponible' : 'No transcript available'}
                  </p>
                )}
              </div>

              {/* Audio link */}
              {selectedTranscript.audioUrl && selectedTranscript.conversationId && (
                <div className="mt-4">
                  <a
                    href={`/api/conversation/${selectedTranscript.conversationId}/audio`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition"
                  >
                    <span>&#9654;</span>
                    {language === 'fr' ? 'Écouter l\'enregistrement' : 'Listen to recording'}
                  </a>
                </div>
              )}

              {/* Close button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowTranscriptModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
                >
                  {language === 'fr' ? 'Fermer' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
