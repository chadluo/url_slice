import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../utils/appState.ts';
import { getHistorySearchParams } from '../utils/historySuggestions.ts';
import { saveDisabledParams } from '../utils/pageStateStorage.ts';
import { pageKey, type UrlModel } from '../utils/urlParser.ts';
import './search-params-editor.css';

type DecodedValue =
  | { kind: 'plain' }
  | { kind: 'json'; formatted: string }
  | { kind: 'json_base64'; formatted: string; rawB64: string; variant: 'urlsafe' | 'standard' };

function isLikelyBase64(value: string): boolean {
  return value.length >= 12 && /^[A-Za-z0-9+/\-_=]*$/.test(value);
}

function tryDecodeBase64Json(value: string): DecodedValue | null {
  if (!isLikelyBase64(value)) return null;
  for (const variant of ['urlsafe', 'standard'] as const) {
    try {
      let b64 = value;
      if (variant === 'urlsafe') b64 = value.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      if (pad === 2) b64 += '==';
      else if (pad === 3) b64 += '=';
      const decoded = atob(b64);
      const parsed = JSON.parse(decoded);
      if (typeof parsed === 'object' && parsed !== null) {
        return { kind: 'json_base64', formatted: JSON.stringify(parsed, null, 2), rawB64: value, variant };
      }
    } catch { /* continue */ }
  }
  return null;
}

function decodeValue(value: string): DecodedValue {
  if (!value) return { kind: 'plain' };
  const b64 = tryDecodeBase64Json(value);
  if (b64) return b64;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) {
      return { kind: 'json', formatted: JSON.stringify(parsed, null, 2) };
    }
  } catch { /* fall through */ }
  return { kind: 'plain' };
}

function encodeToB64(minified: string, variant: 'urlsafe' | 'standard'): string {
  const b64 = btoa(minified);
  if (variant === 'urlsafe') return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return b64;
}


@customElement('search-params-editor')
export class SearchParamsEditor extends LitElement {
  createRenderRoot() { return this; }

  @state() private _rows: Array<[string, string, boolean]> = [];
  @state() private _historyParams: Map<string, string[]> = new Map();
  @state() private _dismissedKeys: Set<string> = new Set();
  @state() private _historyRowValues: Map<string, string> = new Map();
  @state() private _jsonEditValues: Map<number, string> = new Map();
  @state() private _invalidRows: Set<number> = new Set();
  private _unsub?: () => void;
  private _lastPageKey = '';
  private _historyFetchTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (this._historyFetchTimer !== null) {
      clearTimeout(this._historyFetchTimer);
      this._historyFetchTimer = null;
    }
  }

  private _model(): UrlModel { return getState().model; }

  private _syncRows() {
    const m = this._model();
    const k = pageKey(m);
    if (k === this._lastPageKey) return;
    this._lastPageKey = k;
    this._dismissedKeys = new Set();
    this._historyRowValues = new Map();
    this._jsonEditValues = new Map();
    this._invalidRows = new Set();
    const dp = getState().disabledParams;
    this._rows = [
      ...m.searchParams.map(([key, val]): [string, string, boolean] => [key, val, true]),
      ...dp.map(([key, val]): [string, string, boolean] => [key, val, false]),
    ];
    this._historyParams = new Map();
    const hostname = [...m.subdomains, m.domain].filter(Boolean).join('.');
    const path = '/' + m.pathSegments.map(encodeURIComponent).join('/') || '/';
    if (this._historyFetchTimer !== null) clearTimeout(this._historyFetchTimer);
    this._historyFetchTimer = setTimeout(() => {
      this._historyFetchTimer = null;
      getHistorySearchParams(hostname, path).then((map) => {
        this._historyParams = map;
      });
    }, 0);
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
    const newJsonEdit = new Map<number, string>();
    for (const [k, v] of this._jsonEditValues) {
      if (k < index) newJsonEdit.set(k, v);
      else if (k > index) newJsonEdit.set(k - 1, v);
    }
    this._jsonEditValues = newJsonEdit;

    const newInvalid = new Set<number>();
    for (const k of this._invalidRows) {
      if (k < index) newInvalid.add(k);
      else if (k > index) newInvalid.add(k - 1);
    }
    this._invalidRows = newInvalid;

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

  private _onJsonValueChange(index: number, variant: 'urlsafe' | 'standard' | undefined, e: Event) {
    const text = (e.target as HTMLTextAreaElement).value;
    this._jsonEditValues = new Map(this._jsonEditValues).set(index, text);
    try {
      const parsed = JSON.parse(text);
      const minified = JSON.stringify(parsed);
      const rawValue = variant ? encodeToB64(minified, variant) : minified;
      this._rows = this._rows.map((r, i): [string, string, boolean] =>
        i === index ? [r[0], rawValue, r[2]] : r
      );
      this._commitRows();
      const newInvalid = new Set(this._invalidRows);
      newInvalid.delete(index);
      this._invalidRows = newInvalid;
    } catch {
      this._invalidRows = new Set(this._invalidRows).add(index);
    }
  }

  private _addFromHistory(key: string, value: string) {
    this._rows = [...this._rows, [key, value, true]];
    this._commitRows();
  }

  private _renderRow(key: string, value: string, enabled: boolean, index: number) {
    const decoded = decodeValue(value);

    if (decoded.kind === 'json' || decoded.kind === 'json_base64') {
      const variant = decoded.kind === 'json_base64' ? decoded.variant : undefined;
      const displayValue = this._jsonEditValues.get(index) ?? decoded.formatted;
      const rows = Math.min(decoded.formatted.split('\n').length, 10);
      const isInvalid = this._invalidRows.has(index);

      return html`
        <div class="param-row-json" ?data-disabled=${!enabled}>
          <input type="checkbox" ?checked=${enabled} @change=${() => this._toggleRow(index)} title="${enabled ? 'Disable' : 'Enable'}" class="param-checkbox-top" />
          <input
            class="mono param-key"
            .value=${key}
            @input=${(e: Event) => this._onKeyChange(index, e)}
            placeholder="key"
            spellcheck="false"
          />
          <span class="param-eq-top">=</span>
          <div class="param-value-col">
            ${decoded.kind === 'json_base64' ? html`
              <span class="mono param-b64-raw" title=${decoded.rawB64}>${decoded.rawB64.length > 40 ? decoded.rawB64.slice(0, 40) + '…' : decoded.rawB64}</span>
            ` : ''}
            <textarea
              class="mono param-json-textarea"
              .value=${displayValue}
              rows=${rows}
              @input=${(e: Event) => this._onJsonValueChange(index, variant, e)}
              ?data-invalid=${isInvalid}
              spellcheck="false"
            ></textarea>
          </div>
          <button @click=${() => this._removeRow(index)} title="Delete param" class="param-remove-top">×</button>
        </div>
      `;
    }

    const keyListId = `sp-key-${index}`;
    const valListId = `sp-val-${index}`;
    const keySuggestions = Array.from(this._historyParams.keys());
    const valSuggestions = this._historyParams.get(key) ?? [];

    return html`
      <div class="param-row" ?data-disabled=${!enabled}>
        <input type="checkbox" ?checked=${enabled} @change=${() => this._toggleRow(index)} title="${enabled ? 'Disable' : 'Enable'}" class="param-checkbox" />
        <input
          class="mono param-key"
          .value=${key}
          list=${keyListId}
          @input=${(e: Event) => this._onKeyChange(index, e)}
          placeholder="key"
          spellcheck="false"
        />
        <datalist id=${keyListId}>
          ${keySuggestions.map((s) => html`<option value=${s}></option>`)}
        </datalist>
        <span>=</span>
        <input
          class="mono param-value"
          .value=${value}
          list=${valListId}
          @input=${(e: Event) => this._onValueChange(index, e)}
          placeholder="value"
          spellcheck="false"
        />
        <datalist id=${valListId}>
          ${valSuggestions.map((s) => html`<option value=${s}></option>`)}
        </datalist>
        <button @click=${() => this._removeRow(index)} title="Delete param" class="btn-muted">×</button>
      </div>
    `;
  }

  render() {
    const historyEntries = this._historyEntries();

    return html`
      <div class="editor-header">? Query params</div>

      ${this._rows.map(([key, value, enabled], i) => this._renderRow(key, value, enabled, i))}

      ${historyEntries.length > 0 ? html`
        <details>
          <summary class="history-summary">From history:</summary>
          ${historyEntries.map(([key, value]) => {
      const listId = `sp-hval-${key}`;
      const suggestions = this._historyParams.get(key) ?? [];
      return html`
              <div class="history-row">
                <span class="mono history-key">${key}</span>
                <span>=</span>
                <input
                  class="mono param-value"
                  .value=${value}
                  list=${listId}
                  @input=${(e: Event) => this._onHistoryValueChange(key, e)}
                  placeholder="value"
                  spellcheck="false"
                />
                <datalist id=${listId}>
                  ${suggestions.map((s) => html`<option value=${s}></option>`)}
                </datalist>
                <button @click=${() => this._addFromHistory(key, value)} title="Add param" class="btn-muted">+</button>
                <button @click=${() => this._dismissHistory(key)} title="Dismiss" class="btn-muted">×</button>
              </div>
            `;
    })}
        </details>
      ` : ''}

      <button @click=${this._addParam} class="btn-add">+ Add param</button>
    `;
  }
}
