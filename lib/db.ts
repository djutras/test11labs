// lib/db.ts
// Connexion Neon et lookup des clients

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export interface Client {
  id: string
  name: string
  phone: string
  accountant: string
  lastInteraction?: string
}

/**
 * Recherche un client par son numéro de téléphone
 * Le numéro peut être au format +15145551234 ou 5145551234
 */
export async function findClientByPhone(phone: string): Promise<Client | null> {
  try {
    // Normaliser le numéro (enlever espaces, tirets, etc.)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')

    // Chercher avec ou sans le +1
    const result = await sql`
      SELECT id, name, phone, accountant, last_interaction as "lastInteraction"
      FROM clients
      WHERE phone = ${normalizedPhone}
         OR phone = ${normalizedPhone.replace('+1', '')}
         OR phone = ${'+1' + normalizedPhone.replace('+1', '')}
      LIMIT 1
    `

    if (result.length === 0) {
      return null
    }

    return result[0] as Client
  } catch (error) {
    console.error('[DB] Error finding client:', error)
    return null
  }
}

/**
 * Crée la table clients si elle n'existe pas
 */
export async function initializeDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        accountant VARCHAR(255),
        last_interaction TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('[DB] Table clients initialized')
  } catch (error) {
    console.error('[DB] Error initializing database:', error)
  }
}
