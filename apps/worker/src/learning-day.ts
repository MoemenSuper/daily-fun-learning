const TUNIS_TIME_ZONE = 'Africa/Tunis'

function partsAt(date: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TUNIS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
}

export function learningDate(date: Date): string {
  const parts = partsAt(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function isNotificationDue(date: Date, nominalHour = 8): boolean {
  const hour = Number(partsAt(date).hour)
  return hour >= nominalHour
}

