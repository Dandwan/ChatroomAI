import { describe, it, expect } from 'vitest'

describe('Validation utilities', () => {
  describe('Email validation', () => {
    const isValidEmail = (email: string): boolean => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }

    it('accepts valid emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('a@b.co')).toBe(true)
      expect(isValidEmail('user+tag@example.org')).toBe(true)
    })

    it('rejects invalid emails', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('notanemail')).toBe(false)
      expect(isValidEmail('@missing-user.com')).toBe(false)
      expect(isValidEmail('missing-domain@')).toBe(false)
      expect(isValidEmail('missing @spaces.com')).toBe(false)
    })
  })

  describe('URL validation', () => {
    const isValidUrl = (url: string): boolean => {
      try {
        new URL(url)
        return true
      } catch {
        return false
      }
    }

    it('accepts valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://localhost:3000')).toBe(true)
      expect(isValidUrl('https://sub.domain.com/path?q=1')).toBe(true)
    })

    it('rejects invalid URLs', () => {
      expect(isValidUrl('')).toBe(false)
      expect(isValidUrl('not a url')).toBe(false)
    })
  })
})

describe('API key utilities', () => {
  it('identifies ActiNet API keys by prefix', () => {
    const isActiNetKey = (key: string) => key.startsWith('csk_')
    expect(isActiNetKey('csk_abc123')).toBe(true)
    expect(isActiNetKey('sk-abc123')).toBe(false)
    expect(isActiNetKey('')).toBe(false)
  })

  it('identifies admin API keys by prefix', () => {
    const isAdminKey = (key: string) => key.startsWith('ask_')
    expect(isAdminKey('ask_xyz789')).toBe(true)
    expect(isAdminKey('csk_abc123')).toBe(false)
  })
})

describe('Version comparison', () => {
  const compareVersions = (a: string, b: string): number => {
    const partsA = a.split('.').map(Number)
    const partsB = b.split('.').map(Number)
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
      if (diff !== 0) return diff
    }
    return 0
  }

  it('correctly compares version strings', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0)
    expect(compareVersions('1.5.0', '1.4.9')).toBeGreaterThan(0)
    expect(compareVersions('1.5', '1.5.0')).toBe(0)
    expect(compareVersions('2.0', '1.9.9')).toBeGreaterThan(0)
  })
})
