import { useCallback, useEffect, useState, type JSX } from 'react';
import type { UrlModel, TextFragment, MediaFragment } from '../utils/urlParser';
import {
  serializeTextFragment,
  serializeMediaFragment,
} from '../utils/fragmentParser';

interface FragmentEditorProps {
  model: UrlModel;
  tabId: number | null;
  onChange: (updated: UrlModel) => void;
}

// ── helpers ────────────────────────────────────────────────────────────────

function secondsToMmss(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const sPadded = s < 10 ? `0${s}` : String(s);
  return `${m}:${sPadded}`;
}

function mmssToSeconds(value: string): number {
  const trimmed = value.trim();
  if (trimmed.includes(':')) {
    const [mPart, sPart] = trimmed.split(':');
    const m = parseInt(mPart ?? '0', 10);
    const s = parseFloat(sPart ?? '0');
    return m * 60 + s;
  }
  return parseFloat(trimmed);
}

// ── Text Fragment row ──────────────────────────────────────────────────────

interface TextFragRowProps {
  index: number;
  fragment: TextFragment;
  tabId: number | null;
  onCommit: (index: number, updated: TextFragment) => void;
  onRemove: (index: number) => void;
}

function TextFragRow({
  index,
  fragment,
  tabId,
  onCommit,
  onRemove,
}: TextFragRowProps): JSX.Element {
  const [local, setLocal] = useState<TextFragment>({ ...fragment });

  useEffect(() => {
    setLocal({ ...fragment });
  }, [fragment]);

  const commit = useCallback(
    (updated: TextFragment) => {
      onCommit(index, updated);
    },
    [index, onCommit],
  );

  const handleHighlight = () => {
    if (tabId === null) return;
    browser.tabs
      .sendMessage(tabId, { type: 'HIGHLIGHT_TEXT', text: local.textStart })
      .catch(() => {
        // content script may not be injected – silently ignore
      });
  };

  const inputClass =
    'px-1.5 py-0.5 border border-gray-200 rounded text-sm font-mono bg-white focus:outline-none focus:border-blue-400';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (e.key === 'Escape') {
      setLocal({ ...fragment });
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-1 py-0.5 flex-wrap">
      {/* prefix */}
      <input
        type="text"
        value={local.prefix ?? ''}
        onChange={(e) => setLocal({ ...local, prefix: e.target.value })}
        onBlur={() => commit(local)}
        onKeyDown={handleKeyDown}
        className={`${inputClass} w-16 text-gray-500`}
        placeholder="prefix"
        spellCheck={false}
        title="prefix"
      />
      <span className="text-gray-400 text-xs select-none">-,</span>

      {/* textStart */}
      <input
        type="text"
        value={local.textStart}
        onChange={(e) => setLocal({ ...local, textStart: e.target.value })}
        onBlur={() => commit(local)}
        onKeyDown={handleKeyDown}
        className={`${inputClass} w-28`}
        placeholder="text start"
        spellCheck={false}
        title="text start (required)"
      />

      {/* textEnd */}
      <span className="text-gray-400 text-xs select-none">,</span>
      <input
        type="text"
        value={local.textEnd ?? ''}
        onChange={(e) => setLocal({ ...local, textEnd: e.target.value || undefined })}
        onBlur={() => commit(local)}
        onKeyDown={handleKeyDown}
        className={`${inputClass} w-20`}
        placeholder="end"
        spellCheck={false}
        title="text end (optional)"
      />

      {/* suffix */}
      <span className="text-gray-400 text-xs select-none">,-</span>
      <input
        type="text"
        value={local.suffix ?? ''}
        onChange={(e) => setLocal({ ...local, suffix: e.target.value })}
        onBlur={() => commit(local)}
        onKeyDown={handleKeyDown}
        className={`${inputClass} w-16 text-gray-500`}
        placeholder="suffix"
        spellCheck={false}
        title="suffix"
      />

      {/* highlight button */}
      <button
        type="button"
        onClick={handleHighlight}
        disabled={tabId === null || !local.textStart}
        className="text-xs px-2 py-0.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        title="Highlight in page"
      >
        Highlight ▶
      </button>

      {/* remove button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-gray-400 hover:text-red-500 text-xs px-1 flex-shrink-0"
        title="Remove fragment"
      >
        ×
      </button>

      {/* encoded preview */}
      {local.textStart && (
        <span className="text-gray-400 text-xs font-mono truncate w-full pl-1">
          text={serializeTextFragment(local)}
        </span>
      )}
    </div>
  );
}

// ── Media Fragment row ─────────────────────────────────────────────────────

interface MediaFragRowProps {
  index: number;
  fragment: MediaFragment;
  onCommit: (index: number, updated: MediaFragment) => void;
  onRemove: (index: number) => void;
}

function MediaFragRow({
  index,
  fragment,
  onCommit,
  onRemove,
}: MediaFragRowProps): JSX.Element {
  const [local, setLocal] = useState<MediaFragment>({ ...fragment });

  useEffect(() => {
    setLocal({ ...fragment });
  }, [fragment]);

  const commit = useCallback(
    (updated: MediaFragment) => {
      const withRaw: MediaFragment = {
        ...updated,
        raw: serializeMediaFragment(updated),
      };
      onCommit(index, withRaw);
    },
    [index, onCommit],
  );

  const inputClass =
    'px-1.5 py-0.5 border border-gray-200 rounded text-sm font-mono bg-white focus:outline-none focus:border-blue-400';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (e.key === 'Escape') {
      setLocal({ ...fragment });
      (e.target as HTMLInputElement).blur();
    }
  };

  const removeBtn = (
    <button
      type="button"
      onClick={() => onRemove(index)}
      className="text-gray-400 hover:text-red-500 text-xs px-1 flex-shrink-0"
      title="Remove fragment"
    >
      ×
    </button>
  );

  if (local.type === 'time') {
    return (
      <div className="flex items-center gap-1 py-0.5">
        <span className="text-gray-500 text-xs font-mono select-none">t=</span>
        <input
          type="text"
          value={secondsToMmss(local.startTime ?? 0)}
          onChange={(e) => {
            const s = mmssToSeconds(e.target.value);
            setLocal({ ...local, startTime: isNaN(s) ? 0 : s });
          }}
          onBlur={() => commit(local)}
          onKeyDown={handleKeyDown}
          className={`${inputClass} w-16`}
          placeholder="0:00"
          title="start time (mm:ss)"
        />
        <span className="text-gray-400 text-xs select-none">,</span>
        <input
          type="text"
          value={local.endTime !== undefined ? secondsToMmss(local.endTime) : ''}
          onChange={(e) => {
            const val = e.target.value.trim();
            if (val === '') {
              setLocal({ ...local, endTime: undefined });
            } else {
              const s = mmssToSeconds(val);
              setLocal({ ...local, endTime: isNaN(s) ? undefined : s });
            }
          }}
          onBlur={() => commit(local)}
          onKeyDown={handleKeyDown}
          className={`${inputClass} w-16`}
          placeholder="end"
          title="end time (mm:ss, optional)"
        />
        {removeBtn}
      </div>
    );
  }

  if (local.type === 'spatial') {
    return (
      <div className="flex items-center gap-1 py-0.5 flex-wrap">
        <span className="text-gray-500 text-xs font-mono select-none">xywh=</span>
        {(['x', 'y', 'width', 'height'] as const).map((field, fi) => (
          <span key={field} className="flex items-center gap-0.5">
            {fi > 0 && <span className="text-gray-400 text-xs select-none">,</span>}
            <span className="text-gray-500 text-xs">{field === 'width' ? 'w' : field === 'height' ? 'h' : field}:</span>
            <input
              type="number"
              value={local[field] ?? 0}
              onChange={(e) =>
                setLocal({ ...local, [field]: parseFloat(e.target.value) || 0 })
              }
              onBlur={() => commit(local)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} w-14`}
              title={field}
            />
          </span>
        ))}
        {removeBtn}
      </div>
    );
  }

  // track / id
  return (
    <div className="flex items-center gap-1 py-0.5">
      <span className="text-gray-500 text-xs font-mono select-none">{local.type}=</span>
      <input
        type="text"
        value={local.value ?? ''}
        onChange={(e) => setLocal({ ...local, value: e.target.value })}
        onBlur={() => commit(local)}
        onKeyDown={handleKeyDown}
        className={`${inputClass} w-40`}
        placeholder="value"
        spellCheck={false}
      />
      {removeBtn}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type TabName = 'text' | 'media';

export function FragmentEditor({
  model,
  tabId,
  onChange,
}: FragmentEditorProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>('text');
  const [visible, setVisible] = useState(
    model.textFragments.length > 0 || model.mediaFragments.length > 0,
  );

  // Show automatically if fragments arrive from outside
  useEffect(() => {
    if (model.textFragments.length > 0 || model.mediaFragments.length > 0) {
      setVisible(true);
    }
  }, [model.textFragments.length, model.mediaFragments.length]);

  // ── Text fragment handlers ──

  const handleCommitText = useCallback(
    (index: number, updated: TextFragment) => {
      const updated2 = model.textFragments.map((f, i) =>
        i === index ? updated : f,
      );
      onChange({ ...model, textFragments: updated2 });
    },
    [model, onChange],
  );

  const handleRemoveText = useCallback(
    (index: number) => {
      onChange({
        ...model,
        textFragments: model.textFragments.filter((_, i) => i !== index),
      });
    },
    [model, onChange],
  );

  const handleAddText = () => {
    onChange({
      ...model,
      textFragments: [...model.textFragments, { textStart: '' }],
    });
    setActiveTab('text');
    setVisible(true);
  };

  // ── Media fragment handlers ──

  const handleCommitMedia = useCallback(
    (index: number, updated: MediaFragment) => {
      const updated2 = model.mediaFragments.map((f, i) =>
        i === index ? updated : f,
      );
      onChange({ ...model, mediaFragments: updated2 });
    },
    [model, onChange],
  );

  const handleRemoveMedia = useCallback(
    (index: number) => {
      onChange({
        ...model,
        mediaFragments: model.mediaFragments.filter((_, i) => i !== index),
      });
    },
    [model, onChange],
  );

  const handleAddTime = () => {
    onChange({
      ...model,
      mediaFragments: [
        ...model.mediaFragments,
        { type: 'time', raw: 't=0', startTime: 0 },
      ],
    });
    setActiveTab('media');
    setVisible(true);
  };

  // ── Render ──

  if (!visible) {
    return (
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={handleAddText}
          className="text-blue-500 hover:text-blue-700 text-sm"
        >
          + Add text fragment
        </button>
        <button
          type="button"
          onClick={handleAddTime}
          className="text-blue-500 hover:text-blue-700 text-sm"
        >
          + Add media fragment
        </button>
      </div>
    );
  }

  const tabBtn = (tab: TabName, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`text-xs px-3 py-1 rounded-t border-b-2 ${
        activeTab === tab
          ? 'border-blue-500 text-blue-600 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-1">
      {/* Section header */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-gray-400 text-xs font-mono">#</span>
        <span className="text-xs text-gray-500 font-medium">Fragments</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-2">
        {tabBtn('text', `Text${model.textFragments.length ? ` (${model.textFragments.length})` : ''}`)}
        {tabBtn('media', `Media${model.mediaFragments.length ? ` (${model.mediaFragments.length})` : ''}`)}
      </div>

      {/* Text tab */}
      {activeTab === 'text' && (
        <div>
          {model.textFragments.map((frag, i) => (
            <TextFragRow
              key={i}
              index={i}
              fragment={frag}
              tabId={tabId}
              onCommit={handleCommitText}
              onRemove={handleRemoveText}
            />
          ))}
          <button
            type="button"
            onClick={handleAddText}
            className="text-blue-500 hover:text-blue-700 text-sm mt-1"
          >
            + Add text fragment
          </button>
        </div>
      )}

      {/* Media tab */}
      {activeTab === 'media' && (
        <div>
          {model.mediaFragments.map((frag, i) => (
            <MediaFragRow
              key={i}
              index={i}
              fragment={frag}
              onCommit={handleCommitMedia}
              onRemove={handleRemoveMedia}
            />
          ))}
          <button
            type="button"
            onClick={handleAddTime}
            className="text-blue-500 hover:text-blue-700 text-sm mt-1"
          >
            + Add time fragment
          </button>
        </div>
      )}
    </div>
  );
}
