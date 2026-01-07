'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface ScheduledCall {
  id: string
  phone: string
  name: string | null
  firstMessage: string | null
  scheduledAt: string
  status: string
  retryCount: number
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
        setError(data.error || 'Failed to load campaign')
      }
    } catch (err) {
      setError('Failed to load campaign')
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
        setError(data.error || 'Failed to upload CSV')
        if (data.errors) {
          setError(data.errors.join(', '))
        }
      }
    } catch (err) {
      setError('Failed to upload CSV')
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

  if (isAuthenticated === null || loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-400 mb-4">{error || 'Campaign not found'}</div>
          <Link href="/campaigns" className="text-blue-400 hover:underline">
            Back to campaigns
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
    return new Date(dateStr).toLocaleString('en-CA', {
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
              {campaign.status}
            </span>
          </div>
          <p className="text-gray-400">
            {campaign.creatorEmail} &bull; Priority: {campaign.priority}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {(campaign.callDays || []).join(', ') || 'No days set'} &bull; {campaign.callStartHour ?? 9}h-{campaign.callEndHour ?? 19}h ({campaign.timezone || 'America/Toronto'})
          </p>
        </div>
        <div className="flex gap-3">
          {campaign.status === 'active' ? (
            <button
              onClick={() => handleStatusChange('paused')}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition"
            >
              Pause Campaign
            </button>
          ) : campaign.status === 'paused' ? (
            <button
              onClick={() => handleStatusChange('active')}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition"
            >
              Resume Campaign
            </button>
          ) : null}
          <Link
            href="/campaigns"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            Back
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
          <div className="text-gray-400 text-sm">Total Contacts</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-yellow-400">{campaign.stats.pending}</div>
          <div className="text-gray-400 text-sm">Pending</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-400">{campaign.stats.answered}</div>
          <div className="text-gray-400 text-sm">Answered</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-400">{campaign.stats.failed}</div>
          <div className="text-gray-400 text-sm">Failed</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold">{formatDuration(campaign.stats.avgDuration)}</div>
          <div className="text-gray-400 text-sm">Avg Duration</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-800 rounded-lg p-4 mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Campaign Progress</span>
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
        <h2 className="text-xl font-semibold mb-4">Upload Contacts</h2>
        <p className="text-gray-400 text-sm mb-4">
          Upload a CSV file with columns: phone, name, first_message, full_prompt (only phone is required)
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
            {uploading ? 'Uploading...' : 'Choose CSV File'}
          </label>
          {campaign.status !== 'active' && (
            <span className="text-yellow-400 text-sm">Campaign must be active to upload</span>
          )}
        </div>

        {/* Upload result */}
        {uploadResult && (
          <div className="mt-4 p-4 bg-gray-700 rounded-lg">
            <h3 className="font-medium mb-2">Upload Result</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Total in CSV:</span>
                <span className="ml-2">{uploadResult.totalInCsv}</span>
              </div>
              <div>
                <span className="text-gray-400">Added:</span>
                <span className="ml-2 text-green-400">{uploadResult.added}</span>
              </div>
              <div>
                <span className="text-gray-400">Skipped (DNC):</span>
                <span className="ml-2 text-yellow-400">{uploadResult.dncSkipped}</span>
              </div>
              <div>
                <span className="text-gray-400">Duplicates:</span>
                <span className="ml-2 text-gray-400">{uploadResult.duplicateInCampaign + uploadResult.duplicatesInCsv}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scheduled Calls */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Scheduled Calls ({campaign.scheduledCalls.length})
        </h2>

        {campaign.scheduledCalls.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No contacts yet. Upload a CSV to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Phone</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Scheduled</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Retries</th>
                </tr>
              </thead>
              <tbody>
                {campaign.scheduledCalls.slice(0, 50).map((call) => (
                  <tr key={call.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4">{call.name || 'Unknown'}</td>
                    <td className="py-3 px-4 font-mono text-sm">{call.phone}</td>
                    <td className="py-3 px-4 text-sm">{formatDate(call.scheduledAt)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(call.status)}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">{call.retryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {campaign.scheduledCalls.length > 50 && (
              <p className="text-gray-400 text-sm text-center py-4">
                Showing first 50 of {campaign.scheduledCalls.length} contacts
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
