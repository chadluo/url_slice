import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, StoreController } from '../utils/appState.ts';
import { isGitHubQuery, parseQualifiers, qualifierHistory, serializeQualifiers, type Qualifier } from '../utils/githubQuery.ts';
import { getHistorySearchParams } from '../utils/historySuggestions.ts';
import { saveDisabledParams } from '../utils/pageStateStorage.ts';
import { withPerf } from '../utils/perf.ts';
import { hostname, pageKey, type UrlModel } from '../utils/urlParser.ts';
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
      const bytes = Uint8Array.fromBase64(value, { alphabet: variant === 'urlsafe' ? 'base64url' : 'base64' });
      const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (typeof parsed === 'object' && parsed !== null) {
        return { kind: 'json_base64', formatted: JSON.stringify(parsed, null, 2), rawB64: value, variant };
      }
    } catch { /* continue */ }
  }
  return null;
}

// Each render decodes every row again (any editor's keystroke re-renders all rows), so keep results by value.
// ponytail: unbounded, one entry per distinct value seen in this popup / side panel session; a side panel left
// open for a long time with many edited values keeps growing. Add an LRU limit if that shows in memory.
const decodeCache = new Map<string, DecodedValue>();

function decodeValue(value: string): DecodedValue {
  let decoded = decodeCache.get(value);
  if (!decoded) decodeCache.set(value, (decoded = decodeUncached(value)));
  return decoded;
}

function decodeUncached(value: string): DecodedValue {
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
  const bytes = new TextEncoder().encode(minified);
  return variant === 'urlsafe' ? bytes.toBase64({ alphabet: 'base64url', omitPadding: true }) : bytes.toBase64();
}

// Row-index-keyed local state must follow the rows when one is removed.
function dropIndex<T>(map: Map<number, T>, index: number): Map<number, T> {
  const next = new Map<number, T>();
  for (const [k, v] of map) {
    if (k < index) next.set(k, v);
    else if (k > index) next.set(k - 1, v);
  }
  return next;
}

type Row = { key: string; value: string; enabled: boolean };

@customElement('search-params-editor')
export class SearchParamsEditor extends LitElement {
  override createRenderRoot() { return this; }

  @state() private _rows: Row[] = [];
  @state() private _historyParams: Map<string, string[]> = new Map();
  @state() private _dismissedKeys: Set<string> = new Set();
  @state() private _historyRowValues: Map<string, string> = new Map();
  @state() private _jsonEditValues: Map<number, string> = new Map();
  @state() private _invalidRows: Set<number> = new Set();
  // Held locally so blank qualifier rows survive; serialization drops them from the URL.
  @state() private _qualifierEdits: Map<number, Qualifier[]> = new Map();
  private _store = new StoreController(this, () => this._syncRows());
  private _lastPageKey = '';
  // The searchParams array the rows last produced or loaded. A different array means Reset or a page update.
  private _syncedParams: [string, string][] | null = null;
  private _historyFetchTimer: ReturnType<typeof setTimeout> | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this._syncRows();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this._historyFetchTimer !== null) {
      clearTimeout(this._historyFetchTimer);
      this._historyFetchTimer = null;
    }
  }

  private _model(): UrlModel { return getState().model; }

  private _syncRows() {
    const m = this._model();
    const k = pageKey(m);
    const pageChanged = k !== this._lastPageKey;
    if (!pageChanged && m.searchParams === this._syncedParams) return;
    const dp = getState().disabledParams;
    this._syncedParams = m.searchParams;
    this._jsonEditValues = new Map();
    this._invalidRows = new Set();
    this._qualifierEdits = new Map();
    this._rows = [
      ...m.searchParams.map(([key, value]) => ({ key, value, enabled: true })),
      ...dp.map(([key, value]) => ({ key, value, enabled: false })),
    ];
    if (!pageChanged) return;
    this._lastPageKey = k;
    this._dismissedKeys = new Set();
    this._historyRowValues = new Map();
    this._historyParams = new Map();

    const host = hostname(m);
    const path = '/' + m.pathSegments.map(encodeURIComponent).join('/');
    if (this._historyFetchTimer !== null) clearTimeout(this._historyFetchTimer);
    this._historyFetchTimer = setTimeout(() => {
      this._historyFetchTimer = null;
      getHistorySearchParams(host, path).then((map) => {
        this._historyParams = map;
      });
    }, 0);
  }

  private _commitRows() {
    const enabled = this._rows.filter(r => r.enabled).map(r => [r.key, r.value] as [string, string]);
    const disabled = this._rows.filter(r => !r.enabled).map(r => [r.key, r.value] as [string, string]);
    const m = this._model();
    this._syncedParams = enabled;
    setState({ model: { ...m, searchParams: enabled }, disabledParams: disabled, dirty: true });
    saveDisabledParams(m, disabled);
  }

  private _patchRow(index: number, patch: Partial<Row>) {
    this._rows = this._rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    this._commitRows();
  }

  private _toggleRow(index: number) {
    this._patchRow(index, { enabled: !this._rows[index]!.enabled });
  }

  private _disableAll() {
    this._rows = this._rows.map((r) => ({ ...r, enabled: false }));
    this._commitRows();
  }

  private _onKeyChange(index: number, e: Event) {
    this._patchRow(index, { key: (e.target as HTMLInputElement).value });
  }

  private _onValueChange(index: number, e: Event) {
    this._patchRow(index, { value: (e.target as HTMLInputElement).value });
  }

  private _removeRow(index: number) {
    this._jsonEditValues = dropIndex(this._jsonEditValues, index);
    this._qualifierEdits = dropIndex(this._qualifierEdits, index);

    const newInvalid = new Set<number>();
    for (const k of this._invalidRows) {
      if (k < index) newInvalid.add(k);
      else if (k > index) newInvalid.add(k - 1);
    }
    this._invalidRows = newInvalid;

    this._rows = this._rows.filter((_, i) => i !== index);
    this._commitRows();
  }

  private async _addParam() {
    this._rows = [...this._rows, { key: '', value: '', enabled: true }];
    this._commitRows();
    await this.updateComplete;
    const inputs = this.querySelectorAll<HTMLInputElement>('.param-key');
    inputs[inputs.length - 1]?.focus();
  }

  private _historyEntries(): [string, string][] {
    const activeKeys = new Set(this._rows.map(r => r.key));
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
    const newInvalid = new Set(this._invalidRows);
    newInvalid.delete(index);
    this._invalidRows = newInvalid;
    try {
      const minified = JSON.stringify(JSON.parse(text));
      this._patchRow(index, { value: variant ? encodeToB64(minified, variant) : minified });
    } catch {
      // The error shows on blur.
    }
  }

  private _onJsonBlur(index: number, e: Event) {
    try {
      JSON.parse((e.target as HTMLTextAreaElement).value);
    } catch {
      this._invalidRows = new Set(this._invalidRows).add(index);
    }
  }

  private _setQualifiers(index: number, pairs: Qualifier[]) {
    this._qualifierEdits = new Map(this._qualifierEdits).set(index, pairs);
    const value = serializeQualifiers(pairs);
    this._patchRow(index, { value });
  }

  private _renderQualifierRow(key: string, enabled: boolean, index: number, pairs: Qualifier[]) {
    const history = qualifierHistory(this._historyParams.get(key) ?? []);
    const keyListId = `sp-qkey-${index}`;
    const edit = (j: number, pair: Qualifier) =>
      this._setQualifiers(index, pairs.map((p, i) => (i === j ? pair : p)));

    return html`
      <div class="param-row-json" ?data-disabled=${!enabled}>
        <input type="checkbox" ?checked=${enabled} @change=${() => this._toggleRow(index)} aria-label="Include ${key}" class="param-checkbox-top" />
        <input
          class="mono param-key"
          .value=${key}
          @input=${(e: Event) => this._onKeyChange(index, e)}
          placeholder="key"
          aria-label="Param ${index + 1} key"
          spellcheck="false"
        />
        <span class="param-eq-top">=</span>
        <div class="param-value-col">
          <datalist id=${keyListId}>
            ${Array.from(history.keys()).map((s) => html`<option value=${s}></option>`)}
          </datalist>
          ${pairs.map(([qk, qv], j) => html`
            <div class="param-row">
              <input
                class="mono param-key"
                .value=${qk}
                list=${keyListId}
                @input=${(e: Event) => edit(j, [(e.target as HTMLInputElement).value, qv])}
                placeholder="qualifier"
                aria-label="Qualifier ${j + 1} of ${key}"
                spellcheck="false"
              />
              <span>:</span>
              <input
                class="mono param-value"
                .value=${qv}
                list=${`sp-qval-${index}-${j}`}
                @input=${(e: Event) => edit(j, [qk, (e.target as HTMLInputElement).value])}
                placeholder="value"
                aria-label="Value of qualifier ${qk}"
                spellcheck="false"
              />
              <datalist id=${`sp-qval-${index}-${j}`}>
                ${(history.get(qk) ?? []).map((s) => html`<option value=${s}></option>`)}
              </datalist>
              <button @click=${() => this._setQualifiers(index, pairs.filter((_, i) => i !== j))} title="Delete qualifier" aria-label="Delete qualifier ${qk}" class="btn-muted">×</button>
            </div>
          `)}
          <button @click=${() => this._setQualifiers(index, [...pairs, ['', '']])} class="btn-add">+ Add qualifier</button>
        </div>
        <button @click=${() => this._removeRow(index)} title="Delete param" aria-label="Delete param ${key}" class="btn-muted param-remove-top">×</button>
      </div>
    `;
  }

  private _addFromHistory(key: string, value: string) {
    this._rows = [...this._rows, { key, value, enabled: true }];
    this._commitRows();
  }

  private _renderRow(key: string, value: string, enabled: boolean, index: number) {
    const m = this._model();
    const qualifiers = this._qualifierEdits.get(index)
      ?? (isGitHubQuery(hostname(m), value) ? parseQualifiers(value) : null);
    if (qualifiers) return this._renderQualifierRow(key, enabled, index, qualifiers);

    const decoded = decodeValue(value);

    if (decoded.kind === 'json' || decoded.kind === 'json_base64') {
      const variant = decoded.kind === 'json_base64' ? decoded.variant : undefined;
      const displayValue = this._jsonEditValues.get(index) ?? decoded.formatted;
      const rows = Math.min(decoded.formatted.split('\n').length, 10);
      const isInvalid = this._invalidRows.has(index);

      return html`
        <div class="param-row-json" ?data-disabled=${!enabled}>
          <input type="checkbox" ?checked=${enabled} @change=${() => this._toggleRow(index)} aria-label="Include ${key}" class="param-checkbox-top" />
          <input
            class="mono param-key"
            .value=${key}
            @input=${(e: Event) => this._onKeyChange(index, e)}
            placeholder="key"
          aria-label="Param ${index + 1} key"
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
              aria-label="JSON value of ${key}"
              @input=${(e: Event) => this._onJsonValueChange(index, variant, e)}
              @blur=${(e: Event) => this._onJsonBlur(index, e)}
              aria-invalid=${isInvalid}
              aria-describedby="sp-json-err-${index}"
              spellcheck="false"
            ></textarea>
            ${isInvalid ? html`<span id="sp-json-err-${index}" class="param-json-error">Invalid JSON</span>` : ''}
          </div>
          <button @click=${() => this._removeRow(index)} title="Delete param" aria-label="Delete param ${key}" class="btn-muted param-remove-top">×</button>
        </div>
      `;
    }

    return html`
      <div class="param-row" ?data-disabled=${!enabled}>
        <input type="checkbox" ?checked=${enabled} @change=${() => this._toggleRow(index)} aria-label="Include ${key}" class="param-checkbox" />
        <input
          class="mono param-key"
          .value=${key}
          list="sp-keys"
          @input=${(e: Event) => this._onKeyChange(index, e)}
          placeholder="key"
          aria-label="Param ${index + 1} key"
          spellcheck="false"
        />
        <span>=</span>
        <input
          class="mono param-value"
          .value=${value}
          list=${this._valueListId(key)}
          @input=${(e: Event) => this._onValueChange(index, e)}
          placeholder="value"
          aria-label="Value of ${key}"
          spellcheck="false"
        />
        <button @click=${() => this._removeRow(index)} title="Delete param" aria-label="Delete param ${key}" class="btn-muted">×</button>
      </div>
    `;
  }

  // One value list per history key, shared by every row with that key. The index keeps the ID valid for any key.
  private _valueListId(key: string): string {
    return `sp-vals-${Array.from(this._historyParams.keys()).indexOf(key)}`;
  }

  override render() {
    return withPerf('search-params', () => this._renderContent());
  }

  private _renderContent() {
    const historyEntries = this._historyEntries();

    return html`
      <div class="editor-header">? Query params</div>
      ${this._rows.some(r => r.enabled) ? html`
        <button @click=${this._disableAll} class="btn-muted">Disable all</button>
      ` : ''}

      ${this._rows.map(({ key, value, enabled }, i) => this._renderRow(key, value, enabled, i))}

      ${historyEntries.length > 0 ? html`
        <details>
          <summary class="history-summary">From history:</summary>
          ${historyEntries.map(([key, value]) => html`
              <div class="history-row">
                <span class="mono history-key">${key}</span>
                <span>=</span>
                <input
                  class="mono param-value"
                  .value=${value}
                  list=${this._valueListId(key)}
                  @input=${(e: Event) => this._onHistoryValueChange(key, e)}
                  placeholder="value"
                  aria-label="History value of ${key}"
                  spellcheck="false"
                />
                <button @click=${() => this._addFromHistory(key, value)} title="Add param" aria-label="Add param ${key}" class="btn-muted">+</button>
                <button @click=${() => this._dismissHistory(key)} title="Dismiss" aria-label="Dismiss ${key}" class="btn-muted">×</button>
              </div>
            `)}
        </details>
      ` : ''}

      <button @click=${this._addParam} class="btn-add">+ Add param</button>

      <datalist id="sp-keys">
        ${Array.from(this._historyParams.keys(), (k) => html`<option value=${k}></option>`)}
      </datalist>
      ${Array.from(this._historyParams.values(), (values, i) => html`
        <datalist id="sp-vals-${i}">${values.map((v) => html`<option value=${v}></option>`)}</datalist>
      `)}
    `;
  }
}
