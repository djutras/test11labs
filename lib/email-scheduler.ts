// lib/email-scheduler.ts
// Email scheduling utility - calculates optimal send times for email campaigns

import type { EmailCampaign } from './db'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

interface EmailScheduleOptions {
  campaign: EmailCampaign
  contactCount: number
  startFrom?: Date
}

interface EmailScheduleResult {
  contactIndex: number
  dayNumber: number
  scheduledTime: Date
}

/**
 * Time slot definitions for rotating start times across campaign days
 */
const TIME_ROTATION_SLOTS = [
  { name: 'morning', startFraction: 0 },
  { name: 'late_morning', startFraction: 0.25 },
  { name: 'afternoon', startFraction: 0.50 },
  { name: 'evening', startFraction: 0.75 }
]

/**
 * Get the time slot for a specific day in the campaign
 */
function getTimeSlotForDay(dayNumber: number): { name: string; startFraction: number } {
  const slotIndex = (dayNumber - 1) % 4
  return TIME_ROTATION_SLOTS[slotIndex]
}

/**
 * Calculate scheduled times for email campaign contacts
 * Spreads emails evenly across allowed hours and days
 */
export function calculateEmailSchedule(options: EmailScheduleOptions): EmailScheduleResult[] {
  const { campaign, contactCount, startFrom } = options

  if (contactCount === 0) return []

  const durationDays = campaign.campaignDurationDays ?? 5

  // Determine if this is weekly scheduling (durationDays > 10 means weeks were selected)
  // Weekly: values are 28, 84, 168, 336 (4, 12, 24, 48 weeks in days)
  // Daily: values are 1-10
  const isWeeklyScheduling = durationDays > 10
  const numberOfSendPeriods = isWeeklyScheduling ? Math.floor(durationDays / 7) : durationDays
  const dayInterval = isWeeklyScheduling ? 7 : 1

  const results: EmailScheduleResult[] = []
  const now = startFrom || new Date()

  // Convert send days to day numbers (0-6, Sunday-Saturday)
  const allowedDays = campaign.sendDays.map(day =>
    DAY_NAMES.indexOf(day.toLowerCase())
  ).filter(d => d !== -1)

  if (allowedDays.length === 0) {
    // Default to weekdays
    allowedDays.push(1, 2, 3, 4, 5)
  }

  const startHour = campaign.sendStartHour
  const endHour = campaign.sendEndHour
  const windowMinutes = (endHour - startHour) * 60

  // Calculate interval between contacts on the same day
  const minutesBetweenEmails = Math.max(1, Math.floor((windowMinutes - 30) / Math.max(1, contactCount)))

  // Find valid campaign days
  const campaignDays: Date[] = []
  let searchDate = new Date(now)

  // Find first valid day
  searchDate = findNextValidTime(searchDate, allowedDays, startHour, endHour, campaign.timezone)

  for (let dayIndex = 0; dayIndex < numberOfSendPeriods && campaignDays.length < 100; dayIndex++) {
    const dayOfWeek = getDayInTimezone(searchDate, campaign.timezone)

    if (allowedDays.includes(dayOfWeek)) {
      const dayStart = setHourInTimezone(searchDate, startHour, campaign.timezone)
      campaignDays.push(dayStart)
    } else {
      dayIndex-- // Don't count this as a campaign day
    }

    // Move to next day or next week based on scheduling type
    searchDate = addDays(searchDate, dayInterval)
    searchDate = setHourInTimezone(searchDate, startHour, campaign.timezone)

    if (campaignDays.length >= numberOfSendPeriods) break
  }

  // Use time rotation for single-email campaigns with multiple days/weeks
  const useTimeRotation = numberOfSendPeriods > 1

  // Schedule emails for each campaign day
  for (let dayIdx = 0; dayIdx < campaignDays.length; dayIdx++) {
    let dayStart = campaignDays[dayIdx]
    const dayNumber = dayIdx + 1

    // Apply time rotation
    if (useTimeRotation) {
      const timeSlot = getTimeSlotForDay(dayNumber)
      const offsetMinutes = Math.floor(windowMinutes * timeSlot.startFraction)
      dayStart = new Date(dayStart.getTime() + offsetMinutes * 60 * 1000)
    }

    // Schedule each contact for this day
    for (let contactIdx = 0; contactIdx < contactCount; contactIdx++) {
      const minutesOffset = contactIdx * minutesBetweenEmails
      const scheduledTime = new Date(dayStart.getTime() + minutesOffset * 60 * 1000)

      results.push({
        contactIndex: contactIdx,
        dayNumber,
        scheduledTime
      })
    }
  }

  // Ensure minimum 1-minute gap between consecutive emails
  const MIN_GAP_MINUTES = 1
  results.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())

  for (let i = 1; i < results.length; i++) {
    const prevTime = results[i - 1].scheduledTime.getTime()
    const currTime = results[i].scheduledTime.getTime()
    const gapMinutes = (currTime - prevTime) / (1000 * 60)

    if (gapMinutes < MIN_GAP_MINUTES) {
      results[i].scheduledTime = new Date(prevTime + MIN_GAP_MINUTES * 60 * 1000)
    }
  }

  return results
}

/**
 * Get flat array of scheduled times (for convenience)
 */
export function calculateEmailTimes(options: EmailScheduleOptions): Date[] {
  const schedule = calculateEmailSchedule(options)
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

  for (let i = 0; i < 14; i++) {
    const dayOfWeek = getDayInTimezone(current, timezone)
    const hour = getHourInTimezone(current, timezone)

    if (allowedDays.includes(dayOfWeek)) {
      if (hour >= startHour && hour < endHour) {
        return current
      } else if (hour < startHour) {
        return setHourInTimezone(current, startHour, timezone)
      }
    }

    current = addDays(current, 1)
    current = setHourInTimezone(current, startHour, timezone)
  }

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
    const currentHour = getHourInTimezone(date, timezone)
    const diff = hour - currentHour
    const newDate = new Date(date.getTime() + diff * 60 * 60 * 1000)
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
 * Check if current time is within sending hours
 */
export function isWithinSendingHours(
  campaign: EmailCampaign,
  now?: Date
): boolean {
  const currentTime = now || new Date()

  const dayOfWeek = getDayInTimezone(currentTime, campaign.timezone)
  const dayName = DAY_NAMES[dayOfWeek]
  if (!campaign.sendDays.map(d => d.toLowerCase()).includes(dayName)) {
    return false
  }

  const hour = getHourInTimezone(currentTime, campaign.timezone)
  return hour >= campaign.sendStartHour && hour < campaign.sendEndHour
}

/**
 * Replace template variables in email subject/body
 */
export function replaceEmailVariables(
  template: string,
  variables: { name?: string; phone?: string; subject?: string; email?: string }
): string {
  let result = template
  result = result.replace(/\{\{name\}\}/gi, variables.name || '')
  result = result.replace(/\{\{phone\}\}/gi, variables.phone || '')
  result = result.replace(/\{\{subject\}\}/gi, variables.subject || '')
  result = result.replace(/\{\{email\}\}/gi, variables.email || '')
  return result
}
