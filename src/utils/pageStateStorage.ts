import type { TextFragment } from './fragmentCodec.ts';
import { pageKey, type UrlModel } from './urlParser.ts';

export type PageState = {
  disabledParams: [string, string][]
  disabledTextFragments: TextFragment[]
}

function read<T>(storageKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

function write(storageKey: string, value: unknown): void {
  if (Array.isArray(value) && value.length === 0) {
    localStorage.removeItem(storageKey);
  } else {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }
}

export function loadPageState(model: UrlModel): PageState {
  const key = pageKey(model);
  return {
    disabledParams: read(`disabledParams:${key}`, []),
    disabledTextFragments: read(`disabledTextFragments:${key}`, []),
  };
}

export function saveDisabledParams(model: UrlModel, params: [string, string][]): void {
  write(`disabledParams:${pageKey(model)}`, params);
}

export function saveDisabledTextFragments(model: UrlModel, frags: TextFragment[]): void {
  write(`disabledTextFragments:${pageKey(model)}`, frags);
}
