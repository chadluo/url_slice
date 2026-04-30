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

  // Stable combined list: [key, value, enabled]. Reset only on page key change.
  @state() private _rows: Array<[string, string, boolean]> = [];
  @state() private _historyParams: Map<string, string[]> = new Map();
  @state() private _dismissedKeys: Set<string> = new Set();
  @state() private _historyRowValues: Map<string, string> = new Map();
  private _unsub?: () => void;
  private _lastPageKey = '';

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribe(() => {
      this._syncRows();
      this.requestUpdate();
    });
    this._syncRows();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  private _model(): UrlModel { return getState().model; }

  private _syncRows() {
    const m = this._model();
    const k = pageKey(m);
    if (k === this._lastPageKey) return;
    this._lastPageKey = k;
    this._dismissedKeys = new Set();
    this._historyRowValues = new Map();
    const dp = getState().disabledParams;
    this._rows = [
      ...m.searchParams.map(([key, val]): [string, string, boolean] => [key, val, true]),
      ...dp.map(([key, val]): [string, string, boolean] => [key, val, false]),
    ];
    const hostname = [...m.subdomains, m.domain].filter(Boolean).join('.');
    const path = '/' + m.pathSegments.map(encodeURIComponent).join('/') || '/';
    getHistorySearchParams(hostname, path).then((map) => {
      this._historyParams = map;
    });
  }

  private _commitRows() {
    const enabled = this._rows.filter(r => r[2]).map(r => [r[0], r[1]] as [string, string]);
    const disabled = this._rows.filter(r => !r[2]).map(r => [r[0], r[1]] as [string, string]);
    const m = this._model();
    setState({ model: { ...m, searchParams: enabled }, disabledParams: disabled, dirty: true });
    saveDisabledParams(m, disabled);
  }

  private _toggleRow(index: number) {
    this._rows = this._rows.map((r, i): [string, string, boolean] =>
      i === index ? [r[0], r[1], !r[2]] : r
    );
    this._commitRows();
  }

  private _onKeyChange(index: number, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this._rows = this._rows.map((r, i): [string, string, boolean] =>
      i === index ? [val, r[1], r[2]] : r
    );
    this._commitRows();
  }

  private _onValueChange(index: number, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this._rows = this._rows.map((r, i): [string, string, boolean] =>
      i === index ? [r[0], val, r[2]] : r
    );
    this._commitRows();
  }

  private _removeRow(index: number) {
    this._rows = this._rows.filter((_, i) => i !== index);
    this._commitRows();
  }

  private _addParam() {
    this._rows = [...this._rows, ['', '', true]];
    this._commitRows();
    setTimeout(() => {
      const inputs = this.querySelectorAll<HTMLInputElement>('.param-key');
      inputs[inputs.length - 1]?.focus();
    }, 0);
  }

  private _historyEntries(): [string, string][] {
    const activeKeys = new Set(this._rows.map(r => r[0]));
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
    this._rows = [...this._rows, [key, value, true]];
    this._commitRows();
  }

  private _renderRow(key: string, value: string, enabled: boolean, index: number) {
    return html`
      <div style="display:flex;align-items:center;gap:4px;margin:2px 0;opacity:${enabled ? '1' : '0.6'}">
        <input type="checkbox" ?checked=${enabled} @change=${() => this._toggleRow(index)} title="${enabled ? 'Disable' : 'Enable'}" style="cursor:pointer;flex-shrink:0" />
        <input
          class="mono param-key"
          .value=${key}
          @input=${(e: Event) => this._onKeyChange(index, e)}
          style="flex:1;min-width:0"
          placeholder="key"
          spellcheck="false"
        />
        <span>=</span>
        <input
          class="mono"
          .value=${value}
          @input=${(e: Event) => this._onValueChange(index, e)}
          style="flex:2;min-width:0"
          placeholder="value"
          spellcheck="false"
        />
        <button @click=${() => this._removeRow(index)} title="Delete param" style="cursor:pointer;background:none;border:none;color:GrayText;flex-shrink:0">×</button>
      </div>
    `;
  }

  render() {
    const historyEntries = this._historyEntries();

    return html`
      <div style="margin-bottom:4px">
        <span class="mono" style="color:GrayText">?</span>
        <span style="color:GrayText;font-weight:500">Query params</span>
      </div>

      ${this._rows.map(([key, value, enabled], i) => this._renderRow(key, value, enabled, i))}

      ${historyEntries.length > 0 ? html`
        <div style="color:GrayText;margin:4px 0 2px">From history:</div>
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
