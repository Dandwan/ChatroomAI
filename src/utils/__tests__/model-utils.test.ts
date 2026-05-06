import { describe, it, expect } from 'vitest'
import { createProviderModelKey, modelHealthLabel } from '../model-utils'

describe('createProviderModelKey', () => {
  it('joins provider and model id with ::', () => {
    expect(createProviderModelKey('openai', 'gpt-4o')).toBe('openai::gpt-4o')
  })

  it('handles empty strings', () => {
    expect(createProviderModelKey('', '')).toBe('::')
  })
})

describe('modelHealthLabel', () => {
  it('returns labels for known states', () => {
    expect(modelHealthLabel('testing')).toBe('检测中')
    expect(modelHealthLabel('ok')).toBe('可用')
    expect(modelHealthLabel('error')).toBe('失败')
  })

  it('returns 检测 for undefined', () => {
    expect(modelHealthLabel(undefined)).toBe('检测')
  })
})
