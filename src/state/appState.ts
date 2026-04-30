import { EMPTY_URL_MODEL, type TextFragment, type UrlModel } from '../utils/urlParser.ts';

export type AppState = {
  model: UrlModel;
  committedModel: UrlModel;
  tabId: number | null;
  error: string | null;
  dirty: boolean;
  disabledParams: [string, string][];
  disabledTextFragments: TextFragment[];
};

const _state: AppState = {
  model: EMPTY_URL_MODEL,
  committedModel: EMPTY_URL_MODEL,
  tabId: null,
  error: null,
  dirty: false,
  disabledParams: [],
  disabledTextFragments: [],
};

const _bus = new EventTarget();

export function getState(): AppState {
  return _state;
}

export function setState(patch: Partial<AppState>): void {
  Object.assign(_state, patch);
  _bus.dispatchEvent(new Event('change'));
}

export function subscribe(cb: () => void): () => void {
  _bus.addEventListener('change', cb);
  return () => _bus.removeEventListener('change', cb);
}
