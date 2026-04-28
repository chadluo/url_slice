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

        const rawUrl = tab?.url || tab?.pendingUrl || ''

        if (!tab || !rawUrl) {
          setState({
            model: null,
            tabId: tab?.id ?? null,
            raw: '',
            error: 'Not available on browser internal pages.',
          });
          return;
        }

        if (!/^(https?|ftp|file):/.test(rawUrl)) {
          setState({
            model: null,
            tabId: tab.id ?? null,
            raw: rawUrl,
            error: 'Not available on browser internal pages.',
          });
          return;
        }

        const model = parseUrl(rawUrl);

        setState({
          model,
          tabId: tab.id ?? null,
          raw: rawUrl,
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
