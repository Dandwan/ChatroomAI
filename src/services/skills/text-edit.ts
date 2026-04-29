import type {
  EditAction,
  EditAppliedOperation,
  EditExecutionResult,
  EditOperation,
  EditPreviewSnippet,
} from './types'

const DEFAULT_PREVIEW_CONTEXT_LINES = 2
const MAX_PREVIEW_CONTEXT_LINES = 20

interface PreparedInsertOperation {
  kind: 'insert'
  index: number
  order: number
  op: Extract<EditOperation, { op: 'insert' }>
  insertedLines: string[]
}

interface PreparedRangeOperation {
  kind: 'range'
  index: number
  order: number
  op: Extract<EditOperation, { op: 'delete' | 'replace' }>
  startIndex: number
  endExclusive: number
  replacementLines: string[]
}

type PreparedOperation = PreparedInsertOperation | PreparedRangeOperation

interface PreviewAnchor {
  editIndex: number
  startIndex: number
  endIndex: number
}

export interface ApplyTextEditsOptions {
  originalContent: string
  action: EditAction
}

export interface ApplyTextEditsResult extends EditExecutionResult {
  nextContent: string
}

const normalizeNewlines = (value: string): string => value.replace(/\r\n?/g, '\n')

const detectPreferredNewline = (value: string): string => {
  const crlfIndex = value.indexOf('\r\n')
  if (crlfIndex >= 0) {
    return '\r\n'
  }
  return '\n'
}

const contentToLines = (value: string): string[] => {
  const normalized = normalizeNewlines(value)
  return normalized.length === 0 ? [] : normalized.split('\n')
}

const replacementTextToLines = (value: string): string[] => normalizeNewlines(value).split('\n')

const serializeLines = (lines: string[], newline: string): string =>
  lines.length === 0 ? '' : lines.join(newline)

const normalizeLineNumber = (
  value: number | undefined,
  field: string,
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} 必须是合法数字`)
  }
  const normalized = Math.round(value)
  if (normalized < 1) {
    throw new Error(`${field} 必须从 1 开始`)
  }
  return normalized
}

const normalizePreviewContextLines = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREVIEW_CONTEXT_LINES
  }
  return Math.max(0, Math.min(MAX_PREVIEW_CONTEXT_LINES, Math.round(value)))
}

const getAnchorTextForInsert = (
  lines: string[],
  op: Extract<EditOperation, { op: 'insert' }>,
  insertIndex: number,
): string => {
  if (op.beforeLine !== undefined) {
    return insertIndex < lines.length ? lines[insertIndex] ?? '' : ''
  }
  if (op.afterLine !== undefined) {
    return insertIndex > 0 ? lines[insertIndex - 1] ?? '' : ''
  }
  return ''
}

const assertExpectedText = (
  actual: string,
  expected: string | undefined,
  label: string,
): void => {
  if (expected === undefined) {
    return
  }
  if (normalizeNewlines(expected) !== normalizeNewlines(actual)) {
    throw new Error(`${label} 的 expectedText 不匹配`)
  }
}

const prepareInsertOperation = (
  op: Extract<EditOperation, { op: 'insert' }>,
  order: number,
  lines: string[],
): PreparedInsertOperation => {
  const hasBefore = op.beforeLine !== undefined
  const hasAfter = op.afterLine !== undefined
  if (hasBefore === hasAfter) {
    throw new Error('insert 必须且只能提供 beforeLine 或 afterLine 其中一个')
  }

  const insertedLines = replacementTextToLines(op.text)
  const lineCount = lines.length
  let insertIndex: number

  if (hasBefore) {
    const beforeLine = normalizeLineNumber(op.beforeLine, 'beforeLine')
    if (beforeLine > lineCount + 1) {
      throw new Error(`beforeLine 超出文件行数范围：${beforeLine} > ${lineCount + 1}`)
    }
    insertIndex = beforeLine - 1
  } else {
    const afterLine = normalizeLineNumber(op.afterLine, 'afterLine')
    if (afterLine > lineCount) {
      throw new Error(`afterLine 超出文件行数范围：${afterLine} > ${lineCount}`)
    }
    insertIndex = afterLine
  }

  assertExpectedText(getAnchorTextForInsert(lines, op, insertIndex), op.expectedText, 'insert 锚点')

  return {
    kind: 'insert',
    index: insertIndex,
    order,
    op,
    insertedLines,
  }
}

const prepareRangeOperation = (
  op: Extract<EditOperation, { op: 'delete' | 'replace' }>,
  order: number,
  lines: string[],
): PreparedRangeOperation => {
  const startLine = normalizeLineNumber(op.startLine, 'startLine')
  const endLine = normalizeLineNumber(op.endLine, 'endLine')
  if (endLine < startLine) {
    throw new Error('endLine 不能小于 startLine')
  }
  if (endLine > lines.length) {
    throw new Error(`endLine 超出文件行数范围：${endLine} > ${lines.length}`)
  }

  const startIndex = startLine - 1
  const endExclusive = endLine
  const actualText = lines.slice(startIndex, endExclusive).join('\n')
  assertExpectedText(actualText, op.expectedText, `${op.op} 目标区间`)

  return {
    kind: 'range',
    index: startIndex,
    order,
    op,
    startIndex,
    endExclusive,
    replacementLines: op.op === 'replace' ? replacementTextToLines(op.text) : [],
  }
}

const prepareOperations = (action: EditAction, lines: string[]): PreparedOperation[] => {
  if (!Array.isArray(action.edits) || action.edits.length === 0) {
    throw new Error('edit 至少需要一条编辑操作')
  }

  return action.edits.map((op, index) => {
    if (op.op === 'insert') {
      return prepareInsertOperation(op, index, lines)
    }
    return prepareRangeOperation(op, index, lines)
  })
}

const assertOperationConflicts = (operations: PreparedOperation[]): void => {
  const rangeOperations = operations
    .filter((operation): operation is PreparedRangeOperation => operation.kind === 'range')
    .sort((left, right) =>
      left.startIndex === right.startIndex ? left.order - right.order : left.startIndex - right.startIndex,
    )

  for (let index = 1; index < rangeOperations.length; index += 1) {
    const previous = rangeOperations[index - 1]
    const current = rangeOperations[index]
    if (current.startIndex < previous.endExclusive) {
      throw new Error('edit 操作存在重叠区间')
    }
  }

  const insertOperations = operations.filter(
    (operation): operation is PreparedInsertOperation => operation.kind === 'insert',
  )
  for (const insertOperation of insertOperations) {
    const conflictingRange = rangeOperations.find(
      (rangeOperation) =>
        insertOperation.index > rangeOperation.startIndex &&
        insertOperation.index < rangeOperation.endExclusive,
    )
    if (conflictingRange) {
      throw new Error('insert 锚点落在另一条删除或替换区间内部')
    }
  }
}

const buildAppliedEdit = (operation: PreparedOperation): EditAppliedOperation => {
  if (operation.kind === 'insert') {
    return {
      index: operation.order,
      op: 'insert',
      beforeLine: operation.op.beforeLine,
      afterLine: operation.op.afterLine,
    }
  }

  return {
    index: operation.order,
    op: operation.op.op,
    startLine: operation.op.startLine,
    endLine: operation.op.endLine,
  }
}

const buildPreviewSnippets = (
  lines: string[],
  anchors: PreviewAnchor[],
  previewContextLines: number,
): EditPreviewSnippet[] => {
  if (anchors.length === 0) {
    return []
  }

  if (lines.length === 0) {
    return [
      {
        editIndexes: Array.from(new Set(anchors.map((anchor) => anchor.editIndex))).sort((left, right) => left - right),
        startLine: 1,
        endLine: 0,
        content: '',
      },
    ]
  }

  const normalizedAnchors = anchors
    .map((anchor) => {
      const normalizedStart =
        anchor.startIndex >= lines.length ? Math.max(0, lines.length - 1) : Math.max(0, anchor.startIndex)
      const normalizedEnd =
        anchor.endIndex >= lines.length ? Math.max(0, lines.length - 1) : Math.max(normalizedStart, anchor.endIndex)
      return {
        ...anchor,
        startIndex: normalizedStart,
        endIndex: normalizedEnd,
      }
    })
    .sort((left, right) =>
      left.startIndex === right.startIndex ? left.editIndex - right.editIndex : left.startIndex - right.startIndex,
    )

  const snippets: Array<{
    editIndexes: number[]
    startIndex: number
    endIndex: number
  }> = []

  for (const anchor of normalizedAnchors) {
    const startIndex = Math.max(0, anchor.startIndex - previewContextLines)
    const endIndex = Math.min(lines.length - 1, anchor.endIndex + previewContextLines)
    const previous = snippets[snippets.length - 1]
    if (previous && startIndex <= previous.endIndex + 1) {
      previous.endIndex = Math.max(previous.endIndex, endIndex)
      if (!previous.editIndexes.includes(anchor.editIndex)) {
        previous.editIndexes.push(anchor.editIndex)
        previous.editIndexes.sort((left, right) => left - right)
      }
      continue
    }
    snippets.push({
      editIndexes: [anchor.editIndex],
      startIndex,
      endIndex,
    })
  }

  return snippets.map((snippet) => ({
    editIndexes: snippet.editIndexes,
    startLine: snippet.startIndex + 1,
    endLine: snippet.endIndex + 1,
    content: lines.slice(snippet.startIndex, snippet.endIndex + 1).join('\n'),
  }))
}

export const applyTextEdits = ({
  originalContent,
  action,
}: ApplyTextEditsOptions): ApplyTextEditsResult => {
  const preferredNewline = detectPreferredNewline(originalContent)
  const originalLines = contentToLines(originalContent)
  const previewContextLines = normalizePreviewContextLines(action.previewContextLines)
  const operations = prepareOperations(action, originalLines)
  assertOperationConflicts(operations)

  const sortedOperations = [...operations].sort((left, right) =>
    left.index === right.index ? left.order - right.order : left.index - right.index,
  )

  const groupedOperations = new Map<number, PreparedOperation[]>()
  for (const operation of sortedOperations) {
    const existing = groupedOperations.get(operation.index)
    if (existing) {
      existing.push(operation)
    } else {
      groupedOperations.set(operation.index, [operation])
    }
  }

  const sortedPositions = Array.from(groupedOperations.keys()).sort((left, right) => left - right)
  const nextLines: string[] = []
  const previewAnchors: PreviewAnchor[] = []
  let cursor = 0

  for (const position of sortedPositions) {
    if (cursor < position) {
      nextLines.push(...originalLines.slice(cursor, position))
      cursor = position
    }

    const operationsAtPosition = groupedOperations.get(position) ?? []
    for (const operation of operationsAtPosition) {
      if (operation.kind === 'insert') {
        const insertedStartIndex = nextLines.length
        nextLines.push(...operation.insertedLines)
        previewAnchors.push({
          editIndex: operation.order,
          startIndex: insertedStartIndex,
          endIndex: nextLines.length - 1,
        })
        continue
      }

      if (cursor < operation.startIndex) {
        nextLines.push(...originalLines.slice(cursor, operation.startIndex))
        cursor = operation.startIndex
      }
      if (cursor > operation.startIndex) {
        throw new Error('edit 操作顺序非法')
      }

      const replacementStartIndex = nextLines.length
      if (operation.replacementLines.length > 0) {
        nextLines.push(...operation.replacementLines)
        previewAnchors.push({
          editIndex: operation.order,
          startIndex: replacementStartIndex,
          endIndex: nextLines.length - 1,
        })
      } else {
        previewAnchors.push({
          editIndex: operation.order,
          startIndex: replacementStartIndex,
          endIndex: replacementStartIndex,
        })
      }
      cursor = operation.endExclusive
    }
  }

  if (cursor < originalLines.length) {
    nextLines.push(...originalLines.slice(cursor))
  }

  return {
    kind: 'edit',
    root: action.root,
    path: action.path,
    created: false,
    lineCountBefore: originalLines.length,
    lineCountAfter: nextLines.length,
    appliedEdits: [...operations].sort((left, right) => left.order - right.order).map(buildAppliedEdit),
    preview: buildPreviewSnippets(nextLines, previewAnchors, previewContextLines),
    nextContent: serializeLines(nextLines, preferredNewline),
  }
}
