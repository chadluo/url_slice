import { useState, type JSX } from 'react'
import type { UrlModel } from '../utils/urlParser.js'
import { Dropdown } from './Dropdown.js'
import { useHistorySuggestions } from '../hooks/useHistorySuggestions.js'

interface EditorProps {
  model: UrlModel
  onChange: (updated: UrlModel) => void
}

interface SubdomainChipProps {
  value: string
  currentHost: string
  onSelect: (suggestion: string) => void
}

function SubdomainChip({ value, currentHost, onSelect }: SubdomainChipProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const suggestions = useHistorySuggestions(value, 'host', currentHost)

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-sm font-mono text-gray-800 border border-gray-300"
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
  )
}

interface DomainChipProps {
  value: string
  onSelect: (suggestion: string) => void
}

function DomainChip({ value, onSelect }: DomainChipProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const suggestions = useHistorySuggestions(value, 'host', value)

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-sm font-mono text-blue-800 border border-blue-200"
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
  )
}

export function HostEditor({ model, onChange }: EditorProps): JSX.Element {
  const fullHostname = [...model.subdomains, model.domain].join('.')

  function handleSubdomainSelect(index: number, suggestion: string) {
    const newSubdomains = [...model.subdomains]
    newSubdomains[index] = suggestion
    onChange({ ...model, subdomains: newSubdomains })
  }

  function handleDomainSelect(suggestion: string) {
    // Parse the full hostname suggestion into subdomains + domain
    const parts = suggestion.split('.')
    if (parts.length <= 2) {
      onChange({ ...model, subdomains: [], domain: suggestion })
    } else {
      onChange({
        ...model,
        subdomains: parts.slice(0, -2),
        domain: parts.slice(-2).join('.'),
      })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 font-mono text-sm">
      <span className="text-gray-400">{model.protocol}//</span>
      {model.subdomains.map((sub, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <SubdomainChip
            value={sub}
            currentHost={model.domain}
            onSelect={(s) => handleSubdomainSelect(i, s)}
          />
          <span className="text-gray-400">.</span>
        </span>
      ))}
      <DomainChip value={model.domain} onSelect={handleDomainSelect} />
    </div>
  )
}
