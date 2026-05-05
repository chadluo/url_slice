import { parseUrl } from '../utils/urlParser.ts';
import { setState } from './appState.ts';
import { loadPageState } from './pageStateStorage.ts';

async function fetchAndApply(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const rawUrl = tab?.url || tab?.pendingUrl || '';

    if (!tab || !rawUrl) {
      setState({ model: undefined as any, tabId: tab?.id ?? null, error: 'Not available on browser internal pages.', dirty: false });
      return;
    }

    if (!/^(https?|ftp|file):/.test(rawUrl)) {
      setState({ tabId: tab.id ?? null, error: 'Not available on browser internal pages.', dirty: false });
      return;
    }

    const model = parseUrl(rawUrl);
    setState({
      model,
      committedModel: model,
      tabId: tab.id ?? null,
      error: null,
      dirty: false,
      ...loadPageState(model),
    });
  } catch (err) {
    setState({ tabId: null, error: err instanceof Error ? err.message : 'Failed to parse URL' });
  }
}

export function initCurrentUrl(): () => void {
  fetchAndApply();

  const onUpdated: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (tabId, changeInfo, tab) => {
    if (!tab.active) return;
    if (changeInfo.url !== undefined) {
      if (!/^(https?|ftp|file):/.test(changeInfo.url)) {
        setState({ tabId, error: 'Not available on browser internal pages.', dirty: false });
        return;
      }
      const model = parseUrl(changeInfo.url);
      setState({
        model,
        committedModel: model,
        tabId,
        error: null,
        dirty: false,
        ...loadPageState(model),
      });
    } else if (changeInfo.status === 'complete') {
      fetchAndApply();
    }
  };

  const onActivated: Parameters<typeof browser.tabs.onActivated.addListener>[0] = () => {
    fetchAndApply();
  };

  browser.tabs.onUpdated.addListener(onUpdated);
  browser.tabs.onActivated.addListener(onActivated);

  return () => {
    browser.tabs.onUpdated.removeListener(onUpdated);
    browser.tabs.onActivated.removeListener(onActivated);
  };
}
