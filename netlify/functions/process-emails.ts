// netlify/functions/process-emails.ts
// Scheduled function to process emails every 2 minutes

import type { Config, Context } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'

  try {
    console.log('[Scheduled] Processing emails...')

    const response = await fetch(`${baseUrl}/api/cron/process-emails`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
      }
    })

    const data = await response.json()
    console.log('[Scheduled] Result:', data)

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Scheduled] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process emails' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Run every 2 minutes
export const config: Config = {
  schedule: '*/2 * * * *'
}
