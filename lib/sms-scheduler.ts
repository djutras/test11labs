// lib/sms-scheduler.ts
// SMS scheduling utility - calculates optimal send times for SMS campaigns

import type { SmsCampaign } from './db'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

interface SmsScheduleOptions {
  campaign: SmsCampaign
  contactCount: number
  startFrom?: Date
}

interface SmsScheduleResult {
  contactIndex: number
  periodNumber: number
  scheduledTime: Date
}

/**
 * Time slot definitions for rotating start times across campaign periods
 */
const TIME_ROTATION_SLOTS = [
  { name: 'morning', startFraction: 0 },
  { name: 'late_morning', startFraction: 0.25 },
  { name: 'afternoon', startFraction: 0.50 },
  { name: 'evening', startFraction: 0.75 }
]

/**
 * Get the time slot for a specific period in the campaign
 */
function getTimeSlotForPeriod(periodNumber: number): { name: string; startFraction: number } {
  const slotIndex = (periodNumber - 1) % 4
  return TIME_ROTATION_SLOTS[slotIndex]
}

/**
 * Calculate the day interval based on frequency type and value
 * Weekly: 7, 14, 21, 28 days (1-4 weeks)
 * Monthly: 30, 60, 90, ..., 360 days (1-12 months)
 */
function calculateDayInterval(frequencyType: 'weekly' | 'monthly', frequencyValue: number): number {
  if (frequencyType === 'weekly') {
    return frequencyValue * 7 // 1-4 weeks = 7-28 days
  } else {
    return frequencyValue * 30 // 1-12 months = 30-360 days
  }
}

/**
 * Calculate scheduled times for SMS campaign contacts
 * Schedules one SMS per contact per period (week or month)
 */
export function calculateSmsSchedule(options: SmsScheduleOptions): SmsScheduleResult[] {
  const { campaign, contactCount, startFrom } = options

  if (contactCount === 0) return []

  const dayInterval = calculateDayInterval(campaign.frequencyType, campaign.frequencyValue)
  const numberOfPeriods = campaign.frequencyType === 'weekly'
    ? campaign.frequencyValue  // 1-4 periods for weekly
    : campaign.frequencyValue  // 1-12 periods for monthly

  const results: SmsScheduleResult[] = []
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
  const minutesBetweenSms = Math.max(1, Math.floor((windowMinutes - 30) / Math.max(1, contactCount)))

  // Find valid campaign periods
  const campaignPeriodStarts: Date[] = []
  let searchDate = new Date(now)

  // Find first valid day
  searchDate = findNextValidTime(searchDate, allowedDays, startHour, endHour, campaign.timezone)

  // For each period (week or month), find a valid send day
  for (let periodIndex = 0; periodIndex < numberOfPeriods && campaignPeriodStarts.length < 100; periodIndex++) {
    const dayOfWeek = getDayInTimezone(searchDate, campaign.timezone)

    if (allowedDays.includes(dayOfWeek)) {
      const dayStart = setHourInTimezone(searchDate, startHour, campaign.timezone)
      campaignPeriodStarts.push(dayStart)
    } else {
      // Find the next valid day within this period
      let tempDate = new Date(searchDate)
      for (let d = 0; d < 7; d++) {
        tempDate = addDays(tempDate, 1)
        const tempDayOfWeek = getDayInTimezone(tempDate, campaign.timezone)
        if (allowedDays.includes(tempDayOfWeek)) {
          const dayStart = setHourInTimezone(tempDate, startHour, campaign.timezone)
          campaignPeriodStarts.push(dayStart)
          break
        }
      }
    }

    // Move to the next period
    searchDate = addDays(searchDate, dayInterval)
    searchDate = setHourInTimezone(searchDate, startHour, campaign.timezone)
  }

  // Use time rotation for multi-period campaigns
  const useTimeRotation = numberOfPeriods > 1

  // Schedule SMS for each campaign period
  for (let periodIdx = 0; periodIdx < campaignPeriodStarts.length; periodIdx++) {
    let periodStart = campaignPeriodStarts[periodIdx]
    const periodNumber = periodIdx + 1

    // Apply time rotation
    if (useTimeRotation) {
      const timeSlot = getTimeSlotForPeriod(periodNumber)
      const offsetMinutes = Math.floor(windowMinutes * timeSlot.startFraction)
      periodStart = new Date(periodStart.getTime() + offsetMinutes * 60 * 1000)
    }

    // Schedule each contact for this period
    for (let contactIdx = 0; contactIdx < contactCount; contactIdx++) {
      const minutesOffset = contactIdx * minutesBetweenSms
      const scheduledTime = new Date(periodStart.getTime() + minutesOffset * 60 * 1000)

      results.push({
        contactIndex: contactIdx,
        periodNumber,
        scheduledTime
      })
    }
  }

  // Ensure minimum 1-minute gap between consecutive SMS
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
export function calculateSmsTimes(options: SmsScheduleOptions): Date[] {
  const schedule = calculateSmsSchedule(options)
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
export function isWithinSmsHours(
  campaign: SmsCampaign,
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
 * Get frequency description for display
 */
export function getFrequencyDescription(
  frequencyType: 'weekly' | 'monthly',
  frequencyValue: number,
  language: 'en' | 'fr' = 'en'
): string {
  if (frequencyType === 'weekly') {
    if (language === 'fr') {
      return frequencyValue === 1 ? '1 semaine' : `${frequencyValue} semaines`
    }
    return frequencyValue === 1 ? '1 week' : `${frequencyValue} weeks`
  } else {
    if (language === 'fr') {
      return frequencyValue === 1 ? '1 mois' : `${frequencyValue} mois`
    }
    return frequencyValue === 1 ? '1 month' : `${frequencyValue} months`
  }
}
