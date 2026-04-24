import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { UrlModel } from '../utils/urlParser';
import { Dropdown } from './Dropdown';
import { useHistorySuggestions } from '../hooks/useHistorySuggestions';

interface SearchParamsEditorProps {
  model: UrlModel;
  onChange: (updated: UrlModel) => void;
}

interface ParamRowProps {
  index: number;
  paramKey: string;
  paramValue: string;
  hostname: string;
  onCommitKey: (index: number, newKey: string) => void;
  onCommitValue: (index: number, newValue: string) => void;
  onRemove: (index: number) => void;
  autoFocusKey?: boolean;
}

function ParamRow({
  index,
  paramKey,
  paramValue,
  hostname,
  onCommitKey,
  onCommitValue,
  onRemove,
  autoFocusKey,
}: ParamRowProps): JSX.Element {
  const [localKey, setLocalKey] = useState(paramKey);
  const [localValue, setLocalValue] = useState(paramValue);
  const [valueDropdownOpen, setValueDropdownOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const keyInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Sync local state when props change from outside
  useEffect(() => {
    setLocalKey(paramKey);
  }, [paramKey]);

  useEffect(() => {
    setLocalValue(paramValue);
  }, [paramValue]);

  // Auto-focus key input for newly added rows
  useEffect(() => {
    if (autoFocusKey && keyInputRef.current) {
      keyInputRef.current.focus();
    }
  }, [autoFocusKey]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [contextMenuOpen]);

  // Value suggestions: use path field as proxy for same-host history
  const valueSuggestions = useHistorySuggestions(localValue, 'path', hostname);

  const handleKeyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommitKey(index, localKey);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setLocalKey(paramKey);
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommitValue(index, localValue);
      setValueDropdownOpen(false);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setLocalValue(paramValue);
      setValueDropdownOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-1 py-0.5">
      {/* Key input with context menu */}
      <div className="relative flex-1 min-w-0" ref={contextMenuRef}>
        <input
          ref={keyInputRef}
          type="text"
          value={localKey}
          onChange={(e) => setLocalKey(e.target.value)}
          onBlur={() => onCommitKey(index, localKey)}
          onKeyDown={handleKeyKeyDown}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenuOpen((v) => !v);
          }}
          className="w-full px-2 py-0.5 border border-gray-200 rounded text-sm font-mono bg-white focus:outline-none focus:border-blue-400"
          placeholder="key"
          spellCheck={false}
        />
        {contextMenuOpen && (
          <ul className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded shadow-md text-sm min-w-[120px]">
            <li
              className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-gray-700"
              onMouseDown={(e) => {
                e.preventDefault();
                setContextMenuOpen(false);
                keyInputRef.current?.focus();
                keyInputRef.current?.select();
              }}
            >
              Rename
            </li>
            <li
              className="px-3 py-1.5 cursor-pointer hover:bg-red-50 text-red-600"
              onMouseDown={(e) => {
                e.preventDefault();
                setContextMenuOpen(false);
                onRemove(index);
              }}
            >
              Remove
            </li>
          </ul>
        )}
      </div>

      <span className="text-gray-400 text-xs select-none">=</span>

      {/* Value input with dropdown suggestions */}
      <div className="flex-[2] min-w-0">
        <Dropdown
          open={valueDropdownOpen && valueSuggestions.length > 0}
          onOpenChange={setValueDropdownOpen}
          items={valueSuggestions}
          onSelect={(item) => {
            setLocalValue(item);
            onCommitValue(index, item);
            setValueDropdownOpen(false);
          }}
          trigger={
            <input
              type="text"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onFocus={() => setValueDropdownOpen(true)}
              onBlur={() => {
                onCommitValue(index, localValue);
                // delay close so dropdown onSelect fires first
                setTimeout(() => setValueDropdownOpen(false), 150);
              }}
              onKeyDown={handleValueKeyDown}
              className="w-full px-2 py-0.5 border border-gray-200 rounded text-sm font-mono bg-white focus:outline-none focus:border-blue-400"
              placeholder="value"
              spellCheck={false}
            />
          }
        />
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-gray-400 hover:text-red-500 text-xs px-1 flex-shrink-0"
        title="Remove param"
      >
        ×
      </button>
    </div>
  );
}

export function SearchParamsEditor({
  model,
  onChange,
}: SearchParamsEditorProps): JSX.Element {
  const [newRowIndex, setNewRowIndex] = useState<number | null>(null);

  const hostname = [
    ...model.subdomains,
    model.domain,
  ]
    .filter(Boolean)
    .join('.');

  const handleCommitKey = useCallback(
    (index: number, newKey: string) => {
      if (newKey === model.searchParams[index]?.[0]) return;
      const updated: [string, string][] = model.searchParams.map((pair, i) =>
        i === index ? [newKey, pair[1]] : pair,
      );
      onChange({ ...model, searchParams: updated });
    },
    [model, onChange],
  );

  const handleCommitValue = useCallback(
    (index: number, newValue: string) => {
      if (newValue === model.searchParams[index]?.[1]) return;
      const updated: [string, string][] = model.searchParams.map((pair, i) =>
        i === index ? [pair[0], newValue] : pair,
      );
      onChange({ ...model, searchParams: updated });
    },
    [model, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = model.searchParams.filter((_, i) => i !== index);
      onChange({ ...model, searchParams: updated });
    },
    [model, onChange],
  );

  const handleAddParam = () => {
    const updated: [string, string][] = [...model.searchParams, ['', '']];
    const addedIndex = updated.length - 1;
    onChange({ ...model, searchParams: updated });
    setNewRowIndex(addedIndex);
  };

  // Clear newRowIndex after focus has been given
  useEffect(() => {
    if (newRowIndex !== null) {
      const timer = setTimeout(() => setNewRowIndex(null), 300);
      return () => clearTimeout(timer);
    }
  }, [newRowIndex]);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-gray-400 text-xs font-mono">?</span>
        <span className="text-xs text-gray-500 font-medium">Query params</span>
      </div>

      {/* Param rows */}
      {model.searchParams.map(([key, value], index) => (
        <ParamRow
          key={index}
          index={index}
          paramKey={key}
          paramValue={value}
          hostname={hostname}
          onCommitKey={handleCommitKey}
          onCommitValue={handleCommitValue}
          onRemove={handleRemove}
          autoFocusKey={index === newRowIndex}
        />
      ))}

      {/* Add param button */}
      <button
        type="button"
        onClick={handleAddParam}
        className="text-blue-500 hover:text-blue-700 text-sm mt-1"
      >
        + Add param
      </button>
    </div>
  );
}
