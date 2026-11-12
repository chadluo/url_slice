import { parseUrl } from '../utils/urlParser.ts';
import { getState, setState } from './appState.ts';
import { loadPageState } from './pageStateStorage.ts';

// keepEdits: a same-tab page update (load or pushState) must not delete unapplied edits.
function showUrl(tabId: number | null, rawUrl: string, title: string, keepEdits: boolean): void {
  if (!/^(https?|ftp|file):/.test(rawUrl)) {
    setState({ tabId, error: 'Not available on browser internal pages.', dirty: false });
    return;
  }
  const model = parseUrl(rawUrl);
  const { dirty, tabId: currentTabId } = getState();
  if (keepEdits && dirty && currentTabId === tabId) {
    setState({ committedModel: model, title });
    return;
  }
  setState({ model, committedModel: model, tabId, title, error: null, dirty: false, ...loadPageState(model) });
}

async function fetchAndApply(keepEdits: boolean): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const rawUrl = tab?.url || tab?.pendingUrl || '';

    if (!tab || !rawUrl) {
      setState({ model: undefined as any, tabId: tab?.id ?? null, error: 'Not available on browser internal pages.', dirty: false });
      return;
    }

    showUrl(tab.id ?? null, rawUrl, tab.title ?? '', keepEdits);
  } catch (err) {
    setState({ tabId: null, error: err instanceof Error ? err.message : 'Failed to parse URL' });
  }
}

export function initCurrentUrl(): () => void {
  fetchAndApply(false);
  // Events before this resolves are ignored; the fetchAndApply above covers that gap.
  let windowId: number | undefined;
  browser.windows.getCurrent().then((w) => { windowId = w.id; });

  const onUpdated: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (tabId, changeInfo, tab) => {
    if (!tab.active || tab.windowId !== windowId) return;
    if (changeInfo.url !== undefined) {
      showUrl(tabId, changeInfo.url, tab.title ?? '', true);
    } else if (changeInfo.status === 'complete') {
      fetchAndApply(true);
    }
  };

  const onActivated: Parameters<typeof browser.tabs.onActivated.addListener>[0] = (info) => {
    if (info.windowId === windowId) fetchAndApply(false);
  };

  browser.tabs.onUpdated.addListener(onUpdated);
  browser.tabs.onActivated.addListener(onActivated);

  return () => {
    browser.tabs.onUpdated.removeListener(onUpdated);
    browser.tabs.onActivated.removeListener(onActivated);
  };
}
