import { describe, it, expect } from 'vitest'
import { formatSkillStepStatus, formatSkillStepTarget } from '../assistant-flow'
import type { AssistantFlowSkillNode } from '../assistant-flow'

const baseStep: AssistantFlowSkillNode = {
  id: 'step-1',
  kind: 'skill',
  status: 'success',
}

describe('formatSkillStepStatus', () => {
  it('returns Chinese labels for known statuses', () => {
    expect(formatSkillStepStatus('running')).toBe('进行中')
    expect(formatSkillStepStatus('success')).toBe('已完成')
    expect(formatSkillStepStatus('error')).toBe('失败')
  })
})

describe('formatSkillStepTarget', () => {
  it('formats read action with path', () => {
    expect(formatSkillStepTarget({
      ...baseStep,
      actionKind: 'read',
      root: 'workspace',
      path: 'src/file.ts',
    })).toBe('workspace / src/file.ts')
  })

  it('formats read action as workspace root', () => {
    expect(formatSkillStepTarget({
      ...baseStep,
      actionKind: 'read',
      root: 'workspace',
    })).toBe('workspace')
  })

  it('formats run action with command', () => {
    expect(formatSkillStepTarget({
      ...baseStep,
      actionKind: 'run',
      root: 'workspace',
      command: 'npm test',
    })).toBe('workspace / npm test')
  })

  it('formats edit action with path', () => {
    expect(formatSkillStepTarget({
      ...baseStep,
      actionKind: 'edit',
      root: 'workspace',
      path: 'src/App.tsx',
    })).toBe('workspace / src/App.tsx')
  })

  it('formats skill_call with skill and script', () => {
    expect(formatSkillStepTarget({
      ...baseStep,
      actionKind: 'skill_call',
      skill: 'formatter',
      script: 'format.py',
    })).toBe('formatter / format.py')
  })

  it('returns fallback for unknown actionKind', () => {
    expect(formatSkillStepTarget({
      ...baseStep,
      actionKind: undefined,
    })).toBe('技能调用')
  })
})
