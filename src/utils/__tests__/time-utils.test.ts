import { describe, it, expect } from 'vitest'
import { formatMs } from '../time-utils'

describe('formatMs', () => {
  it('returns -- for undefined', () => {
    expect(formatMs(undefined)).toBe('--')
  })

  it('returns -- for NaN', () => {
    expect(formatMs(NaN)).toBe('--')
  })

  it('formats values under 1000ms with ms suffix', () => {
    expect(formatMs(500)).toBe('500ms')
    expect(formatMs(42)).toBe('42ms')
    expect(formatMs(0)).toBe('0ms')
  })

  it('converts values >= 1000ms to seconds', () => {
    expect(formatMs(1000)).toBe('1.00s')
    expect(formatMs(1500)).toBe('1.50s')
    expect(formatMs(2500)).toBe('2.50s')
  })
})
