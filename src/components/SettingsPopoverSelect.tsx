import { useEffect, useMemo, useRef, useState } from 'react'

export interface SettingsPopoverSelectOption<Value extends string> {
  value: Value
  label: string
}

interface SettingsPopoverSelectProps<Value extends string> {
  value: Value
  options: SettingsPopoverSelectOption<Value>[]
  onChange: (nextValue: Value) => void
  ariaLabel: string
}

export default function SettingsPopoverSelect<Value extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SettingsPopoverSelectProps<Value>) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0] ?? null,
    [options, value],
  )

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="model-picker settings-popover-select">
      <button
        type="button"
        className={`model-trigger settings-popover-trigger ${open ? 'is-open' : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="settings-popover-trigger-label">{selectedOption?.label ?? value}</span>
        <span className={`arrow ${open ? 'open' : ''}`}>▾</span>
      </button>

      {open ? (
        <div className="model-popover settings-popover-menu is-open frosted-surface" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`model-option ${option.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
