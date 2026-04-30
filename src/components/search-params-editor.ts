import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../state/appState.ts';
import { getHistorySearchParams } from '../lib/historySuggestions.ts';
import type { UrlModel } from '../utils/urlParser.ts';

function pageKey(m: UrlModel): string {
  const host = [...m.subdomains, m.domain].filter(Boolean).join('.');
  const path = m.pathSegments.length ? '/' + m.pathSegments.join('/') : '';
  return `${host}${path}`;
}

function saveDisabledParams(m: UrlModel, params: [string, string][]) {
  const key = `disabledParams:${pageKey(m)}`;
  if (params.length > 0) {
    localStorage.setItem(key, JSON.stringify(params));
  } else {
    localStorage.removeItem(key);
  }
}

@customElement('search-params-editor')
export class SearchParamsEditor extends LitElement {
  createRenderRoot() { return this; }

  @state() private _historyParams: Map<string, string[]> = new Map();
  @state() private _dismissedKeys: Set<string> = new Set();
  @state() private _historyRowValues: Map<string, string> = new Map();
  private _unsub?: () => void;
  private _lastPageKey = '';

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribe(() => {
      this._maybeRefreshHistory();
      this.requestUpdate();
    });
    this._maybeRefreshHistory();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  private _model(): UrlModel { return getState().model; }
  private _disabledParams(): [string, string][] { return getState().disabledParams; }

  private _maybeRefreshHistory() {
    const m = this._model();
    const k = pageKey(m);
    if (k === this._lastPageKey) return;
    this._lastPageKey = k;
    this._dismissedKeys = new Set();
    this._historyRowValues = new Map();
    const hostname = [...m.subdomains, m.domain].filter(Boolean).join('.');
    const path = '/' + m.pathSegments.map(encodeURIComponent).join('/') || '/';
    getHistorySearchParams(hostname, path).then((map) => {
      this._historyParams = map;
    });
  }

  private _setModel(updated: UrlModel) {
    setState({ model: updated, dirty: true });
  }

  private _setDisabled(params: [string, string][]) {
    const m = this._model();
    setState({ disabledParams: params });
    saveDisabledParams(m, params);
  }

  // ── Enabled param handlers ──

  private _onKeyChange(index: number, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    const m = this._model();
    this._setModel({ ...m, searchParams: m.searchParams.map((p, i) => i === index ? [val, p[1]] : p) });
  }

  private _onValueChange(index: number, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    const m = this._model();
    this._setModel({ ...m, searchParams: m.searchParams.map((p, i) => i === index ? [p[0], val] : p) });
  }

  private _removeEnabled(index: number) {
    const m = this._model();
    this._setModel({ ...m, searchParams: m.searchParams.filter((_, i) => i !== index) });
  }

  private _disableParam(index: number) {
    const m = this._model();
    const param = m.searchParams[index];
    if (!param) return;
    this._setModel({ ...m, searchParams: m.searchParams.filter((_, i) => i !== index) });
    this._setDisabled([...this._disabledParams(), param]);
  }

  // ── Disabled param handlers ──

  private _onDisabledKeyChange(index: number, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    const dp = this._disabledParams();
    this._setDisabled(dp.map((p, i) => i === index ? [val, p[1]] : p));
  }

  private _onDisabledValueChange(index: number, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    const dp = this._disabledParams();
    this._setDisabled(dp.map((p, i) => i === index ? [p[0], val] : p));
  }

  private _removeDisabled(index: number) {
    this._setDisabled(this._disabledParams().filter((_, i) => i !== index));
  }

  private _enableParam(index: number) {
    const dp = this._disabledParams();
    const param = dp[index];
    if (!param) return;
    this._setDisabled(dp.filter((_, i) => i !== index));
    const m = this._model();
    this._setModel({ ...m, searchParams: [...m.searchParams, param] });
  }

  // ── History param handlers ──

  private _historyEntries(): [string, string][] {
    const m = this._model();
    const activeKeys = new Set([
      ...m.searchParams.map(([k]) => k),
      ...this._disabledParams().map(([k]) => k),
    ]);
    return Array.from(this._historyParams.entries())
      .filter(([k]) => !activeKeys.has(k) && !this._dismissedKeys.has(k))
      .map(([k, vals]) => [k, this._historyRowValues.get(k) ?? vals[0] ?? '']);
  }

  private _onHistoryValueChange(key: string, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this._historyRowValues = new Map(this._historyRowValues).set(key, val);
  }

  private _dismissHistory(key: string) {
    this._dismissedKeys = new Set(this._dismissedKeys).add(key);
  }

  private _addFromHistory(key: string, value: string) {
    const m = this._model();
    this._setModel({ ...m, searchParams: [...m.searchParams, [key, value]] });
  }

  // ── Add param ──

  private _addParam() {
    const m = this._model();
    this._setModel({ ...m, searchParams: [...m.searchParams, ['', '']] });
    setTimeout(() => {
      const rows = this.querySelectorAll<HTMLInputElement>('.param-key');
      rows[rows.length - 1]?.focus();
    }, 0);
  }

  private _renderRow(
    key: string,
    value: string,
    enabled: boolean,
    listId: string,
    suggestions: string[],
    onToggle: () => void,
    onKeyChange: (e: Event) => void,
    onValueChange: (e: Event) => void,
    onDelete: () => void,
    readonlyKey = false,
  ) {
    return html`
      <div style="display:flex;align-items:center;gap:4px;margin:2px 0;opacity:${enabled ? '1' : '0.6'}">
        <input type="checkbox" ?checked=${enabled} @change=${onToggle} title="${enabled ? 'Disable' : 'Enable'}" style="cursor:pointer;flex-shrink:0" />
        <input
          class="mono param-key"
          .value=${key}
          ?readonly=${readonlyKey}
          @input=${onKeyChange}
          style="flex:1;min-width:0"
          placeholder="key"
          spellcheck="false"
        />
        <span>=</span>
        <input
          class="mono"
          .value=${value}
          list=${listId}
          @input=${onValueChange}
          style="flex:2;min-width:0"
          placeholder="value"
          spellcheck="false"
        />
        <datalist id=${listId}>
          ${suggestions.map((s) => html`<option value=${s}></option>`)}
        </datalist>
        <button @click=${onDelete} title="Delete param" style="cursor:pointer;background:none;border:none;color:GrayText;flex-shrink:0">×</button>
      </div>
    `;
  }

  render() {
    const m = this._model();
    const dp = this._disabledParams();
    const historyEntries = this._historyEntries();

    return html`
      <div style="margin-bottom:4px">
        <span class="mono" style="color:GrayText;font-size:0.85em">?</span>
        <span style="font-size:0.8em;color:GrayText;font-weight:500">Query params</span>
      </div>

      ${m.searchParams.map(([key, value], i) => this._renderRow(
        key, value, true,
        `sp-val-${i}`, [],
        () => this._disableParam(i),
        (e) => this._onKeyChange(i, e),
        (e) => this._onValueChange(i, e),
        () => this._removeEnabled(i),
      ))}

      ${dp.map(([key, value], i) => this._renderRow(
        key, value, false,
        `sp-dval-${i}`, [],
        () => this._enableParam(i),
        (e) => this._onDisabledKeyChange(i, e),
        (e) => this._onDisabledValueChange(i, e),
        () => this._removeDisabled(i),
      ))}

      ${historyEntries.length > 0 ? html`
        <div style="color:GrayText;font-size:0.8em;margin:4px 0 2px">From history:</div>
        ${historyEntries.map(([key, value]) => {
          const listId = `sp-hval-${key}`;
          const suggestions = this._historyParams.get(key) ?? [];
          return html`
            <div style="display:flex;align-items:center;gap:4px;margin:2px 0;opacity:0.7">
              <span class="mono" style="flex:1;min-width:0;color:GrayText;font-size:0.9em">${key}</span>
              <span>=</span>
              <input
                class="mono"
                .value=${value}
                list=${listId}
                @input=${(e: Event) => this._onHistoryValueChange(key, e)}
                style="flex:2;min-width:0"
                placeholder="value"
                spellcheck="false"
              />
              <datalist id=${listId}>
                ${suggestions.map((s) => html`<option value=${s}></option>`)}
              </datalist>
              <button @click=${() => this._addFromHistory(key, value)} title="Add param" style="cursor:pointer;background:none;border:none">+</button>
              <button @click=${() => this._dismissHistory(key)} title="Dismiss" style="cursor:pointer;background:none;border:none;color:GrayText">×</button>
            </div>
          `;
        })}
      ` : ''}

      <button @click=${this._addParam} style="cursor:pointer;background:none;border:none;color:LinkText;margin-top:4px">+ Add param</button>
    `;
  }
}
