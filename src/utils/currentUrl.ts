import { pageKey, parseUrl } from '../utils/urlParser.ts';
import { getState, setState } from './appState.ts';
import { loadPageState } from './pageStateStorage.ts';

// keepEdits: a same-tab page update (load or pushState) must not delete unapplied edits.
// seq: the caller's number from `latest`; a result that a later query or URL event superseded is dropped.
async function showUrl(seq: number, tabId: number | null, rawUrl: string, title: string, keepEdits: boolean): Promise<void> {
  if (!/^(https?|file):/.test(rawUrl)) {
    setState({ tabId, error: 'Not available on browser internal pages.', dirty: false });
    return;
  }
  const model = parseUrl(rawUrl);
  const pageState = await loadPageState(model);
  if (seq !== latest) return;
  // Read after the await, so edits made while storage loads are seen.
  const { dirty, tabId: currentTabId, committedModel } = getState();
  if (keepEdits && dirty && currentTabId === tabId) {
    // Same page: storage already holds this session's edits, so the load-time snapshot stays.
    const pageChanged = pageKey(model) !== pageKey(committedModel);
    setState({
      committedModel: model,
      title,
      ...(pageChanged && { committedDisabledParams: pageState.disabledParams }),
    });
    return;
  }
  setState({ model, committedModel: model, tabId, title, error: null, dirty: false, ...pageState, committedDisabledParams: pageState.disabledParams });
}

// Bumped by each query and each URL event; a result older than the latest one is dropped.
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

    await showUrl(seq, tab.id ?? null, rawUrl, tab.title ?? '', keepEdits);
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
      showUrl(++latest, tabId, changeInfo.url, tab.title ?? '', true);
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
