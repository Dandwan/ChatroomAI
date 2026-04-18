import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

import ChatInputBox from './ChatInputBox'

export type JsonPrimitive = string | number | boolean | null
export type JsonArrayValue = JsonValue[]

export interface JsonObjectValue {
  [key: string]: JsonValue
}

export type JsonValue = JsonPrimitive | JsonArrayValue | JsonObjectValue

type JsonPath = Array<string | number>
type JsonValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
type CollapseStateMap = Record<string, boolean>

interface SkillConfigJsonEditorProps {
  value: JsonObjectValue
  onChange: (nextValue: JsonObjectValue) => void
}

interface JsonObjectKeyInputProps {
  value: string
  siblingKeys: string[]
  onCommit: (nextKey: string) => void
}

interface JsonNumberInputProps {
  value: number
  onCommit: (nextValue: number) => void
}

interface JsonObjectAddRowProps {
  existingKeys: string[]
  onAdd: (nextKey: string, nextType: JsonValueType) => void
}

interface JsonArrayAddRowProps {
  onAdd: (nextType: JsonValueType) => void
}

interface JsonTypePickerProps {
  value: JsonValueType
  onChange: (nextType: JsonValueType) => void
}

interface JsonTypePopoverLayout {
  bottom?: number
  left: number
  maxHeight: number
  placement: 'above' | 'below'
  triggerHeight: number
  triggerLeft: number
  triggerTop: number
  top?: number
  triggerWidth: number
  width: number
}

interface JsonEditorNodeProps {
  label: string
  path: JsonPath
  value: JsonValue
  siblingKeys?: string[]
  canMoveUp?: boolean
  canMoveDown?: boolean
  isRoot?: boolean
  onValueChange: (path: JsonPath, nextValue: JsonValue) => void
  onDelete: (path: JsonPath) => void
  onRenameObjectKey: (path: JsonPath, nextKey: string) => void
  onAddObjectEntry: (path: JsonPath, nextKey: string, nextType: JsonValueType) => void
  onAddArrayItem: (path: JsonPath, nextType: JsonValueType) => void
  onMoveArrayItem: (path: JsonPath, direction: -1 | 1) => void
  openNodes: CollapseStateMap
  expandedStructures: CollapseStateMap
  onToggleNode: (path: JsonPath) => void
  onToggleStructure: (path: JsonPath) => void
}

const JSON_VALUE_TYPE_OPTIONS: Array<{ value: JsonValueType; label: string }> = [
  { value: 'string', label: '字符串' },
  { value: 'number', label: '数字' },
  { value: 'boolean', label: '布尔' },
  { value: 'null', label: 'Null' },
  { value: 'object', label: '对象' },
  { value: 'array', label: '数组' },
]
const JSON_VALUE_TYPE_LABELS: Record<JsonValueType, string> = Object.fromEntries(
  JSON_VALUE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<JsonValueType, string>

const MAX_INLINE_TEXTAREA_HEIGHT = 240
const MAX_INLINE_INPUT_HEIGHT = 120
const ANIMATED_VISIBILITY_DURATION_MS = 220
const JSON_TYPE_PICKER_ROW_HEIGHT = 30
const JSON_TYPE_PICKER_OPTION_GAP = 5
const JSON_TYPE_PICKER_VERTICAL_CHROME = 16
const JSON_TYPE_PICKER_VIEWPORT_MARGIN = 16
const JSON_TYPE_PICKER_GAP = 0
const JSON_TYPE_PICKER_ABOVE_EDGE_OFFSET = 0

const sanitizeSingleLineInput = (value: string): string => value.replace(/[\r\n]+/g, '')

const isJsonObjectValue = (value: unknown): value is JsonObjectValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getJsonValueType = (value: JsonValue): JsonValueType => {
  if (Array.isArray(value)) {
    return 'array'
  }
  if (isJsonObjectValue(value)) {
    return 'object'
  }
  if (value === null) {
    return 'null'
  }
  switch (typeof value) {
    case 'boolean':
      return 'boolean'
    case 'number':
      return 'number'
    case 'string':
      return 'string'
    default:
      return 'string'
  }
}

const createDefaultJsonValue = (type: JsonValueType): JsonValue => {
  switch (type) {
    case 'array':
      return []
    case 'boolean':
      return false
    case 'null':
      return null
    case 'number':
      return 0
    case 'object':
      return {}
    case 'string':
    default:
      return ''
  }
}

const cloneJsonObjectValue = (value: JsonObjectValue): JsonObjectValue =>
  JSON.parse(JSON.stringify(value)) as JsonObjectValue

const getJsonValueAtPath = (value: JsonValue, path: JsonPath): JsonValue | undefined => {
  let current: JsonValue | undefined = value
  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current)) {
        return undefined
      }
      current = current[segment]
      continue
    }
    if (!isJsonObjectValue(current)) {
      return undefined
    }
    current = current[segment]
  }
  return current
}

const formatJsonPath = (path: JsonPath): string => {
  if (path.length === 0) {
    return 'root'
  }

  let result = ''
  for (const segment of path) {
    if (typeof segment === 'number') {
      result += `[${segment}]`
      continue
    }
    result += result.length === 0 ? segment : `.${segment}`
  }
  return result
}

const describeJsonValue = (value: JsonValue): string => {
  if (Array.isArray(value)) {
    return `${value.length} 个元素`
  }
  if (isJsonObjectValue(value)) {
    return `${Object.keys(value).length} 个字段`
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false'
    case 'number':
      return String(value)
    case 'string':
      return value.trim().length > 0 ? `${value.length} 个字符` : '空字符串'
    default:
      return 'null'
  }
}

const getJsonValueTypeLabel = (type: JsonValueType): string => JSON_VALUE_TYPE_LABELS[type]

const getCollapsedValuePreview = (value: JsonValue, type: JsonValueType): string | null => {
  switch (type) {
    case 'array':
      return `${(value as JsonArrayValue).length} 元素`
    case 'object':
      return `${Object.keys(value as JsonObjectValue).length} 字段`
    case 'string': {
      const normalized = (value as string).replace(/\s+/g, ' ').trim()
      return normalized.length > 0 ? normalized : '空字符串'
    }
    case 'number':
      return String(value)
    case 'boolean':
      return value ? 'true' : 'false'
    default:
      return null
  }
}

const resolveJsonTypePopoverLayout = (
  triggerRect: DOMRect,
  viewportWidth: number,
  viewportHeight: number,
  measuredHeight?: number,
): JsonTypePopoverLayout => {
  const width = Math.min(
    triggerRect.width,
    Math.max(0, viewportWidth - JSON_TYPE_PICKER_VIEWPORT_MARGIN * 2),
  )
  const estimatedHeight =
    JSON_VALUE_TYPE_OPTIONS.length * JSON_TYPE_PICKER_ROW_HEIGHT +
    (JSON_VALUE_TYPE_OPTIONS.length - 1) * JSON_TYPE_PICKER_OPTION_GAP +
    JSON_TYPE_PICKER_VERTICAL_CHROME
  const contentHeight = measuredHeight ?? estimatedHeight
  const availableBelow = viewportHeight - triggerRect.bottom - JSON_TYPE_PICKER_VIEWPORT_MARGIN
  const availableAbove = triggerRect.top - JSON_TYPE_PICKER_VIEWPORT_MARGIN
  const placement: JsonTypePopoverLayout['placement'] =
    availableBelow >= contentHeight
      ? 'below'
      : availableAbove >= contentHeight
        ? 'above'
        : availableBelow >= availableAbove
          ? 'below'
          : 'above'
  const maxHeight = Math.max(120, placement === 'below' ? availableBelow : availableAbove)
  const visibleHeight = Math.min(contentHeight, maxHeight)
  const left = Math.max(
    JSON_TYPE_PICKER_VIEWPORT_MARGIN,
    Math.min(
      triggerRect.left,
      viewportWidth - JSON_TYPE_PICKER_VIEWPORT_MARGIN - width,
    ),
  )
  return {
    bottom:
      placement === 'above'
        ? Math.max(
            JSON_TYPE_PICKER_VIEWPORT_MARGIN,
            viewportHeight - triggerRect.top + JSON_TYPE_PICKER_GAP + JSON_TYPE_PICKER_ABOVE_EDGE_OFFSET,
          )
        : undefined,
    left,
    maxHeight,
    placement,
    triggerHeight: triggerRect.height,
    triggerLeft: triggerRect.left,
    triggerTop: triggerRect.top,
    top:
      placement === 'below'
        ? availableBelow >= visibleHeight
          ? triggerRect.bottom + JSON_TYPE_PICKER_GAP
          : Math.max(
              JSON_TYPE_PICKER_VIEWPORT_MARGIN,
              viewportHeight - JSON_TYPE_PICKER_VIEWPORT_MARGIN - visibleHeight,
            )
        : undefined,
    triggerWidth: triggerRect.width,
    width,
  }
}

const collectNodePathKeys = (value: JsonValue, path: JsonPath = []): string[] => {
  const keys = path.length > 0 ? [formatJsonPath(path)] : []

  if (Array.isArray(value)) {
    value.forEach((childValue, index) => {
      keys.push(...collectNodePathKeys(childValue, [...path, index]))
    })
    return keys
  }

  if (isJsonObjectValue(value)) {
    Object.entries(value).forEach(([childKey, childValue]) => {
      keys.push(...collectNodePathKeys(childValue, [...path, childKey]))
    })
  }

  return keys
}

const collectStructurePathKeys = (value: JsonValue, path: JsonPath = []): string[] => {
  const keys: string[] = []
  if (path.length > 0 && (Array.isArray(value) || isJsonObjectValue(value))) {
    keys.push(formatJsonPath(path))
  }

  if (Array.isArray(value)) {
    value.forEach((childValue, index) => {
      keys.push(...collectStructurePathKeys(childValue, [...path, index]))
    })
    return keys
  }

  if (isJsonObjectValue(value)) {
    Object.entries(value).forEach(([childKey, childValue]) => {
      keys.push(...collectStructurePathKeys(childValue, [...path, childKey]))
    })
  }

  return keys
}

const syncCollapseStateMap = (
  previous: CollapseStateMap,
  pathKeys: string[],
  defaultValue: boolean,
): CollapseStateMap => {
  let changed = Object.keys(previous).length !== pathKeys.length
  const next: CollapseStateMap = {}

  for (const pathKey of pathKeys) {
    const nextValue = previous[pathKey] ?? defaultValue
    next[pathKey] = nextValue
    if (previous[pathKey] !== nextValue) {
      changed = true
    }
  }

  return changed ? next : previous
}

const replaceRootObjectContents = (
  target: JsonObjectValue,
  source: JsonObjectValue,
): void => {
  for (const key of Object.keys(target)) {
    delete target[key]
  }
  for (const [key, value] of Object.entries(source)) {
    target[key] = value
  }
}

const setJsonValueAtPath = (
  root: JsonObjectValue,
  path: JsonPath,
  nextValue: JsonValue,
): JsonObjectValue => {
  const draft = cloneJsonObjectValue(root)
  if (path.length === 0) {
    if (isJsonObjectValue(nextValue)) {
      replaceRootObjectContents(draft, nextValue)
    }
    return draft
  }

  const parent = getJsonValueAtPath(draft, path.slice(0, -1))
  const segment = path[path.length - 1]
  if (Array.isArray(parent) && typeof segment === 'number') {
    parent[segment] = nextValue
  } else if (isJsonObjectValue(parent) && typeof segment === 'string') {
    parent[segment] = nextValue
  }
  return draft
}

const useAnimatedMountState = (
  open: boolean,
  durationMs: number,
): { mounted: boolean; visible: boolean } => {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(open)
  const mountedRef = useRef(open)
  const closeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = mounted
  }, [mounted])

  useEffect(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (open) {
      mountedRef.current = true
      setMounted(true)
      const frameId = window.requestAnimationFrame(() => setVisible(true))
      return () => window.cancelAnimationFrame(frameId)
    }

    setVisible(false)
    if (!mountedRef.current) {
      return
    }

    closeTimerRef.current = window.setTimeout(() => {
      mountedRef.current = false
      setMounted(false)
      closeTimerRef.current = null
    }, durationMs)

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [durationMs, open])

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    },
    [],
  )

  return { mounted, visible }
}

const deleteJsonValueAtPath = (root: JsonObjectValue, path: JsonPath): JsonObjectValue => {
  const draft = cloneJsonObjectValue(root)
  const parent = getJsonValueAtPath(draft, path.slice(0, -1))
  const segment = path[path.length - 1]
  if (Array.isArray(parent) && typeof segment === 'number') {
    parent.splice(segment, 1)
  } else if (isJsonObjectValue(parent) && typeof segment === 'string') {
    delete parent[segment]
  }
  return draft
}

const renameJsonObjectKey = (
  root: JsonObjectValue,
  path: JsonPath,
  nextKey: string,
): JsonObjectValue => {
  const currentKey = path[path.length - 1]
  if (typeof currentKey !== 'string') {
    return root
  }

  const draft = cloneJsonObjectValue(root)
  const parent = getJsonValueAtPath(draft, path.slice(0, -1))
  if (!isJsonObjectValue(parent) || !Object.prototype.hasOwnProperty.call(parent, currentKey)) {
    return root
  }

  const nextEntries = Object.entries(parent).map(([key, value]) =>
    key === currentKey ? ([nextKey, value] as const) : ([key, value] as const),
  )
  replaceRootObjectContents(parent, Object.fromEntries(nextEntries) as JsonObjectValue)
  return draft
}

const addJsonObjectEntry = (
  root: JsonObjectValue,
  path: JsonPath,
  nextKey: string,
  nextType: JsonValueType,
): JsonObjectValue => {
  const draft = cloneJsonObjectValue(root)
  const target = getJsonValueAtPath(draft, path)
  if (isJsonObjectValue(target)) {
    target[nextKey] = createDefaultJsonValue(nextType)
  }
  return draft
}

const addJsonArrayItem = (
  root: JsonObjectValue,
  path: JsonPath,
  nextType: JsonValueType,
): JsonObjectValue => {
  const draft = cloneJsonObjectValue(root)
  const target = getJsonValueAtPath(draft, path)
  if (Array.isArray(target)) {
    target.push(createDefaultJsonValue(nextType))
  }
  return draft
}

const moveJsonArrayItem = (
  root: JsonObjectValue,
  path: JsonPath,
  direction: -1 | 1,
): JsonObjectValue => {
  const currentIndex = path[path.length - 1]
  if (typeof currentIndex !== 'number') {
    return root
  }

  const draft = cloneJsonObjectValue(root)
  const parent = getJsonValueAtPath(draft, path.slice(0, -1))
  if (!Array.isArray(parent)) {
    return root
  }

  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= parent.length) {
    return root
  }

  const [item] = parent.splice(currentIndex, 1)
  if (item === undefined) {
    return root
  }
  parent.splice(nextIndex, 0, item)
  return draft
}

function JsonObjectKeyInput({ onCommit, siblingKeys, value }: JsonObjectKeyInputProps) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(value)
    setError(null)
  }, [value])

  const commit = (): void => {
    const nextKey = draft.trim()
    if (nextKey === value) {
      setError(null)
      setDraft(value)
      return
    }
    if (!nextKey) {
      setError('键名不能为空。')
      return
    }
    if (siblingKeys.some((item) => item === nextKey && item !== value)) {
      setError('键名不能重复。')
      return
    }
    onCommit(nextKey)
    setError(null)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      return
    }
    if (event.key === 'Escape') {
      setDraft(value)
      setError(null)
    }
  }

  return (
    <label className="field json-inline-field">
      <span>键名</span>
      <ChatInputBox
        className="settings-chat-input settings-chat-input-compact json-text-input"
        value={draft}
        onChange={(event) => {
          setDraft(sanitizeSingleLineInput(event.target.value))
          if (error) {
            setError(null)
          }
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder="输入键名"
        maxHeight={MAX_INLINE_INPUT_HEIGHT}
      />
      {error ? <span className="json-editor-error">{error}</span> : null}
    </label>
  )
}

function JsonNumberInput({ onCommit, value }: JsonNumberInputProps) {
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(String(value))
    setError(null)
  }, [value])

  const commit = (): void => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setDraft(String(value))
      setError('请输入有效数字。')
      return
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      setError('数字格式无效。')
      return
    }

    onCommit(parsed)
    setDraft(String(parsed))
    setError(null)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      return
    }
    if (event.key === 'Escape') {
      setDraft(String(value))
      setError(null)
    }
  }

  return (
    <label className="field json-inline-field">
      <span>数字值</span>
      <ChatInputBox
        className="settings-chat-input settings-chat-input-compact json-text-input"
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          const nextDraft = sanitizeSingleLineInput(event.target.value)
          setDraft(nextDraft)
          if (error) {
            setError(null)
          }
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder="0"
        maxHeight={MAX_INLINE_INPUT_HEIGHT}
      />
      {error ? <span className="json-editor-error">{error}</span> : null}
    </label>
  )
}

function JsonTypePicker({ onChange, value }: JsonTypePickerProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState<JsonTypePopoverLayout | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const openFrameRef = useRef<number[]>([])
  const currentLabel = getJsonValueTypeLabel(value)

  const clearCloseTimer = (): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const clearOpenFrames = (): void => {
    openFrameRef.current.forEach((frameId) => window.cancelAnimationFrame(frameId))
    openFrameRef.current = []
  }

  const updateLayout = (measuredHeight?: number): JsonTypePopoverLayout | null => {
    const triggerElement = triggerRef.current
    if (!triggerElement) {
      return null
    }

    const nextLayout = resolveJsonTypePopoverLayout(
      triggerElement.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
      measuredHeight ?? popoverRef.current?.getBoundingClientRect().height,
    )
    setLayout(nextLayout)
    return nextLayout
  }

  const closePopover = (): void => {
    clearCloseTimer()
    clearOpenFrames()
    setOpen(false)
    setVisible(false)
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      setLayout(null)
      closeTimerRef.current = null
    }, ANIMATED_VISIBILITY_DURATION_MS)
  }

  const openPopover = (): void => {
    clearCloseTimer()
    clearOpenFrames()
    updateLayout()
    setOpen(true)
    setMounted(true)
    setVisible(false)

    const firstFrameId = window.requestAnimationFrame(() => {
      const secondFrameId = window.requestAnimationFrame(() => {
        updateLayout()
        setVisible(true)
        openFrameRef.current = []
      })
      openFrameRef.current = [secondFrameId]
    })

    openFrameRef.current = [firstFrameId]
  }

  useEffect(() => {
    if (!mounted) {
      return
    }

    const handlePointerDown = (event: Event): void => {
      if (
        containerRef.current?.contains(event.target as Node) ||
        popoverRef.current?.contains(event.target as Node)
      ) {
        return
      }
      closePopover()
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closePopover()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, { passive: true })
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mounted])

  useLayoutEffect(() => {
    if (!mounted) {
      setLayout(null)
      return
    }

    const handleLayoutChange = (): void => {
      updateLayout()
    }

    handleLayoutChange()
    window.addEventListener('resize', handleLayoutChange)
    window.addEventListener('scroll', handleLayoutChange, true)

    return () => {
      window.removeEventListener('resize', handleLayoutChange)
      window.removeEventListener('scroll', handleLayoutChange, true)
    }
  }, [mounted])

  useEffect(
    () => () => {
      clearCloseTimer()
      clearOpenFrames()
    },
    [],
  )

  return (
    <div className="model-picker json-type-picker" ref={containerRef}>
      <button
        type="button"
        className="model-trigger json-type-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        ref={triggerRef}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (open) {
            closePopover()
            return
          }
          openPopover()
        }}
      >
        <span>{currentLabel}</span>
        <span className={`arrow ${open ? 'open' : ''}`}>▾</span>
      </button>

      {mounted && layout
        ? createPortal(
            <>
              <div
                aria-hidden="true"
                className="model-trigger json-type-trigger json-type-trigger-overlay"
                style={{
                  height: layout.triggerHeight,
                  left: layout.triggerLeft,
                  top: layout.triggerTop,
                  width: layout.triggerWidth,
                }}
              >
                <span>{currentLabel}</span>
                <span className={`arrow ${open ? 'open' : ''}`}>▾</span>
              </div>

              <div
                ref={popoverRef}
                className={`model-popover json-type-popover frosted-surface ${
                  layout.placement === 'below' ? 'is-below' : 'is-above'
                } ${visible ? 'is-open' : 'is-closing'}`}
                role="listbox"
                style={{
                  bottom: layout.bottom ?? 'auto',
                  left: layout.left,
                  maxHeight: layout.maxHeight,
                  top: layout.top ?? 'auto',
                  width: layout.width,
                }}
              >
                {JSON_VALUE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`model-option ${value === option.value ? 'active' : ''}`}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onChange(option.value)
                      closePopover()
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}

interface JsonAnimatedSectionProps {
  children: ReactNode
  className: string
  innerClassName: string
  open: boolean
}

function JsonAnimatedSection({
  children,
  className,
  innerClassName,
  open,
}: JsonAnimatedSectionProps) {
  const { mounted, visible } = useAnimatedMountState(open, ANIMATED_VISIBILITY_DURATION_MS)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    if (!mounted) {
      setHeight(0)
      return
    }

    const updateHeight = (): void => {
      setHeight(innerRef.current?.scrollHeight ?? 0)
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)

    if (typeof ResizeObserver === 'undefined' || !innerRef.current) {
      return () => window.removeEventListener('resize', updateHeight)
    }

    const observer = new ResizeObserver(() => updateHeight())
    observer.observe(innerRef.current)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [mounted])

  if (!mounted) {
    return null
  }

  return (
    <div
      className={`${className} ${visible ? 'is-open' : ''}`}
      style={{
        height: visible ? height : 0,
      }}
    >
      <div ref={innerRef} className={innerClassName}>
        {children}
      </div>
    </div>
  )
}

function JsonObjectAddRow({ existingKeys, onAdd }: JsonObjectAddRowProps) {
  const [keyDraft, setKeyDraft] = useState('')
  const [nextType, setNextType] = useState<JsonValueType>('string')
  const [error, setError] = useState<string | null>(null)

  const handleAdd = (): void => {
    const nextKey = keyDraft.trim()
    if (!nextKey) {
      setError('键名不能为空。')
      return
    }
    if (existingKeys.includes(nextKey)) {
      setError('键名不能重复。')
      return
    }
    onAdd(nextKey, nextType)
    setKeyDraft('')
    setNextType('string')
    setError(null)
  }

  return (
    <div className="json-add-panel">
      <div className="json-add-row json-add-row-object">
        <ChatInputBox
          className="settings-chat-input settings-chat-input-compact json-text-input"
          value={keyDraft}
          onChange={(event) => {
            setKeyDraft(sanitizeSingleLineInput(event.target.value))
            if (error) {
              setError(null)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleAdd()
            }
          }}
          placeholder="新增键名"
          maxHeight={MAX_INLINE_INPUT_HEIGHT}
        />

        <JsonTypePicker value={nextType} onChange={setNextType} />

        <button type="button" className="tiny-button" onClick={handleAdd}>
          {nextType === 'object' ? '新增分组' : '新增字段'}
        </button>
      </div>

      {error ? (
        <span className="json-editor-error">{error}</span>
      ) : (
        <span className="settings-entry-meta">对象类型可直接作为新的分组使用。</span>
      )}
    </div>
  )
}

function JsonArrayAddRow({ onAdd }: JsonArrayAddRowProps) {
  const [nextType, setNextType] = useState<JsonValueType>('string')

  return (
    <div className="json-add-panel">
      <div className="json-add-row">
        <JsonTypePicker value={nextType} onChange={setNextType} />

        <button type="button" className="tiny-button" onClick={() => onAdd(nextType)}>
          新增元素
        </button>
      </div>
    </div>
  )
}

function JsonEditorNode({
  canMoveDown,
  canMoveUp,
  expandedStructures,
  isRoot = false,
  label,
  onToggleNode,
  onToggleStructure,
  onAddArrayItem,
  onAddObjectEntry,
  onDelete,
  onMoveArrayItem,
  onRenameObjectKey,
  onValueChange,
  openNodes,
  path,
  siblingKeys = [],
  value,
}: JsonEditorNodeProps) {
  const valueType = getJsonValueType(value)
  const pathLabel = formatJsonPath(path)
  const metaLabel = isRoot ? `根对象 · ${describeJsonValue(value)}` : `${pathLabel} · ${describeJsonValue(value)}`
  const nodeOpen = isRoot || openNodes[pathLabel] === true
  const hasStructure = valueType === 'object' || valueType === 'array'
  const structureExpanded = expandedStructures[pathLabel] === true
  const structureLabel = valueType === 'object' ? '字段结构' : valueType === 'array' ? '数组结构' : ''
  const objectEntries = valueType === 'object' ? Object.entries(value as JsonObjectValue) : []
  const arrayEntries = valueType === 'array' ? (value as JsonArrayValue) : []
  const titleLabel = isRoot ? '根对象' : label
  const valueTypeLabel = getJsonValueTypeLabel(valueType)
  const collapsedValuePreview = getCollapsedValuePreview(value, valueType)
  const { mounted: structureMounted, visible: structureVisible } = useAnimatedMountState(
    hasStructure && structureExpanded,
    ANIMATED_VISIBILITY_DURATION_MS,
  )
  const nodeHeader = isRoot ? (
    <div className="json-node-header">
      <div className="json-node-title-group">
        <div className="settings-entry-title">{titleLabel}</div>
        <div className="json-node-meta">{metaLabel}</div>
      </div>
      <span className="json-type-badge">{valueTypeLabel}</span>
    </div>
  ) : (
    <button type="button" className="reasoning-toggle json-node-toggle" onClick={() => onToggleNode(path)}>
      <span className="json-node-toggle-main">
        <span className="settings-entry-title json-node-summary-title">{titleLabel}</span>
        <span className="json-node-summary-type-text">{valueTypeLabel}</span>
        {collapsedValuePreview ? (
          <span className="json-node-preview" title={collapsedValuePreview}>
            {collapsedValuePreview}
          </span>
        ) : null}
      </span>
      <span className={`arrow ${nodeOpen ? 'open' : ''}`}>▾</span>
    </button>
  )

  const nodeToolbar = isRoot ? null : (
    <div className="json-node-toolbar">
      <div className="field json-inline-field json-type-field">
        <span>类型</span>
        <JsonTypePicker
          value={valueType}
          onChange={(nextType) => onValueChange(path, createDefaultJsonValue(nextType))}
        />
      </div>

      {canMoveUp ? (
        <button type="button" className="tiny-button ghost-button" onClick={() => onMoveArrayItem(path, -1)}>
          上移
        </button>
      ) : null}
      {canMoveDown ? (
        <button type="button" className="tiny-button ghost-button" onClick={() => onMoveArrayItem(path, 1)}>
          下移
        </button>
      ) : null}
      <button type="button" className="tiny-button danger-button" onClick={() => onDelete(path)}>
        删除
      </button>
    </div>
  )

  return (
    <div className={`settings-static-card json-node-card ${isRoot ? 'is-root' : ''} ${nodeOpen ? 'is-open' : ''}`}>
      {nodeHeader}

      {isRoot ? (
        <div className="json-node-body is-open">
          <div className="json-node-body-inner">
            {!isRoot ? (
              <div className="json-node-editor-head">
                <div className="json-node-heading">
                  {typeof path[path.length - 1] === 'string' ? (
                    <JsonObjectKeyInput
                      value={label}
                      siblingKeys={siblingKeys}
                      onCommit={(nextKey) => onRenameObjectKey(path, nextKey)}
                    />
                  ) : (
                    <div className="json-node-title-group">
                      <div className="settings-entry-title">{label}</div>
                      <div className="json-node-meta">{metaLabel}</div>
                    </div>
                  )}
                </div>
                {nodeToolbar}
              </div>
            ) : null}

            {valueType === 'string' ? (
              <label className="field">
                <span>字符串值</span>
                <ChatInputBox
                  className="settings-chat-input json-textarea-input json-value-textarea"
                  value={value as string}
                  onChange={(event) => onValueChange(path, event.target.value)}
                  placeholder="输入字符串"
                  maxHeight={MAX_INLINE_TEXTAREA_HEIGHT}
                />
              </label>
            ) : null}

            {valueType === 'number' ? (
              <JsonNumberInput
                value={value as number}
                onCommit={(nextValue) => onValueChange(path, nextValue)}
              />
            ) : null}

            {valueType === 'boolean' ? (
              <label className="toggle-row json-boolean-row">
                <span>布尔值</span>
                <input
                  className="toggle-switch"
                  type="checkbox"
                  checked={value as boolean}
                  onChange={(event) => onValueChange(path, event.target.checked)}
                />
              </label>
            ) : null}

            {valueType === 'null' ? (
              <p className="summary-muted json-editor-empty">
                当前值为 null，可通过上方类型切换为其他类型。
              </p>
            ) : null}

            {hasStructure && !isRoot ? (
              <section className="json-structure-group conversation-group">
                <div className="conversation-group-divider json-structure-divider">
                  <span className="conversation-group-label">{structureLabel}</span>
                  <span className="conversation-group-dash" aria-hidden="true" />
                  <button
                    type="button"
                    className="conversation-group-toggle"
                    aria-label={structureExpanded ? '收起结构' : '展开结构'}
                    onClick={() => onToggleStructure(path)}
                  >
                    <span className={`arrow ${structureVisible ? 'open' : ''}`}>▾</span>
                  </button>
                </div>

                <div className={`conversation-group-content ${structureVisible ? '' : 'is-collapsed'}`}>
                  {structureMounted ? (
                    <div className="conversation-group-content-inner json-structure-content">
                      {valueType === 'object' ? (
                        <>
                          {objectEntries.length > 0 ? (
                            <div className="json-node-children">
                              {objectEntries.map(([childKey, childValue]) => (
                                <JsonEditorNode
                                  key={`${pathLabel}.${childKey}`}
                                  label={childKey}
                                  path={[...path, childKey]}
                                  value={childValue}
                                  siblingKeys={Object.keys(value as JsonObjectValue)}
                                  onValueChange={onValueChange}
                                  onDelete={onDelete}
                                  onRenameObjectKey={onRenameObjectKey}
                                  onAddObjectEntry={onAddObjectEntry}
                                  onAddArrayItem={onAddArrayItem}
                                  onMoveArrayItem={onMoveArrayItem}
                                  openNodes={openNodes}
                                  expandedStructures={expandedStructures}
                                  onToggleNode={onToggleNode}
                                  onToggleStructure={onToggleStructure}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="summary-muted json-editor-empty">当前对象为空。</p>
                          )}

                          <JsonObjectAddRow
                            existingKeys={Object.keys(value as JsonObjectValue)}
                            onAdd={(nextKey, nextType) => onAddObjectEntry(path, nextKey, nextType)}
                          />
                        </>
                      ) : null}

                      {valueType === 'array' ? (
                        <>
                          {arrayEntries.length > 0 ? (
                            <div className="json-node-children">
                              {arrayEntries.map((childValue, index) => (
                                <JsonEditorNode
                                  key={`${pathLabel}[${index}]`}
                                  label={`元素 ${index + 1}`}
                                  path={[...path, index]}
                                  value={childValue}
                                  canMoveUp={index > 0}
                                  canMoveDown={index < arrayEntries.length - 1}
                                  onValueChange={onValueChange}
                                  onDelete={onDelete}
                                  onRenameObjectKey={onRenameObjectKey}
                                  onAddObjectEntry={onAddObjectEntry}
                                  onAddArrayItem={onAddArrayItem}
                                  onMoveArrayItem={onMoveArrayItem}
                                  openNodes={openNodes}
                                  expandedStructures={expandedStructures}
                                  onToggleNode={onToggleNode}
                                  onToggleStructure={onToggleStructure}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="summary-muted json-editor-empty">当前数组为空。</p>
                          )}

                          <JsonArrayAddRow onAdd={(nextType) => onAddArrayItem(path, nextType)} />
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {valueType === 'object' && isRoot ? (
              <>
                {objectEntries.length > 0 ? (
                  <div className="json-node-children">
                    {objectEntries.map(([childKey, childValue]) => (
                      <JsonEditorNode
                        key={`${pathLabel}.${childKey}`}
                        label={childKey}
                        path={[...path, childKey]}
                        value={childValue}
                        siblingKeys={Object.keys(value as JsonObjectValue)}
                        onValueChange={onValueChange}
                        onDelete={onDelete}
                        onRenameObjectKey={onRenameObjectKey}
                        onAddObjectEntry={onAddObjectEntry}
                        onAddArrayItem={onAddArrayItem}
                        onMoveArrayItem={onMoveArrayItem}
                        openNodes={openNodes}
                        expandedStructures={expandedStructures}
                        onToggleNode={onToggleNode}
                        onToggleStructure={onToggleStructure}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="summary-muted json-editor-empty">当前对象为空。</p>
                )}

                <JsonObjectAddRow
                  existingKeys={Object.keys(value as JsonObjectValue)}
                  onAdd={(nextKey, nextType) => onAddObjectEntry(path, nextKey, nextType)}
                />
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <JsonAnimatedSection
          className="json-node-body"
          innerClassName="json-node-body-inner"
          open={nodeOpen}
        >
          <div className="json-node-editor-head">
            <div className="json-node-heading">
              {typeof path[path.length - 1] === 'string' ? (
                <JsonObjectKeyInput
                  value={label}
                  siblingKeys={siblingKeys}
                  onCommit={(nextKey) => onRenameObjectKey(path, nextKey)}
                />
              ) : (
                <div className="json-node-title-group">
                  <div className="settings-entry-title">{label}</div>
                  <div className="json-node-meta">{metaLabel}</div>
                </div>
              )}
            </div>
            {nodeToolbar}
          </div>

          {valueType === 'string' ? (
            <label className="field">
              <span>字符串值</span>
              <ChatInputBox
                className="settings-chat-input json-textarea-input json-value-textarea"
                value={value as string}
                onChange={(event) => onValueChange(path, event.target.value)}
                placeholder="输入字符串"
                maxHeight={MAX_INLINE_TEXTAREA_HEIGHT}
              />
            </label>
          ) : null}

          {valueType === 'number' ? (
            <JsonNumberInput
              value={value as number}
              onCommit={(nextValue) => onValueChange(path, nextValue)}
            />
          ) : null}

          {valueType === 'boolean' ? (
            <label className="toggle-row json-boolean-row">
              <span>布尔值</span>
              <input
                className="toggle-switch"
                type="checkbox"
                checked={value as boolean}
                onChange={(event) => onValueChange(path, event.target.checked)}
              />
            </label>
          ) : null}

          {valueType === 'null' ? (
            <p className="summary-muted json-editor-empty">
              当前值为 null，可通过上方类型切换为其他类型。
            </p>
          ) : null}

          {hasStructure ? (
            <section className="json-structure-group conversation-group">
              <div className="conversation-group-divider json-structure-divider">
                <span className="conversation-group-label">{structureLabel}</span>
                <span className="conversation-group-dash" aria-hidden="true" />
                <button
                  type="button"
                  className="conversation-group-toggle"
                  aria-label={structureExpanded ? '收起结构' : '展开结构'}
                  onClick={() => onToggleStructure(path)}
                >
                  <span className={`arrow ${structureVisible ? 'open' : ''}`}>▾</span>
                </button>
              </div>

              <div className={`conversation-group-content ${structureVisible ? '' : 'is-collapsed'}`}>
                {structureMounted ? (
                  <div className="conversation-group-content-inner json-structure-content">
                    {valueType === 'object' ? (
                      <>
                        {objectEntries.length > 0 ? (
                          <div className="json-node-children">
                            {objectEntries.map(([childKey, childValue]) => (
                              <JsonEditorNode
                                key={`${pathLabel}.${childKey}`}
                                label={childKey}
                                path={[...path, childKey]}
                                value={childValue}
                                siblingKeys={Object.keys(value as JsonObjectValue)}
                                onValueChange={onValueChange}
                                onDelete={onDelete}
                                onRenameObjectKey={onRenameObjectKey}
                                onAddObjectEntry={onAddObjectEntry}
                                onAddArrayItem={onAddArrayItem}
                                onMoveArrayItem={onMoveArrayItem}
                                openNodes={openNodes}
                                expandedStructures={expandedStructures}
                                onToggleNode={onToggleNode}
                                onToggleStructure={onToggleStructure}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="summary-muted json-editor-empty">当前对象为空。</p>
                        )}

                        <JsonObjectAddRow
                          existingKeys={Object.keys(value as JsonObjectValue)}
                          onAdd={(nextKey, nextType) => onAddObjectEntry(path, nextKey, nextType)}
                        />
                      </>
                    ) : null}

                    {valueType === 'array' ? (
                      <>
                        {arrayEntries.length > 0 ? (
                          <div className="json-node-children">
                            {arrayEntries.map((childValue, index) => (
                              <JsonEditorNode
                                key={`${pathLabel}[${index}]`}
                                label={`元素 ${index + 1}`}
                                path={[...path, index]}
                                value={childValue}
                                canMoveUp={index > 0}
                                canMoveDown={index < arrayEntries.length - 1}
                                onValueChange={onValueChange}
                                onDelete={onDelete}
                                onRenameObjectKey={onRenameObjectKey}
                                onAddObjectEntry={onAddObjectEntry}
                                onAddArrayItem={onAddArrayItem}
                                onMoveArrayItem={onMoveArrayItem}
                                openNodes={openNodes}
                                expandedStructures={expandedStructures}
                                onToggleNode={onToggleNode}
                                onToggleStructure={onToggleStructure}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="summary-muted json-editor-empty">当前数组为空。</p>
                        )}

                        <JsonArrayAddRow onAdd={(nextType) => onAddArrayItem(path, nextType)} />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </JsonAnimatedSection>
      )}
    </div>
  )
}

function SkillConfigJsonEditor({ onChange, value }: SkillConfigJsonEditorProps) {
  const [openNodes, setOpenNodes] = useState<CollapseStateMap>({})
  const [expandedStructures, setExpandedStructures] = useState<CollapseStateMap>({})

  useEffect(() => {
    setOpenNodes((previous) => syncCollapseStateMap(previous, collectNodePathKeys(value), false))
    setExpandedStructures((previous) =>
      syncCollapseStateMap(previous, collectStructurePathKeys(value), false),
    )
  }, [value])

  const toggleNode = (path: JsonPath): void => {
    const pathKey = formatJsonPath(path)
    setOpenNodes((previous) => ({
      ...previous,
      [pathKey]: !(previous[pathKey] === true),
    }))
  }

  const toggleStructure = (path: JsonPath): void => {
    const pathKey = formatJsonPath(path)
    setExpandedStructures((previous) => ({
      ...previous,
      [pathKey]: !(previous[pathKey] === true),
    }))
  }

  return (
    <div className="json-editor">
      <JsonEditorNode
        label="root"
        path={[]}
        value={value}
        isRoot
        onValueChange={(path, nextValue) => onChange(setJsonValueAtPath(value, path, nextValue))}
        onDelete={(path) => onChange(deleteJsonValueAtPath(value, path))}
        onRenameObjectKey={(path, nextKey) => onChange(renameJsonObjectKey(value, path, nextKey))}
        onAddObjectEntry={(path, nextKey, nextType) =>
          onChange(addJsonObjectEntry(value, path, nextKey, nextType))
        }
        onAddArrayItem={(path, nextType) => onChange(addJsonArrayItem(value, path, nextType))}
        onMoveArrayItem={(path, direction) => onChange(moveJsonArrayItem(value, path, direction))}
        openNodes={openNodes}
        expandedStructures={expandedStructures}
        onToggleNode={toggleNode}
        onToggleStructure={toggleStructure}
      />
    </div>
  )
}

export default SkillConfigJsonEditor
