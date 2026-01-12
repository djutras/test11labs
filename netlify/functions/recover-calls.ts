// netlify/functions/recover-calls.ts
// Scheduled function to recover calls that missed webhook processing
// Runs every 15 minutes, fetches transcripts for calls with conversation_id but no transcript

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('[RecoverCalls] Starting scheduled recovery job')

  const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'

  try {
    // Call the Next.js API route that does the actual work
    const response = await fetch(`${baseUrl}/api/cron/recover-calls`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
      }
    })

    const data = await response.json()
    console.log('[RecoverCalls] Result:', JSON.stringify(data))

    return {
      statusCode: response.ok ? 200 : response.status,
      body: JSON.stringify(data)
    }
  } catch (error) {
    console.error('[RecoverCalls] Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to run recovery job', details: String(error) })
    }
  }
}

export { handler }
