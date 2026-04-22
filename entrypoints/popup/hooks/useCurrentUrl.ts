import { useState, useEffect } from 'react';
import { parseUrl, UrlModel } from '../utils/urlParser';

interface CurrentUrl {
  model: UrlModel | null;
  tabId: number | null;
  raw: string;
  error: string | null;
}

export function useCurrentUrl(): CurrentUrl {
  const [state, setState] = useState<CurrentUrl>({
    model: null,
    tabId: null,
    raw: '',
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchCurrentUrl = async () => {
      try {
        const tabs = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!isMounted) return;

        const tab = tabs[0];

        if (!tab || !tab.url) {
          setState({
            model: null,
            tabId: tab?.id ?? null,
            raw: '',
            error: 'No URL found for the current tab',
          });
          return;
        }

        const model = parseUrl(tab.url);

        setState({
          model,
          tabId: tab.id ?? null,
          raw: tab.url,
          error: null,
        });
      } catch (err) {
        if (!isMounted) return;

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to parse URL';

        setState({
          model: null,
          tabId: null,
          raw: '',
          error: errorMessage,
        });
      }
    };

    fetchCurrentUrl();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
