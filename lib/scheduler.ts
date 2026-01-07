// lib/scheduler.ts
// Call scheduling utility - calculates optimal call times

import type { Campaign } from './db'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

interface ScheduleOptions {
  campaign: Campaign
  contactCount: number
  startFrom?: Date
}

/**
 * Calculate scheduled times for a batch of contacts
 * Spreads calls evenly across allowed hours and days
 *
 * In TEST mode:
 * - Fixed 10-minute intervals
 * - Maximum 3 contacts
 *
 * In PRODUCTION mode:
 * - 15-30 minute random intervals
 * - No contact limit
 */
export function calculateScheduledTimes(options: ScheduleOptions): Date[] {
  const { campaign, startFrom } = options
  let { contactCount } = options

  // TEST MODE: Limit to 3 contacts and use 10-minute intervals
  const isTestMode = campaign.mode === 'test'
  if (isTestMode) {
    contactCount = Math.min(contactCount, 3)
  }

  if (contactCount === 0) return []

  const scheduledTimes: Date[] = []
  const now = startFrom || new Date()

  // Convert call days to day numbers (0-6, Sunday-Saturday)
  const allowedDays = campaign.callDays.map(day =>
    DAY_NAMES.indexOf(day.toLowerCase())
  ).filter(d => d !== -1)

  if (allowedDays.length === 0) {
    // Default to weekdays
    allowedDays.push(1, 2, 3, 4, 5)
  }

  // Calculate minutes per call window
  const startHour = campaign.callStartHour
  const endHour = campaign.callEndHour
  const windowMinutes = (endHour - startHour) * 60

  // Calculate interval between calls
  // TEST MODE: Fixed 10-minute intervals
  // PRODUCTION: minimum 15 minutes, spread evenly
  const baseInterval = isTestMode ? 10 : 15
  const slotsPerDay = Math.floor(windowMinutes / baseInterval)
  const daysNeeded = Math.ceil(contactCount / slotsPerDay)

  // Find the first valid start time
  let currentDate = new Date(now)

  // In test mode, start immediately (don't wait for next valid window if not needed)
  if (!isTestMode) {
    currentDate = findNextValidTime(currentDate, allowedDays, startHour, endHour, campaign.timezone)
  }

  // Schedule each contact
  for (let i = 0; i < contactCount; i++) {
    // TEST MODE: No randomness, fixed 10-minute intervals
    // PRODUCTION: Add some randomness (0-10 minutes) to avoid exact patterns
    const randomOffset = isTestMode ? 0 : Math.floor(Math.random() * 10)
    const scheduledTime = new Date(currentDate)
    scheduledTime.setMinutes(scheduledTime.getMinutes() + randomOffset)

    scheduledTimes.push(scheduledTime)

    // Move to next slot
    // TEST MODE: Fixed 10-minute interval
    // PRODUCTION: 15-30 minute random interval
    const intervalMinutes = isTestMode ? 10 : (15 + Math.floor(Math.random() * 15))
    currentDate = new Date(currentDate.getTime() + intervalMinutes * 60 * 1000)

    // Check if we've exceeded the end hour (only in production mode)
    if (!isTestMode) {
      const currentHour = getHourInTimezone(currentDate, campaign.timezone)
      if (currentHour >= endHour) {
        // Move to next valid day
        currentDate = findNextValidTime(
          addDays(currentDate, 1),
          allowedDays,
          startHour,
          endHour,
          campaign.timezone
        )
      }
    }
  }

  return scheduledTimes
}

/**
 * Find the next valid time that falls within allowed hours and days
 */
function findNextValidTime(
  from: Date,
  allowedDays: number[],
  startHour: number,
  endHour: number,
  timezone: string
): Date {
  let current = new Date(from)

  // Try up to 14 days to find a valid slot
  for (let i = 0; i < 14; i++) {
    const dayOfWeek = getDayInTimezone(current, timezone)
    const hour = getHourInTimezone(current, timezone)

    if (allowedDays.includes(dayOfWeek)) {
      if (hour >= startHour && hour < endHour) {
        // Already in a valid window
        return current
      } else if (hour < startHour) {
        // Before start time, set to start
        return setHourInTimezone(current, startHour, timezone)
      }
      // After end time, continue to next day
    }

    // Move to next day at start hour
    current = addDays(current, 1)
    current = setHourInTimezone(current, startHour, timezone)
  }

  // Fallback: return start of tomorrow
  const tomorrow = addDays(from, 1)
  return setHourInTimezone(tomorrow, startHour, timezone)
}

/**
 * Get the hour in a specific timezone
 */
function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    })
    return parseInt(formatter.format(date), 10)
  } catch {
    // Fallback to local time
    return date.getHours()
  }
}

/**
 * Get the day of week in a specific timezone (0-6)
 */
function getDayInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short'
    })
    const dayName = formatter.format(date).toLowerCase()
    const dayMap: Record<string, number> = {
      'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    }
    return dayMap[dayName] ?? date.getDay()
  } catch {
    return date.getDay()
  }
}

/**
 * Set the hour in a specific timezone
 */
function setHourInTimezone(date: Date, hour: number, timezone: string): Date {
  try {
    // Get current time in timezone
    const currentHour = getHourInTimezone(date, timezone)
    const diff = hour - currentHour
    const newDate = new Date(date.getTime() + diff * 60 * 60 * 1000)

    // Set to beginning of hour
    newDate.setMinutes(0, 0, 0)
    return newDate
  } catch {
    const newDate = new Date(date)
    newDate.setHours(hour, 0, 0, 0)
    return newDate
  }
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Check if current time is within calling hours
 */
export function isWithinCallingHours(
  campaign: Campaign,
  now?: Date
): boolean {
  const currentTime = now || new Date()

  // Check day of week
  const dayOfWeek = getDayInTimezone(currentTime, campaign.timezone)
  const dayName = DAY_NAMES[dayOfWeek]
  if (!campaign.callDays.map(d => d.toLowerCase()).includes(dayName)) {
    return false
  }

  // Check hour
  const hour = getHourInTimezone(currentTime, campaign.timezone)
  return hour >= campaign.callStartHour && hour < campaign.callEndHour
}

/**
 * Calculate the next retry time (later same day or next valid day)
 */
export function calculateRetryTime(
  campaign: Campaign,
  originalTime: Date
): Date {
  const retryTime = new Date(originalTime)

  // Try 2 hours later
  retryTime.setHours(retryTime.getHours() + 2)

  // Check if still within calling hours
  const hour = getHourInTimezone(retryTime, campaign.timezone)
  if (hour < campaign.callEndHour) {
    return retryTime
  }

  // Otherwise schedule for next valid day
  return findNextValidTime(
    addDays(originalTime, 1),
    campaign.callDays.map(day => DAY_NAMES.indexOf(day.toLowerCase())).filter(d => d !== -1),
    campaign.callStartHour,
    campaign.callEndHour,
    campaign.timezone
  )
}
