import { pageKey, parseUrl } from '../utils/urlParser.ts';
import { getState, setState } from './appState.ts';
import { loadPageState } from './pageStateStorage.ts';

// keepEdits: a same-tab page update (load or pushState) must not delete unapplied edits.
function showUrl(tabId: number | null, rawUrl: string, title: string, keepEdits: boolean): void {
  if (!/^(https?|file):/.test(rawUrl)) {
    setState({ tabId, error: 'Not available on browser internal pages.', dirty: false });
    return;
  }
  const model = parseUrl(rawUrl);
  const { dirty, tabId: currentTabId, committedModel } = getState();
  if (keepEdits && dirty && currentTabId === tabId) {
    // Same page: storage already holds this session's edits, so the load-time snapshot stays.
    const pageChanged = pageKey(model) !== pageKey(committedModel);
    setState({
      committedModel: model,
      title,
      ...(pageChanged && { committedDisabledParams: loadPageState(model).disabledParams }),
    });
    return;
  }
  const pageState = loadPageState(model);
  setState({ model, committedModel: model, tabId, title, error: null, dirty: false, ...pageState, committedDisabledParams: pageState.disabledParams });
}

// Bumped by each query and each URL event; a query result older than the latest one is dropped.
let latest = 0;

async function fetchAndApply(keepEdits: boolean): Promise<void> {
  const seq = ++latest;
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (seq !== latest) return;
    const tab = tabs[0];
    const rawUrl = tab?.url || tab?.pendingUrl || '';

    if (!tab || !rawUrl) {
      setState({ model: undefined as any, tabId: tab?.id ?? null, error: 'Not available on browser internal pages.', dirty: false });
      return;
    }

    showUrl(tab.id ?? null, rawUrl, tab.title ?? '', keepEdits);
  } catch (err) {
    if (seq === latest) setState({ tabId: null, error: err instanceof Error ? err.message : 'Failed to parse URL' });
  }
}

export function initCurrentUrl(): () => void {
  // Events are ignored until windowId is known; the first query runs after that, so it sees their result.
  let windowId: number | undefined;
  browser.windows.getCurrent().then((w) => {
    windowId = w.id;
    fetchAndApply(false);
  });

  const onUpdated: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (tabId, changeInfo, tab) => {
    if (!tab.active || tab.windowId !== windowId) return;
    if (changeInfo.url !== undefined) {
      latest++;
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
