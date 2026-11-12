import type { TextFragment } from './fragmentCodec.ts';
import { pageKey, type UrlModel } from './urlParser.ts';

// storage.session: the values can hold secrets (`token=`), so they live only for the browser session and
// are never written to disk. Writes are fire-and-forget; a failed write only loses this convenience state.

export type PageState = {
  disabledParams: [string, string][]
  disabledTextFragments: TextFragment[]
}

// ponytail: legacy cleanup, delete after a few releases. Old versions kept this state in localStorage
// (no expiry). Runs on popup / side panel open; old data stays on disk until then.
try {
  for (const k of Object.keys(localStorage)) if (k.startsWith('disabled')) localStorage.removeItem(k);
} catch {}

function write(storageKey: string, value: unknown[]): void {
  const done = value.length === 0
    ? browser.storage.session.remove(storageKey)
    : browser.storage.session.set({ [storageKey]: value });
  done.catch(() => {});
}

export async function loadPageState(model: UrlModel): Promise<PageState> {
  const key = pageKey(model);
  const paramsKey = `disabledParams:${key}`;
  const fragsKey = `disabledTextFragments:${key}`;
  try {
    const r = await browser.storage.session.get([paramsKey, fragsKey]);
    return {
      disabledParams: (r[paramsKey] as [string, string][] | undefined) ?? [],
      disabledTextFragments: (r[fragsKey] as TextFragment[] | undefined) ?? [],
    };
  } catch {
    return { disabledParams: [], disabledTextFragments: [] };
  }
}

// Editors save under the edited model's key, so the state follows Apply to a new path.
// An entry for a path that is never applied stays until the browser restarts.
export function saveDisabledParams(model: UrlModel, params: [string, string][]): void {
  write(`disabledParams:${pageKey(model)}`, params);
}

export function saveDisabledTextFragments(model: UrlModel, frags: TextFragment[]): void {
  write(`disabledTextFragments:${pageKey(model)}`, frags);
}
