// lib/scheduler.ts
// Call scheduling utility - calculates optimal call times

import type { Campaign } from './db'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

interface ScheduleOptions {
  campaign: Campaign
  contactCount: number
  callsPerContact?: number  // DEPRECATED: Use campaign.callsPerDayPerContact and campaignDurationDays instead
  startFrom?: Date
}

interface MultiDayScheduleResult {
  contactIndex: number
  dayNumber: number      // Which day of the campaign (1-based)
  callNumber: number     // Which call of the day for this contact (1-based)
  scheduledTime: Date
}

/**
 * Time slot definitions for rotating start times across campaign days
 * Each slot represents a fraction of the calling window where calls will start
 *
 * For single-call-per-day campaigns, we rotate through these slots:
 * - Day 1: Morning (start at beginning of window)
 * - Day 2: Afternoon (start at 30% into window)
 * - Day 3: Late afternoon (start at 55% into window)
 * - Day 4: Evening (start at 75% into window)
 * - Day 5+: Cycle repeats
 */
const TIME_ROTATION_SLOTS = [
  { name: 'morning', startFraction: 0 },
  { name: 'afternoon', startFraction: 0.30 },
  { name: 'late_afternoon', startFraction: 0.55 },
  { name: 'evening', startFraction: 0.75 }
]

/**
 * Get the time slot for a specific day in the campaign
 * Days cycle through 4 slots: morning -> afternoon -> late_afternoon -> evening -> morning...
 */
function getTimeSlotForDay(dayNumber: number): { name: string; startFraction: number } {
  const slotIndex = (dayNumber - 1) % 4
  return TIME_ROTATION_SLOTS[slotIndex]
}

/**
 * Calculate scheduled times for a batch of contacts
 * Spreads calls evenly across allowed hours and days
 *
 * In TEST mode with callsPerContact > 1:
 * - Wave-based scheduling: all contacts get call 1, then all get call 2, etc.
 * - 10-minute intervals between waves
 * - 1-minute intervals between contacts within a wave
 * - Starts immediately
 *
 * In TEST mode with callsPerContact = 1:
 * - Fixed 10-minute intervals between contacts
 * - Starts immediately
 *
 * In PRODUCTION mode:
 * - 15-30 minute random intervals
 * - No contact limit
 */
export function calculateScheduledTimes(options: ScheduleOptions): Date[] {
  const { campaign, startFrom, callsPerContact = 1 } = options
  const { contactCount } = options

  if (contactCount === 0) return []

  const scheduledTimes: Date[] = []
  const now = startFrom || new Date()
  const isTestMode = campaign.mode === 'test'

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

  // Find the first valid start time
  let currentDate = new Date(now)

  // In test mode, start immediately (don't wait for next valid window)
  if (!isTestMode) {
    currentDate = findNextValidTime(currentDate, allowedDays, startHour, endHour, campaign.timezone)
  }

  // TEST MODE with multiple calls per contact: Wave-based scheduling
  if (isTestMode && callsPerContact > 1) {
    const waveIntervalMinutes = 10  // 10 minutes between waves
    const contactIntervalMinutes = 1  // 1 minute between contacts in same wave

    // Schedule wave by wave
    for (let wave = 0; wave < callsPerContact; wave++) {
      const waveStartTime = new Date(currentDate.getTime() + wave * waveIntervalMinutes * 60 * 1000)

      for (let contactIndex = 0; contactIndex < contactCount; contactIndex++) {
        const scheduledTime = new Date(waveStartTime.getTime() + contactIndex * contactIntervalMinutes * 60 * 1000)
        scheduledTimes.push(scheduledTime)
      }
    }

    return scheduledTimes
  }

  // PRODUCTION or TEST mode with single call per contact
  const baseInterval = isTestMode ? 10 : 15
  const slotsPerDay = Math.floor(windowMinutes / baseInterval)

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

  // Ensure minimum 5-minute gap between consecutive calls
  const MIN_GAP_MINUTES = 5
  scheduledTimes.sort((a, b) => a.getTime() - b.getTime())

  for (let i = 1; i < scheduledTimes.length; i++) {
    const prevTime = scheduledTimes[i - 1].getTime()
    const currTime = scheduledTimes[i].getTime()
    const gapMinutes = (currTime - prevTime) / (1000 * 60)

    if (gapMinutes < MIN_GAP_MINUTES) {
      // Shift this call to ensure minimum gap
      scheduledTimes[i] = new Date(prevTime + MIN_GAP_MINUTES * 60 * 1000)
    }
  }

  return scheduledTimes
}

/**
 * Calculate scheduled times for multiple days
 * Used for campaigns with callsPerDayPerContact and campaignDurationDays settings
 *
 * For each contact, schedules callsPerDayPerContact calls per day for campaignDurationDays
 * Example: 5 contacts, 1 call/day, 5 days = 25 total scheduled calls
 *
 * @returns Array of MultiDayScheduleResult with scheduling metadata
 */
export function calculateMultiDaySchedule(options: ScheduleOptions): MultiDayScheduleResult[] {
  const { campaign, contactCount, startFrom } = options

  if (contactCount === 0) return []

  const callsPerDay = campaign.callsPerDayPerContact ?? 1
  const durationDays = campaign.campaignDurationDays ?? 5

  const results: MultiDayScheduleResult[] = []
  const now = startFrom || new Date()

  // Convert call days to day numbers (0-6, Sunday-Saturday)
  const allowedDays = campaign.callDays.map(day =>
    DAY_NAMES.indexOf(day.toLowerCase())
  ).filter(d => d !== -1)

  if (allowedDays.length === 0) {
    // Default to weekdays
    allowedDays.push(1, 2, 3, 4, 5)
  }

  const startHour = campaign.callStartHour
  const endHour = campaign.callEndHour
  const windowMinutes = (endHour - startHour) * 60

  // Calculate interval between contacts on the same day
  // Leave some buffer at the end of the day
  const totalCallsPerDay = contactCount * callsPerDay
  const minutesBetweenCalls = Math.max(5, Math.floor((windowMinutes - 30) / Math.max(1, totalCallsPerDay)))

  // Find valid campaign days
  const campaignDays: Date[] = []
  let searchDate = new Date(now)

  // Find first valid day
  searchDate = findNextValidTime(searchDate, allowedDays, startHour, endHour, campaign.timezone)

  for (let dayIndex = 0; dayIndex < durationDays && campaignDays.length < 30; dayIndex++) {
    // Check if this day is valid
    const dayOfWeek = getDayInTimezone(searchDate, campaign.timezone)

    if (allowedDays.includes(dayOfWeek)) {
      // This is a valid campaign day
      const dayStart = setHourInTimezone(searchDate, startHour, campaign.timezone)
      campaignDays.push(dayStart)
    } else {
      // Not a valid day, don't count it but still search next day
      dayIndex-- // Don't count this as a campaign day
    }

    // Move to next week (7 days) for weekly call scheduling
    searchDate = addDays(searchDate, 7)
    searchDate = setHourInTimezone(searchDate, startHour, campaign.timezone)

    // Safety check to avoid infinite loop
    if (campaignDays.length >= durationDays) break
  }

  // Determine if we should use time rotation
  // Only for single-call-per-day campaigns with multiple days
  const useTimeRotation = callsPerDay === 1 && durationDays > 1

  // Now schedule calls for each campaign day
  for (let dayIdx = 0; dayIdx < campaignDays.length; dayIdx++) {
    let dayStart = campaignDays[dayIdx]
    const dayNumber = dayIdx + 1

    // Apply time rotation for single-call campaigns
    if (useTimeRotation) {
      const timeSlot = getTimeSlotForDay(dayNumber)
      const offsetMinutes = Math.floor(windowMinutes * timeSlot.startFraction)
      dayStart = new Date(dayStart.getTime() + offsetMinutes * 60 * 1000)
    }

    // For each contact, schedule callsPerDay calls on this day
    for (let callNum = 1; callNum <= callsPerDay; callNum++) {
      for (let contactIdx = 0; contactIdx < contactCount; contactIdx++) {
        // Calculate offset: spread contacts and calls throughout the day
        // First all contacts get call 1, then all get call 2, etc.
        const callOffset = (callNum - 1) * contactCount + contactIdx
        const minutesOffset = callOffset * minutesBetweenCalls

        const scheduledTime = new Date(dayStart.getTime() + minutesOffset * 60 * 1000)

        results.push({
          contactIndex: contactIdx,
          dayNumber,
          callNumber: callNum,
          scheduledTime
        })
      }
    }
  }

  // Ensure minimum 5-minute gap between consecutive calls
  const MIN_GAP_MINUTES = 5
  results.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())

  for (let i = 1; i < results.length; i++) {
    const prevTime = results[i - 1].scheduledTime.getTime()
    const currTime = results[i].scheduledTime.getTime()
    const gapMinutes = (currTime - prevTime) / (1000 * 60)

    if (gapMinutes < MIN_GAP_MINUTES) {
      // Shift this call to ensure minimum gap
      results[i].scheduledTime = new Date(prevTime + MIN_GAP_MINUTES * 60 * 1000)
    }
  }

  return results
}

/**
 * Simple helper to get scheduled times from multi-day schedule
 * Returns flat array of dates (for backward compatibility)
 */
export function calculateMultiDayTimes(options: ScheduleOptions): Date[] {
  const schedule = calculateMultiDaySchedule(options)
  return schedule.map(s => s.scheduledTime)
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
