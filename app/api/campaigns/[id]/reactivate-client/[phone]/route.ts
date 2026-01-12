// app/api/campaigns/[id]/reactivate-client/[phone]/route.ts
// Reactivate paused calls for a specific client

import { NextResponse } from 'next/server'
import { getCampaignById } from '@/lib/db'
import { neon } from '@neondatabase/serverless'

// GET /api/campaigns/[campaignId]/reactivate-client/[phone]
// Reactivates paused calls and shows confirmation page
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; phone: string }> }
) {
  try {
    const { id: campaignId, phone: encodedPhone } = await params
    const phone = decodeURIComponent(encodedPhone)

    // Get campaign info
    const campaign = await getCampaignById(campaignId)
    if (!campaign) {
      return new Response(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h2>Campagne non trouvée</h2>
            <p>La campagne demandée n'existe pas.</p>
          </body>
        </html>
      `, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // Get paused calls for this phone
    // Normalize phone to match with or without + prefix
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`
    const phoneWithoutPlus = phone.replace(/^\+/, '')

    // Create fresh DB connection (not singleton) to avoid serverless caching issues
    const sql = neon(process.env.DATABASE_URL!)

    const pausedCalls = await sql`
      SELECT id, name FROM scheduled_calls
      WHERE campaign_id = ${campaignId}
        AND (phone = ${normalizedPhone} OR phone = ${phoneWithoutPlus})
        AND status = 'paused'
    `

    if (pausedCalls.length === 0) {
      return new Response(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h2>Aucun appel en pause</h2>
            <p>Il n'y a pas d'appels en pause pour ${phone}</p>
            <p>Campagne: ${campaign.name}</p>
            <p><a href="/campaigns/${campaignId}">Retour à la campagne</a></p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    const clientName = pausedCalls[0]?.name || phone

    // Reactivate all paused calls - use RETURNING to verify the update worked
    const updatedCalls = await sql`
      UPDATE scheduled_calls
      SET status = 'pending',
          skipped_reason = NULL,
          updated_at = NOW()
      WHERE campaign_id = ${campaignId}
        AND (phone = ${normalizedPhone} OR phone = ${phoneWithoutPlus})
        AND status = 'paused'
      RETURNING id, name
    `

    // Verify the update actually worked
    if (updatedCalls.length === 0) {
      console.error(`[ReactivateClient] UPDATE returned 0 rows for ${phone} in campaign ${campaignId}`)
      return new Response(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h2 style="color: #f59e0b;">Aucun appel réactivé</h2>
            <p>La mise à jour n'a pas fonctionné. Les appels sont peut-être déjà actifs.</p>
            <p>Phone: ${phone}</p>
            <p>Campagne: ${campaign.name}</p>
            <p><a href="/campaigns/${campaignId}">Voir la campagne</a></p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    console.log(`[ReactivateClient] Reactivated ${updatedCalls.length} calls for ${phone} in campaign ${campaignId}`)

    // Return success page
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Campagne réactivée</title>
        </head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #22c55e;">Campagne réactivée!</h2>
          <p><strong>${updatedCalls.length}</strong> appel(s) réactivé(s) pour <strong>${clientName}</strong></p>
          <p style="color: #666;">Phone: ${phone}</p>
          <p style="color: #666;">Campagne: ${campaign.name}</p>
          <p style="margin-top: 30px;">
            <a href="${baseUrl}/campaigns/${campaignId}"
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Voir la campagne
            </a>
          </p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })

  } catch (error) {
    console.error('[ReactivateClient] Error:', error)
    return new Response(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #ef4444;">Erreur</h2>
          <p>Une erreur est survenue lors de la réactivation.</p>
        </body>
      </html>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
}
