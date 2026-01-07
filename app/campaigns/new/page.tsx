'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
  { id: 'sunday', label: 'Sunday' }
]

export default function NewCampaignPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Form state
  const [name, setName] = useState('')
  const [creatorEmail, setCreatorEmail] = useState('')
  const [callDays, setCallDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  const [callStartHour, setCallStartHour] = useState(9)
  const [callEndHour, setCallEndHour] = useState(19)
  const [priority, setPriority] = useState(1)
  const [voicemailAction, setVoicemailAction] = useState<'hangup' | 'leave_message' | 'retry'>('hangup')
  const [voicemailMessage, setVoicemailMessage] = useState('')
  const [recordingDisclosure, setRecordingDisclosure] = useState('This call may be recorded for quality purposes.')

  useEffect(() => {
    const auth = localStorage.getItem('authenticated')
    if (auth !== 'true') {
      router.push('/login')
    } else {
      setIsAuthenticated(true)
    }
  }, [router])

  const toggleDay = (day: string) => {
    if (callDays.includes(day)) {
      setCallDays(callDays.filter(d => d !== day))
    } else {
      setCallDays([...callDays, day])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!name.trim()) {
      setError('Campaign name is required')
      return
    }
    if (!creatorEmail.trim()) {
      setError('Creator email is required')
      return
    }
    if (callDays.length === 0) {
      setError('Select at least one call day')
      return
    }
    if (callStartHour >= callEndHour) {
      setError('Start hour must be before end hour')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          creatorEmail: creatorEmail.trim(),
          callDays,
          callStartHour,
          callEndHour,
          timezone: 'America/Toronto',
          priority,
          voicemailAction,
          voicemailMessage: voicemailAction === 'leave_message' ? voicemailMessage : null,
          recordingDisclosure
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/campaigns/${data.campaign.id}`)
      } else {
        setError(data.error || 'Failed to create campaign')
      }
    } catch (err) {
      setError('Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Create Campaign</h1>
          <p className="text-gray-400 mt-1">Set up a new call campaign</p>
        </div>
        <Link
          href="/campaigns"
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
        >
          Back to Campaigns
        </Link>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-gray-800 rounded-lg p-6 space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Campaign Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., January Client Outreach"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Creator Email */}
          <div>
            <label className="block text-sm font-medium mb-2">Creator Email * (receives notifications)</label>
            <input
              type="email"
              value={creatorEmail}
              onChange={(e) => setCreatorEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Call Days */}
          <div>
            <label className="block text-sm font-medium mb-2">Call Days *</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  className={`px-4 py-2 rounded-lg transition ${
                    callDays.includes(day.id)
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
              <label className="block text-sm font-medium mb-2">Start Hour</label>
              <select
                value={callStartHour}
                onChange={(e) => setCallStartHour(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Hour</label>
              <select
                value={callEndHour}
                onChange={(e) => setCallEndHour(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}:00</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-gray-400 text-sm -mt-4">Timezone: America/Toronto (EST/EDT)</p>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-2">Priority (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
              className="w-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <p className="text-gray-400 text-sm mt-1">Higher priority campaigns call first</p>
          </div>

          {/* Voicemail Action */}
          <div>
            <label className="block text-sm font-medium mb-2">Voicemail Action</label>
            <select
              value={voicemailAction}
              onChange={(e) => setVoicemailAction(e.target.value as 'hangup' | 'leave_message' | 'retry')}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="hangup">Hang up (schedule retry later)</option>
              <option value="leave_message">Leave voicemail message</option>
              <option value="retry">Retry (max 2 voicemail retries)</option>
            </select>
          </div>

          {/* Voicemail Message (conditional) */}
          {voicemailAction === 'leave_message' && (
            <div>
              <label className="block text-sm font-medium mb-2">Voicemail Message</label>
              <textarea
                value={voicemailMessage}
                onChange={(e) => setVoicemailMessage(e.target.value)}
                placeholder="Enter the message to leave on voicemail..."
                rows={3}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Recording Disclosure */}
          <div>
            <label className="block text-sm font-medium mb-2">Recording Disclosure</label>
            <textarea
              value={recordingDisclosure}
              onChange={(e) => setRecordingDisclosure(e.target.value)}
              placeholder="This will be said at the beginning of each call..."
              rows={2}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <p className="text-gray-400 text-sm mt-1">This message is prepended to the first message of each call</p>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium transition"
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
          <Link
            href="/campaigns"
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
