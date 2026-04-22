import { useState, useRef, useEffect, type JSX } from 'react'
import type { UrlModel } from '../utils/urlParser.js'
import { Dropdown } from './Dropdown.js'
import { useHistorySuggestions } from '../hooks/useHistorySuggestions.js'

interface EditorProps {
  model: UrlModel
  onChange: (updated: UrlModel) => void
}

interface SegmentChipProps {
  value: string
  currentHost: string
  onSelect: (suggestion: string) => void
  onEdit: (value: string) => void
  onRemoveBefore: () => void
}

function SegmentChip({
  value,
  currentHost,
  onSelect,
  onEdit,
  onRemoveBefore,
}: SegmentChipProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [hovering, setHovering] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestions = useHistorySuggestions(value, 'path', currentHost)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function commitEdit() {
    setEditing(false)
    if (editValue !== value) {
      onEdit(editValue)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      setEditValue(value)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        className="px-1.5 py-0.5 rounded border border-blue-400 text-sm font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-8"
        style={{ width: `${Math.max(editValue.length, 3) + 2}ch` }}
      />
    )
  }

  return (
    <span
      className="relative flex items-center"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {hovering && (
        <button
          type="button"
          onClick={onRemoveBefore}
          className="absolute -left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs leading-none z-10"
          title="Truncate path here"
          aria-label="Truncate path before this segment"
        >
          ×
        </button>
      )}
      <Dropdown
        trigger={
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            onDoubleClick={(e) => {
              e.preventDefault()
              setOpen(false)
              setEditValue(value)
              setEditing(true)
            }}
            className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-sm font-mono text-gray-800 border border-gray-300"
            title="Click to see suggestions, double-click to edit"
          >
            {value}
          </button>
        }
        items={suggestions}
        onSelect={(s) => {
          onSelect(s)
          setOpen(false)
        }}
        open={open}
        onOpenChange={setOpen}
        placeholder="No suggestions"
      />
    </span>
  )
}

interface NewSegmentChipProps {
  currentHost: string
  onCommit: (value: string) => void
  onCancel: () => void
}

function NewSegmentChip({ currentHost, onCommit, onCancel }: NewSegmentChipProps): JSX.Element {
  const [open, setOpen] = useState(true)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestions = useHistorySuggestions(value, 'path', currentHost)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  function commit() {
    const trimmed = value.trim()
    if (trimmed) {
      onCommit(trimmed)
    } else {
      onCancel()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <Dropdown
      trigger={
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          placeholder="segment"
          className="px-1.5 py-0.5 rounded border border-blue-400 text-sm font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 w-20"
        />
      }
      items={suggestions}
      onSelect={(s) => {
        onCommit(s)
        setOpen(false)
      }}
      open={open}
      onOpenChange={setOpen}
      placeholder="Type to search"
    />
  )
}

export function PathEditor({ model, onChange }: EditorProps): JSX.Element {
  const [addingNew, setAddingNew] = useState(false)
  const fullHostname = [...model.subdomains, model.domain].join('.')

  function handleSegmentSelect(index: number, suggestion: string) {
    const newSegments = [...model.pathSegments]
    newSegments[index] = suggestion
    onChange({ ...model, pathSegments: newSegments })
  }

  function handleSegmentEdit(index: number, value: string) {
    const newSegments = [...model.pathSegments]
    newSegments[index] = value
    onChange({ ...model, pathSegments: newSegments })
  }

  function handleTruncateBefore(index: number) {
    onChange({ ...model, pathSegments: model.pathSegments.slice(0, index) })
  }

  function handleAddSegment(value: string) {
    onChange({ ...model, pathSegments: [...model.pathSegments, value] })
    setAddingNew(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 font-mono text-sm">
      <span className="text-gray-400">/</span>
      {model.pathSegments.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <SegmentChip
            value={seg}
            currentHost={fullHostname}
            onSelect={(s) => handleSegmentSelect(i, s)}
            onEdit={(v) => handleSegmentEdit(i, v)}
            onRemoveBefore={() => handleTruncateBefore(i)}
          />
          {i < model.pathSegments.length - 1 && (
            <span className="text-gray-400">/</span>
          )}
        </span>
      ))}
      {addingNew ? (
        <span className="flex items-center gap-0.5">
          {model.pathSegments.length > 0 && <span className="text-gray-400">/</span>}
          <NewSegmentChip
            currentHost={fullHostname}
            onCommit={handleAddSegment}
            onCancel={() => setAddingNew(false)}
          />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs border border-gray-300 ml-0.5"
          aria-label="Add path segment"
          title="Add path segment"
        >
          +
        </button>
      )}
    </div>
  )
}
