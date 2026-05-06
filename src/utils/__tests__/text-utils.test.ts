import { describe, it, expect } from 'vitest'
import { stripSkillParsingHintLines } from '../text-utils'

describe('stripSkillParsingHintLines', () => {
  it('removes skill parsing hint lines', () => {
    const input = '模型正在解析 skill 调用...\n\nActual content'
    expect(stripSkillParsingHintLines(input)).toBe('\n\nActual content')
  })

  it('removes hint lines with extra spaces', () => {
    const input = '模型正在解析  skill  调用 something\n\nContent'
    expect(stripSkillParsingHintLines(input)).toBe('\n\nContent')
  })

  it('compacts excessive blank lines', () => {
    const input = 'Line 1\n\n\n\n\nLine 2'
    expect(stripSkillParsingHintLines(input)).toBe('Line 1\n\nLine 2')
  })

  it('returns text unchanged when no hint lines present', () => {
    const input = 'Normal text without hints'
    expect(stripSkillParsingHintLines(input)).toBe('Normal text without hints')
  })
})
