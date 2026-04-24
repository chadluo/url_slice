import { useState, type JSX } from 'react'
import type { UrlModel } from '../utils/urlParser.js'
import { Dropdown } from './Dropdown.js'
import { useHistorySuggestions } from '../hooks/useHistorySuggestions.js'

interface EditorProps {
  model: UrlModel
  onChange: (updated: UrlModel) => void
}

const CLEAR_SENTINEL = '(none)'

interface SubdomainChipProps {
  value: string
  subdomainSuffix: string
  onSelect: (suggestion: string) => void
  onClear: () => void
}

function SubdomainChip({ value, subdomainSuffix, onSelect, onClear }: SubdomainChipProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const suggestions = useHistorySuggestions(subdomainSuffix, 'subdomain-segment', subdomainSuffix, value)
  const items = [CLEAR_SENTINEL, ...suggestions]

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
      items={items}
      onSelect={(s) => {
        if (s === CLEAR_SENTINEL) {
          onClear()
        } else {
          onSelect(s)
        }
        setOpen(false)
      }}
      open={open}
      onOpenChange={setOpen}
      placeholder="No suggestions"
    />
  )
}

function DomainChip({ value }: { value: string }): JSX.Element {
  return (
    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-sm font-mono text-blue-800 border border-blue-200 select-all">
      {value}
    </span>
  )
}

export function HostEditor({ model, onChange }: EditorProps): JSX.Element {
  function handleSubdomainSelect(index: number, suggestion: string) {
    const newSubdomains = [...model.subdomains]
    newSubdomains[index] = suggestion
    onChange({ ...model, subdomains: newSubdomains })
  }

  function handleSubdomainClear(index: number) {
    const newSubdomains = model.subdomains.filter((_, i) => i !== index)
    onChange({ ...model, subdomains: newSubdomains })
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 font-mono text-sm">
      <span className="text-gray-400">{model.protocol}//</span>
      {model.subdomains.map((sub, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <SubdomainChip
            value={sub}
            subdomainSuffix={[...model.subdomains.slice(i + 1), model.domain].join('.')}
            onSelect={(s) => handleSubdomainSelect(i, s)}
            onClear={() => handleSubdomainClear(i)}
          />
          <span className="text-gray-400">.</span>
        </span>
      ))}
      <DomainChip value={model.domain} />
    </div>
  )
}
