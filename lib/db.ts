// lib/db.ts
// Database connection and queries for the call campaign system

import { neon, NeonQueryFunction } from '@neondatabase/serverless'

let sql: NeonQueryFunction<false, false> | null = null

export function getDb() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }
    sql = neon(process.env.DATABASE_URL)
  }
  return sql
}

// ============================================
// INTERFACES
// ============================================

export interface Client {
  id: string
  name: string
  phone: string
  email?: string
  accountant?: string
  lastInteraction?: string
  campaignId?: string
  isActive: boolean
  tags?: string[]
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export interface Campaign {
  id: string
  name: string
  creatorEmail: string
  mode: 'production' | 'test'
  callDays: string[]
  callStartHour: number
  callEndHour: number
  timezone: string
  priority: number
  voicemailAction: 'hangup' | 'leave_message' | 'retry'
  voicemailMessage?: string
  recordingDisclosure: string
  firstMessage?: string
  fullPrompt?: string
  status: 'active' | 'paused' | 'completed'
  callsPerDayPerContact: number  // NEW: How many times to call each contact per day
  campaignDurationDays: number   // NEW: How many days the campaign runs
  createdAt: string
  updatedAt: string
}

export interface ScheduledCall {
  id: string
  campaignId: string
  clientId?: string
  phone: string
  name?: string
  firstMessage?: string
  fullPrompt?: string
  scheduledAt: string
  status: 'pending' | 'calling' | 'in_progress' | 'completed' | 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'invalid' | 'failed' | 'skipped' | 'dnc' | 'paused'
  retryCount: number
  skippedReason?: string
  createdAt: string
}

export interface CallLog {
  id: string
  campaignId?: string
  clientId?: string
  scheduledCallId?: string
  conversationId?: string
  callSid?: string
  direction: 'outbound' | 'inbound'
  phone: string
  duration?: number
  outcome?: 'pending' | 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'invalid' | 'failed'
  transcript?: Record<string, unknown>
  audioUrl?: string
  notes?: string
  reviewStatus: 'pending' | 'reviewed' | 'needs_follow_up'
  emailSent: boolean
  createdAt: string
}

export interface DncEntry {
  id: string
  phone: string
  reason?: string
  addedBy: 'manual' | 'call_opt_out' | 'system'
  campaignId?: string // NULL = global DNC
  createdAt: string
}

// ============================================
// EMAIL CAMPAIGN INTERFACES
// ============================================

export interface EmailCampaign {
  id: string
  name: string
  creatorEmail: string
  subject: string
  body: string
  sendDays: string[]
  sendStartHour: number
  sendEndHour: number
  timezone: string
  campaignDurationDays: number
  status: 'active' | 'paused' | 'completed'
  createdAt: string
  updatedAt: string
}

export interface ScheduledEmail {
  id: string
  emailCampaignId: string
  email: string
  name?: string
  subject: string
  body: string
  scheduledAt: string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  errorMessage?: string
  createdAt: string
}

// ============================================
// SMS CAMPAIGN INTERFACES
// ============================================

export interface SmsCampaign {
  id: string
  name: string
  creatorEmail: string
  message: string
  sendDays: string[]
  sendStartHour: number
  sendEndHour: number
  timezone: string
  frequencyType: 'weekly' | 'monthly'
  frequencyValue: number  // 1-4 weeks or 1-12 months
  status: 'active' | 'paused' | 'completed'
  createdAt: string
  updatedAt: string
}

export interface ScheduledSms {
  id: string
  smsCampaignId: string
  phone: string
  name?: string
  message: string
  scheduledAt: string
  status: 'pending' | 'sent' | 'failed' | 'paused'
  twilioSid?: string
  errorMessage?: string
  createdAt: string
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

export async function initializeDatabase() {
  try {
    const db = getDb()

    // Create outbound_clients table (separate from numeraone clients)
    await db`
      CREATE TABLE IF NOT EXISTS outbound_clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        accountant VARCHAR(255),
        last_interaction TEXT,
        campaign_id UUID,
        is_active BOOLEAN DEFAULT TRUE,
        tags VARCHAR(100)[],
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create campaigns table
    await db`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        creator_email VARCHAR(255) NOT NULL,
        mode VARCHAR(20) DEFAULT 'production',
        call_days VARCHAR(50)[],
        call_start_hour INT DEFAULT 9,
        call_end_hour INT DEFAULT 19,
        timezone VARCHAR(50) DEFAULT 'America/Toronto',
        priority INT DEFAULT 1,
        voicemail_action VARCHAR(20) DEFAULT 'hangup',
        voicemail_message TEXT,
        recording_disclosure TEXT DEFAULT 'Cet appel peut être enregistré à des fins de qualité.',
        first_message TEXT,
        full_prompt TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create scheduled_calls table
    await db`
      CREATE TABLE IF NOT EXISTS scheduled_calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        client_id UUID REFERENCES outbound_clients(id) ON DELETE SET NULL,
        phone VARCHAR(20) NOT NULL,
        name VARCHAR(255),
        first_message TEXT,
        full_prompt TEXT,
        scheduled_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        retry_count INT DEFAULT 0,
        skipped_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create call_logs table
    await db`
      CREATE TABLE IF NOT EXISTS call_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        client_id UUID REFERENCES outbound_clients(id) ON DELETE SET NULL,
        scheduled_call_id UUID REFERENCES scheduled_calls(id) ON DELETE SET NULL,
        conversation_id VARCHAR(255),
        call_sid VARCHAR(255),
        direction VARCHAR(10),
        phone VARCHAR(20),
        duration INT,
        outcome VARCHAR(20),
        transcript JSONB,
        audio_url TEXT,
        notes TEXT,
        review_status VARCHAR(20) DEFAULT 'pending',
        email_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create dnc_list table
    await db`
      CREATE TABLE IF NOT EXISTS dnc_list (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) NOT NULL,
        reason VARCHAR(255),
        added_by VARCHAR(50),
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(phone, campaign_id)
      )
    `

    // Create email_campaigns table
    await db`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        creator_email VARCHAR(255) NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        send_days VARCHAR(50)[],
        send_start_hour INT DEFAULT 9,
        send_end_hour INT DEFAULT 17,
        timezone VARCHAR(50) DEFAULT 'America/Toronto',
        campaign_duration_days INT DEFAULT 5,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create scheduled_emails table
    await db`
      CREATE TABLE IF NOT EXISTS scheduled_emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email_campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        sent_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create sms_campaigns table
    await db`
      CREATE TABLE IF NOT EXISTS sms_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        creator_email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        send_days VARCHAR(50)[],
        send_start_hour INT DEFAULT 9,
        send_end_hour INT DEFAULT 17,
        timezone VARCHAR(50) DEFAULT 'America/Toronto',
        frequency_type VARCHAR(20) DEFAULT 'weekly',
        frequency_value INT DEFAULT 1,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create scheduled_sms table
    await db`
      CREATE TABLE IF NOT EXISTS scheduled_sms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sms_campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE CASCADE,
        phone VARCHAR(20) NOT NULL,
        name VARCHAR(255),
        message TEXT NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        twilio_sid VARCHAR(255),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create indexes for performance
    await db`CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status ON scheduled_calls(status)`
    await db`CREATE INDEX IF NOT EXISTS idx_scheduled_calls_scheduled_at ON scheduled_calls(scheduled_at)`
    await db`CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC)`
    await db`CREATE INDEX IF NOT EXISTS idx_dnc_list_phone ON dnc_list(phone)`
    await db`CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status)`
    await db`CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_at ON scheduled_emails(scheduled_at)`
    await db`CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status)`
    await db`CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status ON sms_campaigns(status)`
    await db`CREATE INDEX IF NOT EXISTS idx_scheduled_sms_status ON scheduled_sms(status)`
    await db`CREATE INDEX IF NOT EXISTS idx_scheduled_sms_scheduled_at ON scheduled_sms(scheduled_at)`

    // Add missing columns to campaigns table (for migrations from older schema)
    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'creator_email') THEN
          ALTER TABLE campaigns ADD COLUMN creator_email VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'call_days') THEN
          ALTER TABLE campaigns ADD COLUMN call_days VARCHAR(50)[];
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'call_start_hour') THEN
          ALTER TABLE campaigns ADD COLUMN call_start_hour INT DEFAULT 9;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'call_end_hour') THEN
          ALTER TABLE campaigns ADD COLUMN call_end_hour INT DEFAULT 19;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'timezone') THEN
          ALTER TABLE campaigns ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/Toronto';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'priority') THEN
          ALTER TABLE campaigns ADD COLUMN priority INT DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'voicemail_action') THEN
          ALTER TABLE campaigns ADD COLUMN voicemail_action VARCHAR(20) DEFAULT 'hangup';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'voicemail_message') THEN
          ALTER TABLE campaigns ADD COLUMN voicemail_message TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'recording_disclosure') THEN
          ALTER TABLE campaigns ADD COLUMN recording_disclosure TEXT DEFAULT 'This call may be recorded for quality purposes.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'status') THEN
          ALTER TABLE campaigns ADD COLUMN status VARCHAR(20) DEFAULT 'active';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'first_message') THEN
          ALTER TABLE campaigns ADD COLUMN first_message TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'full_prompt') THEN
          ALTER TABLE campaigns ADD COLUMN full_prompt TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'mode') THEN
          ALTER TABLE campaigns ADD COLUMN mode VARCHAR(20) DEFAULT 'production';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'calls_per_day_per_contact') THEN
          ALTER TABLE campaigns ADD COLUMN calls_per_day_per_contact INT DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'campaign_duration_days') THEN
          ALTER TABLE campaigns ADD COLUMN campaign_duration_days INT DEFAULT 5;
        END IF;
        -- Make slug column nullable if it exists (legacy column)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'slug') THEN
          ALTER TABLE campaigns ALTER COLUMN slug DROP NOT NULL;
        END IF;
        -- Add updated_at column to scheduled_calls if missing (required for cron job)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'updated_at') THEN
          ALTER TABLE scheduled_calls ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        END IF;
        -- Add email column to outbound_clients if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outbound_clients' AND column_name = 'email') THEN
          ALTER TABLE outbound_clients ADD COLUMN email VARCHAR(255);
        END IF;
      END $$;
    `

    console.log('[DB] All tables initialized')
  } catch (error) {
    console.error('[DB] Error initializing database:', error)
    throw error
  }
}

// ============================================
// CLIENT QUERIES
// ============================================

export async function findClientByPhone(phone: string): Promise<Client | null> {
  try {
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')
    const db = getDb()
    const result = await db`
      SELECT id, name, phone, email, accountant, last_interaction as "lastInteraction",
             campaign_id as "campaignId", is_active as "isActive", tags, notes,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM outbound_clients
      WHERE phone = ${normalizedPhone}
         OR phone = ${normalizedPhone.replace('+1', '')}
         OR phone = ${'+1' + normalizedPhone.replace('+1', '')}
      LIMIT 1
    `
    return result.length > 0 ? result[0] as Client : null
  } catch (error) {
    console.error('[DB] Error finding client:', error)
    return null
  }
}

export async function createClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client | null> {
  try {
    const db = getDb()
    const result = await db`
      INSERT INTO outbound_clients (name, phone, email, accountant, campaign_id, is_active, tags, notes)
      VALUES (${client.name}, ${client.phone}, ${client.email || null}, ${client.accountant || null},
              ${client.campaignId || null}, ${client.isActive ?? true},
              ${client.tags || []}, ${client.notes || null})
      ON CONFLICT (phone) DO UPDATE SET
        name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, outbound_clients.email),
        campaign_id = COALESCE(EXCLUDED.campaign_id, outbound_clients.campaign_id),
        updated_at = NOW()
      RETURNING id, name, phone, email, accountant, campaign_id as "campaignId",
                is_active as "isActive", tags, notes,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result[0] as Client
  } catch (error) {
    console.error('[DB] Error creating client:', error)
    return null
  }
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
  try {
    const db = getDb()
    const result = await db`
      UPDATE outbound_clients SET
        name = COALESCE(${updates.name || null}, name),
        email = COALESCE(${updates.email || null}, email),
        is_active = COALESCE(${updates.isActive ?? null}, is_active),
        tags = COALESCE(${updates.tags || null}, tags),
        notes = COALESCE(${updates.notes || null}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, phone, email, accountant, campaign_id as "campaignId",
                is_active as "isActive", tags, notes,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result.length > 0 ? result[0] as Client : null
  } catch (error) {
    console.error('[DB] Error updating client:', error)
    return null
  }
}

export async function getClientById(id: string): Promise<Client | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, name, phone, email, accountant, last_interaction as "lastInteraction",
             campaign_id as "campaignId", is_active as "isActive", tags, notes,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM outbound_clients WHERE id = ${id}
    `
    return result.length > 0 ? result[0] as Client : null
  } catch (error) {
    console.error('[DB] Error getting client:', error)
    return null
  }
}

// ============================================
// CAMPAIGN QUERIES
// ============================================

export async function createCampaign(campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign> {
  const db = getDb()
  const result = await db`
    INSERT INTO campaigns (name, creator_email, mode, call_days, call_start_hour, call_end_hour,
                          timezone, priority, voicemail_action, voicemail_message,
                          recording_disclosure, first_message, full_prompt, status,
                          calls_per_day_per_contact, campaign_duration_days)
    VALUES (${campaign.name}, ${campaign.creatorEmail}, ${campaign.mode || 'production'}, ${campaign.callDays},
            ${campaign.callStartHour}, ${campaign.callEndHour}, ${campaign.timezone},
            ${campaign.priority}, ${campaign.voicemailAction}, ${campaign.voicemailMessage || null},
            ${campaign.recordingDisclosure}, ${campaign.firstMessage || null}, ${campaign.fullPrompt || null},
            ${campaign.status}, ${campaign.callsPerDayPerContact || 1}, ${campaign.campaignDurationDays || 5})
    RETURNING id, name, creator_email as "creatorEmail", mode, call_days as "callDays",
              call_start_hour as "callStartHour", call_end_hour as "callEndHour",
              timezone, priority, voicemail_action as "voicemailAction",
              voicemail_message as "voicemailMessage", recording_disclosure as "recordingDisclosure",
              first_message as "firstMessage", full_prompt as "fullPrompt",
              status, calls_per_day_per_contact as "callsPerDayPerContact",
              campaign_duration_days as "campaignDurationDays",
              created_at as "createdAt", updated_at as "updatedAt"
  `
  return result[0] as Campaign
}

export async function getCampaigns(): Promise<Campaign[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, name, creator_email as "creatorEmail", mode, call_days as "callDays",
             call_start_hour as "callStartHour", call_end_hour as "callEndHour",
             timezone, priority, voicemail_action as "voicemailAction",
             voicemail_message as "voicemailMessage", recording_disclosure as "recordingDisclosure",
             first_message as "firstMessage", full_prompt as "fullPrompt",
             status, COALESCE(calls_per_day_per_contact, 1) as "callsPerDayPerContact",
             COALESCE(campaign_duration_days, 5) as "campaignDurationDays",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM campaigns
      ORDER BY created_at DESC
    `
    return result as Campaign[]
  } catch (error) {
    console.error('[DB] Error getting campaigns:', error)
    return []
  }
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, name, creator_email as "creatorEmail", mode, call_days as "callDays",
             call_start_hour as "callStartHour", call_end_hour as "callEndHour",
             timezone, priority, voicemail_action as "voicemailAction",
             voicemail_message as "voicemailMessage", recording_disclosure as "recordingDisclosure",
             first_message as "firstMessage", full_prompt as "fullPrompt",
             status, COALESCE(calls_per_day_per_contact, 1) as "callsPerDayPerContact",
             COALESCE(campaign_duration_days, 5) as "campaignDurationDays",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM campaigns WHERE id = ${id}
    `
    return result.length > 0 ? result[0] as Campaign : null
  } catch (error) {
    console.error('[DB] Error getting campaign:', error)
    return null
  }
}

export async function updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | null> {
  try {
    const db = getDb()
    const result = await db`
      UPDATE campaigns SET
        name = COALESCE(${updates.name || null}, name),
        mode = COALESCE(${updates.mode || null}, mode),
        call_days = COALESCE(${updates.callDays || null}, call_days),
        call_start_hour = COALESCE(${updates.callStartHour ?? null}, call_start_hour),
        call_end_hour = COALESCE(${updates.callEndHour ?? null}, call_end_hour),
        priority = COALESCE(${updates.priority ?? null}, priority),
        voicemail_action = COALESCE(${updates.voicemailAction || null}, voicemail_action),
        voicemail_message = COALESCE(${updates.voicemailMessage || null}, voicemail_message),
        recording_disclosure = COALESCE(${updates.recordingDisclosure || null}, recording_disclosure),
        first_message = COALESCE(${updates.firstMessage || null}, first_message),
        full_prompt = COALESCE(${updates.fullPrompt || null}, full_prompt),
        status = COALESCE(${updates.status || null}, status),
        calls_per_day_per_contact = COALESCE(${updates.callsPerDayPerContact ?? null}, calls_per_day_per_contact),
        campaign_duration_days = COALESCE(${updates.campaignDurationDays ?? null}, campaign_duration_days),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, creator_email as "creatorEmail", mode, call_days as "callDays",
                call_start_hour as "callStartHour", call_end_hour as "callEndHour",
                timezone, priority, voicemail_action as "voicemailAction",
                voicemail_message as "voicemailMessage", recording_disclosure as "recordingDisclosure",
                first_message as "firstMessage", full_prompt as "fullPrompt",
                status, COALESCE(calls_per_day_per_contact, 1) as "callsPerDayPerContact",
                COALESCE(campaign_duration_days, 5) as "campaignDurationDays",
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result.length > 0 ? result[0] as Campaign : null
  } catch (error) {
    console.error('[DB] Error updating campaign:', error)
    return null
  }
}

export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    const db = getDb()
    await db`DELETE FROM campaigns WHERE id = ${id}`
    return true
  } catch (error) {
    console.error('[DB] Error deleting campaign:', error)
    return false
  }
}

export async function getCampaignStats(campaignId: string): Promise<{
  totalContacts: number
  pending: number
  completed: number
  answered: number
  failed: number
  avgDuration: number
}> {
  try {
    const db = getDb()
    const stats = await db`
      SELECT
        COUNT(*) as "totalContacts",
        COUNT(*) FILTER (WHERE status = 'pending') as "pending",
        COUNT(*) FILTER (WHERE status IN ('completed', 'answered', 'voicemail', 'no_answer', 'busy', 'invalid', 'failed')) as "completed",
        COUNT(*) FILTER (WHERE status = 'answered') as "answered",
        COUNT(*) FILTER (WHERE status IN ('failed', 'invalid')) as "failed"
      FROM scheduled_calls
      WHERE campaign_id = ${campaignId}
    `

    const durationStats = await db`
      SELECT COALESCE(AVG(duration), 0) as "avgDuration"
      FROM call_logs
      WHERE campaign_id = ${campaignId} AND duration IS NOT NULL
    `

    return {
      totalContacts: Number(stats[0]?.totalContacts || 0),
      pending: Number(stats[0]?.pending || 0),
      completed: Number(stats[0]?.completed || 0),
      answered: Number(stats[0]?.answered || 0),
      failed: Number(stats[0]?.failed || 0),
      avgDuration: Number(durationStats[0]?.avgDuration || 0)
    }
  } catch (error) {
    console.error('[DB] Error getting campaign stats:', error)
    return { totalContacts: 0, pending: 0, completed: 0, answered: 0, failed: 0, avgDuration: 0 }
  }
}

// ============================================
// SCHEDULED CALLS QUERIES
// ============================================

export async function createScheduledCall(call: Omit<ScheduledCall, 'id' | 'createdAt'>): Promise<ScheduledCall | null> {
  try {
    const db = getDb()
    const result = await db`
      INSERT INTO scheduled_calls (campaign_id, client_id, phone, name, first_message,
                                   full_prompt, scheduled_at, status, retry_count)
      VALUES (${call.campaignId}, ${call.clientId || null}, ${call.phone}, ${call.name || null},
              ${call.firstMessage || null}, ${call.fullPrompt || null}, ${call.scheduledAt},
              ${call.status}, ${call.retryCount})
      RETURNING id, campaign_id as "campaignId", client_id as "clientId", phone, name,
                first_message as "firstMessage", full_prompt as "fullPrompt",
                scheduled_at as "scheduledAt", status, retry_count as "retryCount",
                skipped_reason as "skippedReason", created_at as "createdAt"
    `
    return result[0] as ScheduledCall
  } catch (error) {
    console.error('[DB] Error creating scheduled call:', error)
    return null
  }
}

export async function getNextPendingCall(): Promise<ScheduledCall | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT sc.id, sc.campaign_id as "campaignId", sc.client_id as "clientId", sc.phone, sc.name,
             sc.first_message as "firstMessage", sc.full_prompt as "fullPrompt",
             sc.scheduled_at as "scheduledAt", sc.status, sc.retry_count as "retryCount",
             sc.skipped_reason as "skippedReason", sc.created_at as "createdAt"
      FROM scheduled_calls sc
      JOIN campaigns c ON sc.campaign_id = c.id
      WHERE sc.status = 'pending'
        AND sc.scheduled_at <= NOW()
        AND c.status = 'active'
      ORDER BY c.priority DESC, sc.scheduled_at ASC
      LIMIT 1
    `
    return result.length > 0 ? result[0] as ScheduledCall : null
  } catch (error) {
    console.error('[DB] Error getting next pending call:', error)
    return null
  }
}

export async function updateScheduledCall(id: string, updates: Partial<ScheduledCall>): Promise<ScheduledCall | null> {
  try {
    const db = getDb()
    const result = await db`
      UPDATE scheduled_calls SET
        status = COALESCE(${updates.status || null}, status),
        retry_count = COALESCE(${updates.retryCount ?? null}, retry_count),
        skipped_reason = COALESCE(${updates.skippedReason || null}, skipped_reason),
        scheduled_at = COALESCE(${updates.scheduledAt || null}, scheduled_at),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, campaign_id as "campaignId", client_id as "clientId", phone, name,
                first_message as "firstMessage", full_prompt as "fullPrompt",
                scheduled_at as "scheduledAt", status, retry_count as "retryCount",
                skipped_reason as "skippedReason", created_at as "createdAt"
    `
    return result.length > 0 ? result[0] as ScheduledCall : null
  } catch (error) {
    console.error('[DB] Error updating scheduled call:', error)
    return null
  }
}

export async function getScheduledCallsByCampaign(campaignId: string): Promise<(ScheduledCall & { email?: string })[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT sc.id, sc.campaign_id as "campaignId", sc.client_id as "clientId", sc.phone, sc.name,
             sc.first_message as "firstMessage", sc.full_prompt as "fullPrompt",
             sc.scheduled_at as "scheduledAt", sc.status, sc.retry_count as "retryCount",
             sc.skipped_reason as "skippedReason", sc.created_at as "createdAt",
             oc.email
      FROM scheduled_calls sc
      LEFT JOIN outbound_clients oc ON sc.phone = oc.phone
      WHERE sc.campaign_id = ${campaignId}
      ORDER BY sc.scheduled_at ASC
    `
    return result as (ScheduledCall & { email?: string })[]
  } catch (error) {
    console.error('[DB] Error getting scheduled calls:', error)
    return []
  }
}

export async function getUpcomingCalls(limit: number = 50): Promise<(ScheduledCall & { campaignName: string })[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT sc.id, sc.campaign_id as "campaignId", sc.client_id as "clientId", sc.phone, sc.name,
             sc.first_message as "firstMessage", sc.full_prompt as "fullPrompt",
             sc.scheduled_at as "scheduledAt", sc.status, sc.retry_count as "retryCount",
             sc.skipped_reason as "skippedReason", sc.created_at as "createdAt",
             c.name as "campaignName"
      FROM scheduled_calls sc
      JOIN campaigns c ON sc.campaign_id = c.id
      WHERE sc.status = 'pending'
      ORDER BY sc.scheduled_at ASC
      LIMIT ${limit}
    `
    return result as (ScheduledCall & { campaignName: string })[]
  } catch (error) {
    console.error('[DB] Error getting upcoming calls:', error)
    return []
  }
}

export async function hasCallInProgress(): Promise<boolean> {
  try {
    const db = getDb()
    const result = await db`
      SELECT COUNT(*) as count FROM scheduled_calls WHERE status = 'in_progress'
    `
    return Number(result[0]?.count || 0) > 0
  } catch (error) {
    console.error('[DB] Error checking in progress calls:', error)
    return false
  }
}

export async function getScheduledCallById(id: string): Promise<ScheduledCall | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, campaign_id as "campaignId", client_id as "clientId", phone, name,
             first_message as "firstMessage", full_prompt as "fullPrompt",
             scheduled_at as "scheduledAt", status, retry_count as "retryCount",
             skipped_reason as "skippedReason", created_at as "createdAt"
      FROM scheduled_calls WHERE id = ${id}
    `
    return result.length > 0 ? result[0] as ScheduledCall : null
  } catch (error) {
    console.error('[DB] Error getting scheduled call:', error)
    return null
  }
}

// ============================================
// CALL LOGS QUERIES
// ============================================

export async function createCallLog(log: Omit<CallLog, 'id' | 'createdAt'>): Promise<CallLog | null> {
  try {
    const db = getDb()
    const result = await db`
      INSERT INTO call_logs (campaign_id, client_id, scheduled_call_id, conversation_id,
                            call_sid, direction, phone, duration, outcome, transcript,
                            audio_url, notes, review_status, email_sent)
      VALUES (${log.campaignId || null}, ${log.clientId || null}, ${log.scheduledCallId || null},
              ${log.conversationId || null}, ${log.callSid || null}, ${log.direction},
              ${log.phone}, ${log.duration || null}, ${log.outcome || null},
              ${log.transcript ? JSON.stringify(log.transcript) : null}, ${log.audioUrl || null},
              ${log.notes || null}, ${log.reviewStatus}, ${log.emailSent})
      RETURNING id, campaign_id as "campaignId", client_id as "clientId",
                scheduled_call_id as "scheduledCallId", conversation_id as "conversationId",
                call_sid as "callSid", direction, phone, duration, outcome, transcript,
                audio_url as "audioUrl", notes, review_status as "reviewStatus",
                email_sent as "emailSent", created_at as "createdAt"
    `
    return result[0] as CallLog
  } catch (error) {
    console.error('[DB] Error creating call log:', error)
    return null
  }
}

export async function getCallLogs(options: {
  limit?: number
  offset?: number
  campaignId?: string
  search?: string
  outcome?: string
  reviewStatus?: string
}): Promise<{ logs: CallLog[], total: number }> {
  try {
    const db = getDb()
    const limit = options.limit || 50
    const offset = options.offset || 0

    let whereClause = 'WHERE 1=1'
    if (options.campaignId) whereClause += ` AND cl.campaign_id = '${options.campaignId}'`
    if (options.outcome) whereClause += ` AND cl.outcome = '${options.outcome}'`
    if (options.reviewStatus) whereClause += ` AND cl.review_status = '${options.reviewStatus}'`

    // For search, we need parameterized query
    const result = await db`
      SELECT cl.id, cl.campaign_id as "campaignId", cl.client_id as "clientId",
             cl.scheduled_call_id as "scheduledCallId", cl.conversation_id as "conversationId",
             cl.call_sid as "callSid", cl.direction, cl.phone, cl.duration, cl.outcome,
             cl.transcript, cl.audio_url as "audioUrl", cl.notes,
             cl.review_status as "reviewStatus", cl.email_sent as "emailSent",
             cl.created_at as "createdAt",
             c.name as "clientName", camp.name as "campaignName"
      FROM call_logs cl
      LEFT JOIN outbound_clients c ON cl.client_id = c.id
      LEFT JOIN campaigns camp ON cl.campaign_id = camp.id
      WHERE (${options.campaignId || null}::uuid IS NULL OR cl.campaign_id = ${options.campaignId || null})
        AND (${options.outcome || null} IS NULL OR cl.outcome = ${options.outcome || null})
        AND (${options.reviewStatus || null} IS NULL OR cl.review_status = ${options.reviewStatus || null})
        AND (${options.search || null} IS NULL OR
             c.name ILIKE ${'%' + (options.search || '') + '%'} OR
             cl.phone ILIKE ${'%' + (options.search || '') + '%'})
      ORDER BY cl.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const countResult = await db`
      SELECT COUNT(*) as total
      FROM call_logs cl
      LEFT JOIN outbound_clients c ON cl.client_id = c.id
      WHERE (${options.campaignId || null}::uuid IS NULL OR cl.campaign_id = ${options.campaignId || null})
        AND (${options.outcome || null} IS NULL OR cl.outcome = ${options.outcome || null})
        AND (${options.reviewStatus || null} IS NULL OR cl.review_status = ${options.reviewStatus || null})
        AND (${options.search || null} IS NULL OR
             c.name ILIKE ${'%' + (options.search || '') + '%'} OR
             cl.phone ILIKE ${'%' + (options.search || '') + '%'})
    `

    return {
      logs: result as CallLog[],
      total: Number(countResult[0]?.total || 0)
    }
  } catch (error) {
    console.error('[DB] Error getting call logs:', error)
    return { logs: [], total: 0 }
  }
}

export async function getCallLogById(id: string): Promise<CallLog | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, campaign_id as "campaignId", client_id as "clientId",
             scheduled_call_id as "scheduledCallId", conversation_id as "conversationId",
             call_sid as "callSid", direction, phone, duration, outcome, transcript,
             audio_url as "audioUrl", notes, review_status as "reviewStatus",
             email_sent as "emailSent", created_at as "createdAt"
      FROM call_logs WHERE id = ${id}
    `
    return result.length > 0 ? result[0] as CallLog : null
  } catch (error) {
    console.error('[DB] Error getting call log:', error)
    return null
  }
}

export async function updateCallLog(id: string, updates: Partial<CallLog>): Promise<CallLog | null> {
  try {
    const db = getDb()
    const result = await db`
      UPDATE call_logs SET
        transcript = COALESCE(${updates.transcript ? JSON.stringify(updates.transcript) : null}, transcript),
        audio_url = COALESCE(${updates.audioUrl || null}, audio_url),
        duration = COALESCE(${updates.duration ?? null}, duration),
        outcome = COALESCE(${updates.outcome || null}, outcome),
        notes = COALESCE(${updates.notes || null}, notes),
        review_status = COALESCE(${updates.reviewStatus || null}, review_status),
        email_sent = COALESCE(${updates.emailSent ?? null}, email_sent)
      WHERE id = ${id}
      RETURNING id, campaign_id as "campaignId", client_id as "clientId",
                scheduled_call_id as "scheduledCallId", conversation_id as "conversationId",
                call_sid as "callSid", direction, phone, duration, outcome, transcript,
                audio_url as "audioUrl", notes, review_status as "reviewStatus",
                email_sent as "emailSent", created_at as "createdAt"
    `
    return result.length > 0 ? result[0] as CallLog : null
  } catch (error) {
    console.error('[DB] Error updating call log:', error)
    return null
  }
}

export async function getClientCallHistory(clientId: string): Promise<CallLog[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, campaign_id as "campaignId", client_id as "clientId",
             scheduled_call_id as "scheduledCallId", conversation_id as "conversationId",
             call_sid as "callSid", direction, phone, duration, outcome, transcript,
             audio_url as "audioUrl", notes, review_status as "reviewStatus",
             email_sent as "emailSent", created_at as "createdAt"
      FROM call_logs
      WHERE client_id = ${clientId}
      ORDER BY created_at DESC
    `
    return result as CallLog[]
  } catch (error) {
    console.error('[DB] Error getting client call history:', error)
    return []
  }
}

export async function getCallLogsByCampaign(campaignId: string): Promise<CallLog[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, campaign_id as "campaignId", client_id as "clientId",
             scheduled_call_id as "scheduledCallId", conversation_id as "conversationId",
             call_sid as "callSid", direction, phone, duration, outcome, transcript,
             audio_url as "audioUrl", notes, review_status as "reviewStatus",
             email_sent as "emailSent", created_at as "createdAt"
      FROM call_logs
      WHERE campaign_id = ${campaignId}
      ORDER BY created_at DESC
    `
    return result as CallLog[]
  } catch (error) {
    console.error('[DB] Error getting campaign call logs:', error)
    return []
  }
}

export async function getCallLogByScheduledCallId(scheduledCallId: string): Promise<CallLog | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, campaign_id as "campaignId", client_id as "clientId",
             scheduled_call_id as "scheduledCallId", conversation_id as "conversationId",
             call_sid as "callSid", direction, phone, duration, outcome, transcript,
             audio_url as "audioUrl", notes, review_status as "reviewStatus",
             email_sent as "emailSent", created_at as "createdAt"
      FROM call_logs
      WHERE scheduled_call_id = ${scheduledCallId}
      LIMIT 1
    `
    return result.length > 0 ? result[0] as CallLog : null
  } catch (error) {
    console.error('[DB] Error getting call log by scheduled call:', error)
    return null
  }
}

export async function getCallLogByConversationId(conversationId: string): Promise<CallLog | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, campaign_id as "campaignId", client_id as "clientId",
             scheduled_call_id as "scheduledCallId", conversation_id as "conversationId",
             call_sid as "callSid", direction, phone, duration, outcome, transcript,
             audio_url as "audioUrl", notes, review_status as "reviewStatus",
             email_sent as "emailSent", created_at as "createdAt"
      FROM call_logs
      WHERE conversation_id = ${conversationId}
      LIMIT 1
    `
    return result.length > 0 ? result[0] as CallLog : null
  } catch (error) {
    console.error('[DB] Error getting call log by conversation ID:', error)
    return null
  }
}

// ============================================
// DNC (DO NOT CALL) QUERIES
// ============================================

export async function addToDnc(entry: Omit<DncEntry, 'id' | 'createdAt'>): Promise<DncEntry | null> {
  try {
    const db = getDb()
    const normalizedPhone = entry.phone.replace(/[\s\-\(\)]/g, '')
    const result = await db`
      INSERT INTO dnc_list (phone, reason, added_by, campaign_id)
      VALUES (${normalizedPhone}, ${entry.reason || null}, ${entry.addedBy}, ${entry.campaignId || null})
      ON CONFLICT (phone, campaign_id) DO NOTHING
      RETURNING id, phone, reason, added_by as "addedBy", campaign_id as "campaignId",
                created_at as "createdAt"
    `
    return result.length > 0 ? result[0] as DncEntry : null
  } catch (error) {
    console.error('[DB] Error adding to DNC:', error)
    return null
  }
}

export async function isPhoneOnDnc(phone: string, campaignId?: string): Promise<boolean> {
  try {
    const db = getDb()
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')
    const result = await db`
      SELECT COUNT(*) as count FROM dnc_list
      WHERE (phone = ${normalizedPhone}
             OR phone = ${normalizedPhone.replace('+1', '')}
             OR phone = ${'+1' + normalizedPhone.replace('+1', '')})
        AND (campaign_id IS NULL OR campaign_id = ${campaignId || null})
    `
    return Number(result[0]?.count || 0) > 0
  } catch (error) {
    console.error('[DB] Error checking DNC:', error)
    return false
  }
}

export async function getDncList(options?: { campaignId?: string, search?: string }): Promise<DncEntry[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, phone, reason, added_by as "addedBy", campaign_id as "campaignId",
             created_at as "createdAt"
      FROM dnc_list
      WHERE (${options?.campaignId || null}::uuid IS NULL OR campaign_id = ${options?.campaignId || null} OR campaign_id IS NULL)
        AND (${options?.search || null} IS NULL OR phone ILIKE ${'%' + (options?.search || '') + '%'})
      ORDER BY created_at DESC
    `
    return result as DncEntry[]
  } catch (error) {
    console.error('[DB] Error getting DNC list:', error)
    return []
  }
}

export async function removeFromDnc(phone: string, campaignId?: string): Promise<boolean> {
  try {
    const db = getDb()
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')
    await db`
      DELETE FROM dnc_list
      WHERE (phone = ${normalizedPhone}
             OR phone = ${normalizedPhone.replace('+1', '')}
             OR phone = ${'+1' + normalizedPhone.replace('+1', '')})
        AND (${campaignId || null}::uuid IS NULL OR campaign_id = ${campaignId || null})
    `
    return true
  } catch (error) {
    console.error('[DB] Error removing from DNC:', error)
    return false
  }
}

// ============================================
// CLIENT HISTORY QUERIES
// ============================================

export async function getClientCallHistoryByPhone(campaignId: string, phone: string): Promise<{
  clientName: string
  phone: string
  campaignName: string
  scheduledCalls: Array<{
    id: string
    scheduledAt: string
    status: string
    retryCount: number
    createdAt: string
  }>
  callLogs: CallLog[]
} | null> {
  try {
    const db = getDb()

    // Get campaign name
    const campaigns = await db`
      SELECT name FROM campaigns WHERE id = ${campaignId}
    `
    const campaignName = campaigns[0]?.name || 'Unknown Campaign'

    // Get all scheduled calls for this phone in this campaign
    const scheduledCalls = await db`
      SELECT id, name, phone, scheduled_at as "scheduledAt", status,
             retry_count as "retryCount", created_at as "createdAt"
      FROM scheduled_calls
      WHERE campaign_id = ${campaignId} AND phone = ${phone}
      ORDER BY created_at DESC
    `

    if (scheduledCalls.length === 0) {
      return null
    }

    const clientName = scheduledCalls[0].name || 'Unknown'
    const scheduledCallIds = scheduledCalls.map((sc: any) => sc.id)

    // Get all call logs for these scheduled calls
    const callLogs = await db`
      SELECT id, campaign_id as "campaignId", client_id as "clientId",
             scheduled_call_id as "scheduledCallId", conversation_id as "conversationId",
             call_sid as "callSid", direction, phone, duration, outcome, transcript,
             audio_url as "audioUrl", notes, review_status as "reviewStatus",
             email_sent as "emailSent", created_at as "createdAt"
      FROM call_logs
      WHERE scheduled_call_id = ANY(${scheduledCallIds})
      ORDER BY created_at DESC
    `

    return {
      clientName,
      phone,
      campaignName,
      scheduledCalls: scheduledCalls.map((sc: any) => ({
        id: sc.id,
        scheduledAt: sc.scheduledAt,
        status: sc.status,
        retryCount: sc.retryCount,
        createdAt: sc.createdAt
      })),
      callLogs: callLogs as CallLog[]
    }
  } catch (error) {
    console.error('[DB] Error getting client call history:', error)
    return null
  }
}

// Get future scheduled calls for a client by phone
export async function getClientFutureCallsByPhone(campaignId: string, phone: string): Promise<{
  clientName: string
  phone: string
  campaignName: string
  futureCalls: Array<{
    id: string
    scheduledAt: string
    status: string
    retryCount: number
    createdAt: string
    manuallyReactivated: boolean
  }>
} | null> {
  try {
    const db = getDb()

    // Get campaign name
    const campaigns = await db`
      SELECT name FROM campaigns WHERE id = ${campaignId}
    `
    const campaignName = campaigns[0]?.name || 'Unknown Campaign'

    // Get all future scheduled calls for this phone in this campaign
    const futureCalls = await db`
      SELECT id, name, phone, scheduled_at as "scheduledAt", status,
             retry_count as "retryCount", created_at as "createdAt"
      FROM scheduled_calls
      WHERE campaign_id = ${campaignId}
        AND phone = ${phone}
        AND (status = 'pending' OR scheduled_at > NOW())
      ORDER BY scheduled_at ASC
    `

    if (futureCalls.length === 0) {
      // Still return client info even if no future calls
      const anyCall = await db`
        SELECT name FROM scheduled_calls
        WHERE campaign_id = ${campaignId} AND phone = ${phone}
        LIMIT 1
      `
      const clientName = anyCall[0]?.name || 'Unknown'

      return {
        clientName,
        phone,
        campaignName,
        futureCalls: []
      }
    }

    const clientName = futureCalls[0].name || 'Unknown'

    return {
      clientName,
      phone,
      campaignName,
      futureCalls: futureCalls.map((fc: any) => ({
        id: fc.id,
        scheduledAt: fc.scheduledAt,
        status: fc.status,
        retryCount: fc.retryCount,
        createdAt: fc.createdAt,
        manuallyReactivated: fc.manuallyReactivated ?? false
      }))
    }
  } catch (error) {
    console.error('[DB] Error getting future calls:', error)
    return null
  }
}

// ============================================
// EMAIL CAMPAIGN QUERIES
// ============================================

export async function createEmailCampaign(campaign: Omit<EmailCampaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailCampaign> {
  const db = getDb()
  const result = await db`
    INSERT INTO email_campaigns (name, creator_email, subject, body, send_days,
                                  send_start_hour, send_end_hour, timezone,
                                  campaign_duration_days, status)
    VALUES (${campaign.name}, ${campaign.creatorEmail}, ${campaign.subject}, ${campaign.body},
            ${campaign.sendDays}, ${campaign.sendStartHour}, ${campaign.sendEndHour},
            ${campaign.timezone}, ${campaign.campaignDurationDays}, ${campaign.status})
    RETURNING id, name, creator_email as "creatorEmail", subject, body,
              send_days as "sendDays", send_start_hour as "sendStartHour",
              send_end_hour as "sendEndHour", timezone,
              campaign_duration_days as "campaignDurationDays", status,
              created_at as "createdAt", updated_at as "updatedAt"
  `
  return result[0] as EmailCampaign
}

export async function getEmailCampaigns(): Promise<EmailCampaign[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, name, creator_email as "creatorEmail", subject, body,
             send_days as "sendDays", send_start_hour as "sendStartHour",
             send_end_hour as "sendEndHour", timezone,
             campaign_duration_days as "campaignDurationDays", status,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM email_campaigns
      ORDER BY created_at DESC
    `
    return result as EmailCampaign[]
  } catch (error) {
    console.error('[DB] Error getting email campaigns:', error)
    return []
  }
}

export async function getEmailCampaignById(id: string): Promise<EmailCampaign | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, name, creator_email as "creatorEmail", subject, body,
             send_days as "sendDays", send_start_hour as "sendStartHour",
             send_end_hour as "sendEndHour", timezone,
             campaign_duration_days as "campaignDurationDays", status,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM email_campaigns WHERE id = ${id}
    `
    return result.length > 0 ? result[0] as EmailCampaign : null
  } catch (error) {
    console.error('[DB] Error getting email campaign:', error)
    return null
  }
}

export async function updateEmailCampaign(id: string, updates: Partial<EmailCampaign>): Promise<EmailCampaign | null> {
  try {
    const db = getDb()
    const result = await db`
      UPDATE email_campaigns SET
        name = COALESCE(${updates.name || null}, name),
        subject = COALESCE(${updates.subject || null}, subject),
        body = COALESCE(${updates.body || null}, body),
        send_days = COALESCE(${updates.sendDays || null}, send_days),
        send_start_hour = COALESCE(${updates.sendStartHour ?? null}, send_start_hour),
        send_end_hour = COALESCE(${updates.sendEndHour ?? null}, send_end_hour),
        campaign_duration_days = COALESCE(${updates.campaignDurationDays ?? null}, campaign_duration_days),
        status = COALESCE(${updates.status || null}, status),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, creator_email as "creatorEmail", subject, body,
                send_days as "sendDays", send_start_hour as "sendStartHour",
                send_end_hour as "sendEndHour", timezone,
                campaign_duration_days as "campaignDurationDays", status,
                created_at as "createdAt", updated_at as "updatedAt"
    `
    return result.length > 0 ? result[0] as EmailCampaign : null
  } catch (error) {
    console.error('[DB] Error updating email campaign:', error)
    return null
  }
}

export async function deleteEmailCampaign(id: string): Promise<boolean> {
  try {
    const db = getDb()
    await db`DELETE FROM email_campaigns WHERE id = ${id}`
    return true
  } catch (error) {
    console.error('[DB] Error deleting email campaign:', error)
    return false
  }
}

export async function getEmailCampaignStats(campaignId: string): Promise<{
  totalEmails: number
  pending: number
  sent: number
  failed: number
}> {
  try {
    const db = getDb()
    const stats = await db`
      SELECT
        COUNT(*) as "totalEmails",
        COUNT(*) FILTER (WHERE status = 'pending') as "pending",
        COUNT(*) FILTER (WHERE status = 'sent') as "sent",
        COUNT(*) FILTER (WHERE status = 'failed') as "failed"
      FROM scheduled_emails
      WHERE email_campaign_id = ${campaignId}
    `
    return {
      totalEmails: Number(stats[0]?.totalEmails || 0),
      pending: Number(stats[0]?.pending || 0),
      sent: Number(stats[0]?.sent || 0),
      failed: Number(stats[0]?.failed || 0)
    }
  } catch (error) {
    console.error('[DB] Error getting email campaign stats:', error)
    return { totalEmails: 0, pending: 0, sent: 0, failed: 0 }
  }
}

// ============================================
// SCHEDULED EMAIL QUERIES
// ============================================

export async function createScheduledEmail(email: Omit<ScheduledEmail, 'id' | 'createdAt'>): Promise<ScheduledEmail | null> {
  try {
    const db = getDb()
    const result = await db`
      INSERT INTO scheduled_emails (email_campaign_id, email, name, subject, body,
                                     scheduled_at, status)
      VALUES (${email.emailCampaignId}, ${email.email}, ${email.name || null},
              ${email.subject}, ${email.body}, ${email.scheduledAt}, ${email.status})
      RETURNING id, email_campaign_id as "emailCampaignId", email, name, subject, body,
                scheduled_at as "scheduledAt", status, sent_at as "sentAt",
                error_message as "errorMessage", created_at as "createdAt"
    `
    return result[0] as ScheduledEmail
  } catch (error) {
    console.error('[DB] Error creating scheduled email:', error)
    return null
  }
}

export async function getScheduledEmailsByCampaign(campaignId: string): Promise<ScheduledEmail[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, email_campaign_id as "emailCampaignId", email, name, subject, body,
             scheduled_at as "scheduledAt", status, sent_at as "sentAt",
             error_message as "errorMessage", created_at as "createdAt"
      FROM scheduled_emails
      WHERE email_campaign_id = ${campaignId}
      ORDER BY scheduled_at ASC
    `
    return result as ScheduledEmail[]
  } catch (error) {
    console.error('[DB] Error getting scheduled emails:', error)
    return []
  }
}

export async function getNextPendingEmail(): Promise<ScheduledEmail | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT se.id, se.email_campaign_id as "emailCampaignId", se.email, se.name,
             se.subject, se.body, se.scheduled_at as "scheduledAt", se.status,
             se.sent_at as "sentAt", se.error_message as "errorMessage",
             se.created_at as "createdAt"
      FROM scheduled_emails se
      JOIN email_campaigns ec ON se.email_campaign_id = ec.id
      WHERE se.status = 'pending'
        AND se.scheduled_at <= NOW()
        AND ec.status = 'active'
      ORDER BY se.scheduled_at ASC
      LIMIT 1
    `
    return result.length > 0 ? result[0] as ScheduledEmail : null
  } catch (error) {
    console.error('[DB] Error getting next pending email:', error)
    return null
  }
}

export async function updateScheduledEmail(id: string, updates: Partial<ScheduledEmail>): Promise<ScheduledEmail | null> {
  try {
    const db = getDb()
    const result = await db`
      UPDATE scheduled_emails SET
        status = COALESCE(${updates.status || null}, status),
        sent_at = COALESCE(${updates.sentAt || null}, sent_at),
        error_message = COALESCE(${updates.errorMessage || null}, error_message)
      WHERE id = ${id}
      RETURNING id, email_campaign_id as "emailCampaignId", email, name, subject, body,
                scheduled_at as "scheduledAt", status, sent_at as "sentAt",
                error_message as "errorMessage", created_at as "createdAt"
    `
    return result.length > 0 ? result[0] as ScheduledEmail : null
  } catch (error) {
    console.error('[DB] Error updating scheduled email:', error)
    return null
  }
}

export async function getPendingEmailsToSend(limit: number = 10): Promise<ScheduledEmail[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT se.id, se.email_campaign_id as "emailCampaignId", se.email, se.name,
             se.subject, se.body, se.scheduled_at as "scheduledAt", se.status,
             se.sent_at as "sentAt", se.error_message as "errorMessage",
             se.created_at as "createdAt"
      FROM scheduled_emails se
      JOIN email_campaigns ec ON se.email_campaign_id = ec.id
      WHERE se.status = 'pending'
        AND se.scheduled_at <= NOW()
        AND ec.status = 'active'
      ORDER BY se.scheduled_at ASC
      LIMIT ${limit}
    `
    return result as ScheduledEmail[]
  } catch (error) {
    console.error('[DB] Error getting pending emails:', error)
    return []
  }
}

// ============================================
// SMS CAMPAIGN QUERIES
// ============================================

export async function createSmsCampaign(campaign: Omit<SmsCampaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<SmsCampaign> {
  const db = getDb()
  const result = await db`
    INSERT INTO sms_campaigns (name, creator_email, message, send_days,
                                send_start_hour, send_end_hour, timezone,
                                frequency_type, frequency_value, status)
    VALUES (${campaign.name}, ${campaign.creatorEmail}, ${campaign.message},
            ${campaign.sendDays}, ${campaign.sendStartHour}, ${campaign.sendEndHour},
            ${campaign.timezone}, ${campaign.frequencyType}, ${campaign.frequencyValue},
            ${campaign.status})
    RETURNING id, name, creator_email as "creatorEmail", message,
              send_days as "sendDays", send_start_hour as "sendStartHour",
              send_end_hour as "sendEndHour", timezone,
              frequency_type as "frequencyType", frequency_value as "frequencyValue",
              status, created_at as "createdAt", updated_at as "updatedAt"
  `
  return result[0] as SmsCampaign
}

export async function getSmsCampaigns(): Promise<SmsCampaign[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, name, creator_email as "creatorEmail", message,
             send_days as "sendDays", send_start_hour as "sendStartHour",
             send_end_hour as "sendEndHour", timezone,
             frequency_type as "frequencyType", frequency_value as "frequencyValue",
             status, created_at as "createdAt", updated_at as "updatedAt"
      FROM sms_campaigns
      ORDER BY created_at DESC
    `
    return result as SmsCampaign[]
  } catch (error) {
    console.error('[DB] Error getting SMS campaigns:', error)
    return []
  }
}

export async function getSmsCampaignById(id: string): Promise<SmsCampaign | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, name, creator_email as "creatorEmail", message,
             send_days as "sendDays", send_start_hour as "sendStartHour",
             send_end_hour as "sendEndHour", timezone,
             frequency_type as "frequencyType", frequency_value as "frequencyValue",
             status, created_at as "createdAt", updated_at as "updatedAt"
      FROM sms_campaigns WHERE id = ${id}
    `
    return result.length > 0 ? result[0] as SmsCampaign : null
  } catch (error) {
    console.error('[DB] Error getting SMS campaign:', error)
    return null
  }
}

export async function updateSmsCampaign(id: string, updates: Partial<SmsCampaign>): Promise<SmsCampaign | null> {
  try {
    const db = getDb()
    const result = await db`
      UPDATE sms_campaigns SET
        name = COALESCE(${updates.name || null}, name),
        message = COALESCE(${updates.message || null}, message),
        send_days = COALESCE(${updates.sendDays || null}, send_days),
        send_start_hour = COALESCE(${updates.sendStartHour ?? null}, send_start_hour),
        send_end_hour = COALESCE(${updates.sendEndHour ?? null}, send_end_hour),
        frequency_type = COALESCE(${updates.frequencyType || null}, frequency_type),
        frequency_value = COALESCE(${updates.frequencyValue ?? null}, frequency_value),
        status = COALESCE(${updates.status || null}, status),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, creator_email as "creatorEmail", message,
                send_days as "sendDays", send_start_hour as "sendStartHour",
                send_end_hour as "sendEndHour", timezone,
                frequency_type as "frequencyType", frequency_value as "frequencyValue",
                status, created_at as "createdAt", updated_at as "updatedAt"
    `
    return result.length > 0 ? result[0] as SmsCampaign : null
  } catch (error) {
    console.error('[DB] Error updating SMS campaign:', error)
    return null
  }
}

export async function deleteSmsCampaign(id: string): Promise<boolean> {
  try {
    const db = getDb()
    await db`DELETE FROM sms_campaigns WHERE id = ${id}`
    return true
  } catch (error) {
    console.error('[DB] Error deleting SMS campaign:', error)
    return false
  }
}

export async function getSmsCampaignStats(campaignId: string): Promise<{
  totalSms: number
  pending: number
  sent: number
  failed: number
  paused: number
}> {
  try {
    const db = getDb()
    const stats = await db`
      SELECT
        COUNT(*) as "totalSms",
        COUNT(*) FILTER (WHERE status = 'pending') as "pending",
        COUNT(*) FILTER (WHERE status = 'sent') as "sent",
        COUNT(*) FILTER (WHERE status = 'failed') as "failed",
        COUNT(*) FILTER (WHERE status = 'paused') as "paused"
      FROM scheduled_sms
      WHERE sms_campaign_id = ${campaignId}
    `
    return {
      totalSms: Number(stats[0]?.totalSms || 0),
      pending: Number(stats[0]?.pending || 0),
      sent: Number(stats[0]?.sent || 0),
      failed: Number(stats[0]?.failed || 0),
      paused: Number(stats[0]?.paused || 0)
    }
  } catch (error) {
    console.error('[DB] Error getting SMS campaign stats:', error)
    return { totalSms: 0, pending: 0, sent: 0, failed: 0, paused: 0 }
  }
}

// ============================================
// SCHEDULED SMS QUERIES
// ============================================

export async function createScheduledSms(sms: Omit<ScheduledSms, 'id' | 'createdAt'>): Promise<ScheduledSms | null> {
  try {
    const db = getDb()
    const result = await db`
      INSERT INTO scheduled_sms (sms_campaign_id, phone, name, message,
                                  scheduled_at, status)
      VALUES (${sms.smsCampaignId}, ${sms.phone}, ${sms.name || null},
              ${sms.message}, ${sms.scheduledAt}, ${sms.status})
      RETURNING id, sms_campaign_id as "smsCampaignId", phone, name, message,
                scheduled_at as "scheduledAt", status, twilio_sid as "twilioSid",
                error_message as "errorMessage", created_at as "createdAt"
    `
    return result[0] as ScheduledSms
  } catch (error) {
    console.error('[DB] Error creating scheduled SMS:', error)
    return null
  }
}

export async function getScheduledSmsByCampaign(campaignId: string): Promise<ScheduledSms[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT id, sms_campaign_id as "smsCampaignId", phone, name, message,
             scheduled_at as "scheduledAt", status, twilio_sid as "twilioSid",
             error_message as "errorMessage", created_at as "createdAt"
      FROM scheduled_sms
      WHERE sms_campaign_id = ${campaignId}
      ORDER BY scheduled_at ASC
    `
    return result as ScheduledSms[]
  } catch (error) {
    console.error('[DB] Error getting scheduled SMS:', error)
    return []
  }
}

export async function getNextPendingSms(): Promise<ScheduledSms | null> {
  try {
    const db = getDb()
    const result = await db`
      SELECT ss.id, ss.sms_campaign_id as "smsCampaignId", ss.phone, ss.name,
             ss.message, ss.scheduled_at as "scheduledAt", ss.status,
             ss.twilio_sid as "twilioSid", ss.error_message as "errorMessage",
             ss.created_at as "createdAt"
      FROM scheduled_sms ss
      JOIN sms_campaigns sc ON ss.sms_campaign_id = sc.id
      WHERE ss.status = 'pending'
        AND ss.scheduled_at <= NOW()
        AND sc.status = 'active'
      ORDER BY ss.scheduled_at ASC
      LIMIT 1
    `
    return result.length > 0 ? result[0] as ScheduledSms : null
  } catch (error) {
    console.error('[DB] Error getting next pending SMS:', error)
    return null
  }
}

export async function updateScheduledSms(id: string, updates: Partial<ScheduledSms>): Promise<ScheduledSms | null> {
  try {
    const db = getDb()
    const result = await db`
      UPDATE scheduled_sms SET
        status = COALESCE(${updates.status || null}, status),
        twilio_sid = COALESCE(${updates.twilioSid || null}, twilio_sid),
        error_message = COALESCE(${updates.errorMessage || null}, error_message)
      WHERE id = ${id}
      RETURNING id, sms_campaign_id as "smsCampaignId", phone, name, message,
                scheduled_at as "scheduledAt", status, twilio_sid as "twilioSid",
                error_message as "errorMessage", created_at as "createdAt"
    `
    return result.length > 0 ? result[0] as ScheduledSms : null
  } catch (error) {
    console.error('[DB] Error updating scheduled SMS:', error)
    return null
  }
}

export async function toggleSmsStatus(id: string): Promise<ScheduledSms | null> {
  try {
    const db = getDb()
    // First get the current status
    const current = await db`
      SELECT status FROM scheduled_sms WHERE id = ${id}
    `
    if (current.length === 0) return null

    const currentStatus = current[0].status
    const newStatus = currentStatus === 'pending' ? 'paused' : currentStatus === 'paused' ? 'pending' : currentStatus

    const result = await db`
      UPDATE scheduled_sms SET
        status = ${newStatus}
      WHERE id = ${id}
      RETURNING id, sms_campaign_id as "smsCampaignId", phone, name, message,
                scheduled_at as "scheduledAt", status, twilio_sid as "twilioSid",
                error_message as "errorMessage", created_at as "createdAt"
    `
    return result.length > 0 ? result[0] as ScheduledSms : null
  } catch (error) {
    console.error('[DB] Error toggling SMS status:', error)
    return null
  }
}

export async function getPendingSmsToSend(limit: number = 10): Promise<ScheduledSms[]> {
  try {
    const db = getDb()
    const result = await db`
      SELECT ss.id, ss.sms_campaign_id as "smsCampaignId", ss.phone, ss.name,
             ss.message, ss.scheduled_at as "scheduledAt", ss.status,
             ss.twilio_sid as "twilioSid", ss.error_message as "errorMessage",
             ss.created_at as "createdAt"
      FROM scheduled_sms ss
      JOIN sms_campaigns sc ON ss.sms_campaign_id = sc.id
      WHERE ss.status = 'pending'
        AND ss.scheduled_at <= NOW()
        AND sc.status = 'active'
      ORDER BY ss.scheduled_at ASC
      LIMIT ${limit}
    `
    return result as ScheduledSms[]
  } catch (error) {
    console.error('[DB] Error getting pending SMS:', error)
    return []
  }
}
