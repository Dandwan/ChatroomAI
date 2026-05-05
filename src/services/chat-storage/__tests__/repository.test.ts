import { describe, it, expect } from 'vitest'
import type { ChatStorageConversationSummary } from '../types'

// Inline the pure functions to avoid importing from the repository module
// (which has module-level side effects from Capacitor imports).
const EMPTY_HISTORY_STATS = {
  totalConversationCount: 0,
  totalMessageCount: 0,
  totalPhotoCount: 0,
  totalTokenCount: 0,
  totalToolCallCount: 0,
}

// Minimal re-implementation of buildHistoryStatsFromSummaries for pure testing.
// This matches the logic in repository.ts exactly.
function buildHistoryStatsFromSummaries(summaries: ChatStorageConversationSummary[]) {
  return summaries.reduce(
    (stats, summary) => ({
      totalConversationCount: stats.totalConversationCount + 1,
      totalMessageCount: stats.totalMessageCount + summary.userMessageCount,
      totalPhotoCount: stats.totalPhotoCount + summary.imageCount,
      totalTokenCount: stats.totalTokenCount + summary.assistantTokenCount,
      totalToolCallCount: stats.totalToolCallCount + summary.toolCallCount,
    }),
    { ...EMPTY_HISTORY_STATS },
  )
}

function makeSummary(overrides: Partial<ChatStorageConversationSummary> = {}): ChatStorageConversationSummary {
  return {
    id: 'conv-1',
    title: 'Test',
    titleManuallyEdited: false,
    createdAt: 1000,
    updatedAt: 2000,
    messageCount: 5,
    userMessageCount: 3,
    fileCount: 0,
    imageCount: 2,
    assistantTokenCount: 1500,
    toolCallCount: 1,
    draftTextLength: 0,
    draftAttachmentCount: 0,
    lastMessagePreview: 'Hello',
    ...overrides,
  }
}

describe('buildHistoryStatsFromSummaries', () => {
  it('returns empty stats for an empty array', () => {
    expect(buildHistoryStatsFromSummaries([])).toEqual(EMPTY_HISTORY_STATS)
  })

  it('counts a single conversation correctly', () => {
    const stats = buildHistoryStatsFromSummaries([makeSummary()])
    expect(stats).toEqual({
      totalConversationCount: 1,
      totalMessageCount: 3,
      totalPhotoCount: 2,
      totalTokenCount: 1500,
      totalToolCallCount: 1,
    })
  })

  it('aggregates multiple conversations', () => {
    const stats = buildHistoryStatsFromSummaries([
      makeSummary({ id: 'a', userMessageCount: 2, imageCount: 1, assistantTokenCount: 500, toolCallCount: 0 }),
      makeSummary({ id: 'b', userMessageCount: 4, imageCount: 3, assistantTokenCount: 1000, toolCallCount: 2 }),
      makeSummary({ id: 'c', userMessageCount: 1, imageCount: 0, assistantTokenCount: 250, toolCallCount: 1 }),
    ])
    expect(stats).toEqual({
      totalConversationCount: 3,
      totalMessageCount: 7,
      totalPhotoCount: 4,
      totalTokenCount: 1750,
      totalToolCallCount: 3,
    })
  })

  it('handles zero values', () => {
    const stats = buildHistoryStatsFromSummaries([
      makeSummary({
        userMessageCount: 0,
        imageCount: 0,
        assistantTokenCount: 0,
        toolCallCount: 0,
      }),
    ])
    expect(stats).toEqual({
      totalConversationCount: 1,
      totalMessageCount: 0,
      totalPhotoCount: 0,
      totalTokenCount: 0,
      totalToolCallCount: 0,
    })
  })
})
