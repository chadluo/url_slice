import { useState, useEffect } from 'react';
import { useCurrentUrl } from './hooks/useCurrentUrl';
import { buildUrl } from './utils/urlBuilder';
import type { UrlModel } from './utils/urlParser';
import { HostEditor } from './components/HostEditor';
import { PortEditor } from './components/PortEditor';
import { PathEditor } from './components/PathEditor';
import { SearchParamsEditor } from './components/SearchParamsEditor';
import { FragmentEditor } from './components/FragmentEditor';

export default function App() {
  const { model, tabId, error } = useCurrentUrl();
  const [localModel, setLocalModel] = useState<UrlModel | null>(null);

  useEffect(() => {
    if (model !== null && localModel === null) {
      setLocalModel(model);
    }
  }, [model]);

  const handleReset = () => {
    setLocalModel(model);
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
      <div className="w-105 min-h-50 max-h-150 overflow-y-auto p-4 bg-white text-gray-900 text-sm font-sans">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (localModel === null) {
    return (
      <div className="w-105 min-h-50 max-h-150 overflow-y-auto p-4 bg-white text-gray-900 text-sm font-sans">
        <p>Loading…</p>
      </div>
    );
  }

  const builtUrl = buildUrl(localModel);

  return (
    <div className="w-105 min-h-50 max-h-150 overflow-y-auto p-4 bg-white text-gray-900 text-sm font-sans">
      {/* Full URL display */}
      <div className="flex items-center gap-1 mb-3">
        <code className="flex-1 text-gray-500 text-xs truncate overflow-hidden whitespace-nowrap font-mono">
          {builtUrl}
        </code>
        <button
          onClick={handleCopy}
          title="Copy URL"
          className="shrink-0 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          📋
        </button>
      </div>

      <hr className="border-gray-100 my-2" />

      <HostEditor model={localModel} onChange={setLocalModel} />

      <hr className="border-gray-100 my-2" />

      <PortEditor model={localModel} onChange={setLocalModel} />

      <hr className="border-gray-100 my-2" />

      <PathEditor model={localModel} onChange={setLocalModel} />

      <hr className="border-gray-100 my-2" />

      <SearchParamsEditor model={localModel} onChange={setLocalModel} />

      <hr className="border-gray-100 my-2" />

      <FragmentEditor model={localModel} tabId={tabId} onChange={setLocalModel} />

      <hr className="border-gray-100 my-2" />

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleApply}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded cursor-pointer"
        >
          Apply
        </button>
        <button
          onClick={handleReset}
          className="text-gray-500 hover:text-gray-700 text-xs py-1.5 px-3 border border-gray-200 rounded cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
