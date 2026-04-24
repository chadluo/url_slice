import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { UrlModel } from '../utils/urlParser';
import { Dropdown } from './Dropdown';
import { useHistorySuggestions } from '../hooks/useHistorySuggestions';

interface SearchParamsEditorProps {
  model: UrlModel;
  onChange: (updated: UrlModel) => void;
  disabledParams: [string, string][];
  onDisabledParamsChange: (params: [string, string][]) => void;
}

interface ParamRowProps {
  index: number;
  paramKey: string;
  paramValue: string;
  enabled: boolean;
  hostname: string;
  onCommitKey: (index: number, newKey: string) => void;
  onCommitValue: (index: number, newValue: string) => void;
  onRemove: (index: number) => void;
  onToggle: (index: number) => void;
  autoFocusKey?: boolean;
}

function ParamRow({
  index,
  paramKey,
  paramValue,
  enabled,
  hostname,
  onCommitKey,
  onCommitValue,
  onRemove,
  onToggle,
  autoFocusKey,
}: ParamRowProps): JSX.Element {
  const [localKey, setLocalKey] = useState(paramKey);
  const [localValue, setLocalValue] = useState(paramValue);
  const [valueDropdownOpen, setValueDropdownOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const keyInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalKey(paramKey); }, [paramKey]);
  useEffect(() => { setLocalValue(paramValue); }, [paramValue]);

  useEffect(() => {
    if (autoFocusKey && keyInputRef.current) {
      keyInputRef.current.focus();
    }
  }, [autoFocusKey]);

  useEffect(() => {
    if (!contextMenuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [contextMenuOpen]);

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

  const inputCls = `w-full px-2 py-0.5 border border-gray-200 rounded text-sm font-mono bg-white focus:outline-none focus:border-blue-400 ${!enabled ? 'opacity-50' : ''}`;

  return (
    <div className="flex items-center gap-1 py-0.5">
      {/* Enable/disable checkbox */}
      <input
        type="checkbox"
        checked={enabled}
        onChange={() => onToggle(index)}
        className="shrink-0 cursor-pointer"
        title={enabled ? 'Disable param' : 'Enable param'}
      />

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
          className={inputCls}
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
                setTimeout(() => setValueDropdownOpen(false), 150);
              }}
              onKeyDown={handleValueKeyDown}
              className={inputCls}
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
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 border border-transparent hover:border-red-200"
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
  disabledParams,
  onDisabledParamsChange,
}: SearchParamsEditorProps): JSX.Element {
  const [newRowIndex, setNewRowIndex] = useState<number | null>(null);

  const hostname = [...model.subdomains, model.domain].filter(Boolean).join('.');

  // ── Enabled param handlers ──────────────────────────────────────────────

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
      onChange({ ...model, searchParams: model.searchParams.filter((_, i) => i !== index) });
    },
    [model, onChange],
  );

  const handleDisable = useCallback(
    (index: number) => {
      const param = model.searchParams[index];
      if (!param) return;
      onChange({ ...model, searchParams: model.searchParams.filter((_, i) => i !== index) });
      onDisabledParamsChange([...disabledParams, param]);
    },
    [model, onChange, disabledParams, onDisabledParamsChange],
  );

  // ── Disabled param handlers ─────────────────────────────────────────────

  const handleDisabledCommitKey = useCallback(
    (index: number, newKey: string) => {
      if (newKey === disabledParams[index]?.[0]) return;
      onDisabledParamsChange(disabledParams.map((pair, i) =>
        i === index ? [newKey, pair[1]] : pair,
      ));
    },
    [disabledParams, onDisabledParamsChange],
  );

  const handleDisabledCommitValue = useCallback(
    (index: number, newValue: string) => {
      if (newValue === disabledParams[index]?.[1]) return;
      onDisabledParamsChange(disabledParams.map((pair, i) =>
        i === index ? [pair[0], newValue] : pair,
      ));
    },
    [disabledParams, onDisabledParamsChange],
  );

  const handleDisabledRemove = useCallback(
    (index: number) => {
      onDisabledParamsChange(disabledParams.filter((_, i) => i !== index));
    },
    [disabledParams, onDisabledParamsChange],
  );

  const handleEnable = useCallback(
    (index: number) => {
      const param = disabledParams[index];
      if (!param) return;
      onDisabledParamsChange(disabledParams.filter((_, i) => i !== index));
      onChange({ ...model, searchParams: [...model.searchParams, param] });
    },
    [model, onChange, disabledParams, onDisabledParamsChange],
  );

  // ── Add param ───────────────────────────────────────────────────────────

  const handleAddParam = () => {
    const updated: [string, string][] = [...model.searchParams, ['', '']];
    onChange({ ...model, searchParams: updated });
    setNewRowIndex(updated.length - 1);
  };

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

      {/* Enabled params */}
      {model.searchParams.map(([key, value], index) => (
        <ParamRow
          key={`e-${index}`}
          index={index}
          paramKey={key}
          paramValue={value}
          enabled={true}
          hostname={hostname}
          onCommitKey={handleCommitKey}
          onCommitValue={handleCommitValue}
          onRemove={handleRemove}
          onToggle={handleDisable}
          autoFocusKey={index === newRowIndex}
        />
      ))}

      {/* Disabled params */}
      {disabledParams.map(([key, value], index) => (
        <ParamRow
          key={`d-${index}`}
          index={index}
          paramKey={key}
          paramValue={value}
          enabled={false}
          hostname={hostname}
          onCommitKey={handleDisabledCommitKey}
          onCommitValue={handleDisabledCommitValue}
          onRemove={handleDisabledRemove}
          onToggle={handleEnable}
        />
      ))}

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
