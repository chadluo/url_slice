import { useState, type JSX } from 'react'
import type { UrlModel } from '../utils/urlParser.js'
import { Dropdown } from './Dropdown.js'
import { useHistorySuggestions } from '../hooks/useHistorySuggestions.js'

interface EditorProps {
  model: UrlModel
  onChange: (updated: UrlModel) => void
}

export function PortEditor({ model, onChange }: EditorProps): JSX.Element | null {
  const [open, setOpen] = useState(false)

  const showPort =
    model.port !== '' || model.protocol === 'http:' || model.protocol === 'https:'

  if (!showPort) return null

  const fullHostname = [...model.subdomains, model.domain].join('.')
  const suggestions = useHistorySuggestions(model.port, 'port', fullHostname)

  function setPort(value: string) {
    onChange({ ...model, port: value })
  }

  function handleDecrement() {
    const n = parseInt(model.port, 10)
    if (!isNaN(n) && n > 1) {
      setPort(String(n - 1))
    }
  }

  function handleIncrement() {
    if (model.port === '') {
      setPort('3000')
      return
    }
    const n = parseInt(model.port, 10)
    if (!isNaN(n) && n < 65535) {
      setPort(String(n + 1))
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw === '') {
      setPort('')
      return
    }
    // Only allow digits
    if (!/^\d+$/.test(raw)) return
    const n = parseInt(raw, 10)
    if (n >= 1 && n <= 65535) {
      setPort(raw)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-gray-400 text-xs font-mono">:</span>
        <span className="text-xs text-gray-500 font-medium">Port</span>
      </div>
      <div className="flex items-center gap-0.5 font-mono text-sm">
      <button
        type="button"
        onClick={handleDecrement}
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs border border-gray-300"
        aria-label="Decrement port"
      >
        −
      </button>
      <input
        type="text"
        value={model.port}
        onChange={handleInputChange}
        placeholder="port"
        className="w-16 px-1 py-0.5 text-center text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        inputMode="numeric"
        aria-label="Port number"
      />
      <button
        type="button"
        onClick={handleIncrement}
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs border border-gray-300"
        aria-label="Increment port"
      >
        +
      </button>
      <Dropdown
        trigger={
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs border border-gray-300"
            aria-label="Port suggestions"
          >
            ▾
          </button>
        }
        items={suggestions}
        onSelect={(s) => {
          setPort(s)
          setOpen(false)
        }}
        open={open}
        onOpenChange={setOpen}
        placeholder="No suggestions"
      />
      </div>
    </div>
  )
}
