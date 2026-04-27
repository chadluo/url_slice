import { useState, useEffect } from 'react';
import { useCurrentUrl } from './hooks/useCurrentUrl';
import { buildUrl } from './utils/urlBuilder';
import type { UrlModel, TextFragment } from './utils/urlParser';
import { HostEditor } from './components/HostEditor';
import { PortEditor } from './components/PortEditor';
import { PathEditor } from './components/PathEditor';
import { SearchParamsEditor } from './components/SearchParamsEditor';
import { FragmentEditor } from './components/FragmentEditor';

function pageKey(model: UrlModel): string {
  const host = [...model.subdomains, model.domain].join('.')
  const path = model.pathSegments.length ? '/' + model.pathSegments.join('/') : ''
  return `${host}${path}`
}

function loadDisabledParams(model: UrlModel): [string, string][] {
  try {
    const raw = localStorage.getItem(`disabledParams:${pageKey(model)}`)
    if (raw) return JSON.parse(raw) as [string, string][]
  } catch {}
  return []
}

function saveDisabledParams(model: UrlModel, params: [string, string][]) {
  const key = `disabledParams:${pageKey(model)}`
  if (params.length > 0) {
    localStorage.setItem(key, JSON.stringify(params))
  } else {
    localStorage.removeItem(key)
  }
}

function loadDisabledTextFragments(model: UrlModel): TextFragment[] {
  try {
    const raw = localStorage.getItem(`disabledTextFragments:${pageKey(model)}`)
    if (raw) return JSON.parse(raw) as TextFragment[]
  } catch {}
  return []
}

function saveDisabledTextFragments(model: UrlModel, fragments: TextFragment[]) {
  const key = `disabledTextFragments:${pageKey(model)}`
  if (fragments.length > 0) {
    localStorage.setItem(key, JSON.stringify(fragments))
  } else {
    localStorage.removeItem(key)
  }
}

export default function App() {
  const { model, tabId, error } = useCurrentUrl();
  const [localModel, setLocalModel] = useState<UrlModel | null>(null);
  const [dirty, setDirty] = useState(false);
  const [disabledParams, setDisabledParams] = useState<[string, string][]>([]);
  const [disabledTextFragments, setDisabledTextFragments] = useState<TextFragment[]>([]);

  useEffect(() => {
    if (model !== null && localModel === null) {
      setLocalModel(model);
      setDisabledParams(loadDisabledParams(model));
      setDisabledTextFragments(loadDisabledTextFragments(model));
    }
  }, [model]);

  const handleDisabledParamsChange = (params: [string, string][]) => {
    setDisabledParams(params)
    if (localModel) saveDisabledParams(localModel, params)
  }

  const handleDisabledTextFragmentsChange = (fragments: TextFragment[]) => {
    setDisabledTextFragments(fragments)
    if (localModel) saveDisabledTextFragments(localModel, fragments)
  }

  const handleModelChange = (updated: UrlModel) => {
    setLocalModel(updated);
    setDirty(true);
  };

  const handleReset = () => {
    setLocalModel(model);
    setDirty(false);
    if (model) {
      setDisabledParams(loadDisabledParams(model));
      setDisabledTextFragments(loadDisabledTextFragments(model));
    }
  };

  const handleApply = async () => {
    if (tabId === null || localModel === null) return;
    await browser.tabs.update(tabId, { url: buildUrl(localModel) });
    window.close();
  };

  const handleCopy = () => {
    if (localModel === null) return;
    navigator.clipboard.writeText(buildUrl(localModel));
  };

  if (error) {
    return (
      <div className="w-150 min-h-50 max-h-150 overflow-y-auto p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm font-sans">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (localModel === null) {
    return (
      <div className="w-150 min-h-50 max-h-150 overflow-y-auto p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm font-sans">
        <p>Loading…</p>
      </div>
    );
  }

  const builtUrl = buildUrl(localModel);

  return (
    <div className="w-150 min-h-50 max-h-150 overflow-y-auto p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm font-sans">
      {/* Full URL display */}
      <div className="flex items-center gap-1 mb-3">
        <code className="flex-1 text-gray-500 dark:text-gray-400 text-xs truncate overflow-hidden whitespace-nowrap font-mono">
          {builtUrl}
        </code>
        <button
          onClick={handleCopy}
          title="Copy URL"
          className="shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer"
        >
          📋
        </button>
      </div>

      <hr className="border-gray-100 dark:border-gray-700 my-2" />

      <HostEditor model={localModel} onChange={handleModelChange} />

      <hr className="border-gray-100 dark:border-gray-700 my-2" />

      <PortEditor model={localModel} onChange={handleModelChange} />

      <hr className="border-gray-100 dark:border-gray-700 my-2" />

      <PathEditor model={localModel} onChange={handleModelChange} />

      <hr className="border-gray-100 dark:border-gray-700 my-2" />

      <SearchParamsEditor
        model={localModel}
        onChange={handleModelChange}
        disabledParams={disabledParams}
        onDisabledParamsChange={handleDisabledParamsChange}
      />

      <hr className="border-gray-100 dark:border-gray-700 my-2" />

      <FragmentEditor
        model={localModel}
        tabId={tabId}
        onChange={handleModelChange}
        disabledTextFragments={disabledTextFragments}
        onDisabledTextFragmentsChange={handleDisabledTextFragmentsChange}
      />

      <hr className="border-gray-100 dark:border-gray-700 my-2" />

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleApply}
          disabled={!dirty}
          className={`flex-1 font-medium py-1.5 px-4 rounded ${dirty ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'}`}
        >
          Apply
        </button>
        <button
          onClick={handleReset}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 dark:border-gray-600 text-xs py-1.5 px-3 border border-gray-200 rounded cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
