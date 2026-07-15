import { describe, expect, it } from 'vitest'
import { isNotificationDue, learningDate } from '../src/learning-day'

describe('Africa/Tunis learning day', () => {
  it('uses the Tunis calendar date around UTC midnight', () => {
    expect(learningDate(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-02')
  })

  it('does not become due before 08:00 Tunis time', () => {
    expect(isNotificationDue(new Date('2026-01-10T06:59:59Z'))).toBe(false)
  })

  it('becomes due at 08:00 Tunis time', () => {
    expect(isNotificationDue(new Date('2026-01-10T07:00:00Z'))).toBe(true)
  })
})

