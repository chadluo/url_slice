import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../state/appState.ts';
import { getHistorySuggestions } from '../lib/historySuggestions.ts';
import type { UrlModel } from '../utils/urlParser.ts';

@customElement('port-editor')
export class PortEditor extends LitElement {
  createRenderRoot() { return this; }

  @state() private _suggestions: string[] = [];
  private _unsub?: () => void;
  private _debounceTimer?: ReturnType<typeof setTimeout>;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  }

  private _model(): UrlModel { return getState().model; }

  private _setPort(value: string) {
    setState({ model: { ...this._model(), port: value }, dirty: true });
  }

  private _fetchSuggestions() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(async () => {
      const m = this._model();
      const host = [...m.subdomains, m.domain].filter(Boolean).join('.');
      this._suggestions = await getHistorySuggestions(m.port, 'port', host);
    }, 150);
  }

  private _decrement() {
    const n = parseInt(this._model().port, 10);
    if (!isNaN(n) && n > 1) this._setPort(String(n - 1));
  }

  private _decrementLarge() {
    const n = parseInt(this._model().port, 10);
    if (!isNaN(n)) this._setPort(String(Math.max(1, n - 1000)));
  }

  private _increment() {
    const port = this._model().port;
    if (port === '') { this._setPort('3000'); return; }
    const n = parseInt(port, 10);
    if (!isNaN(n) && n < 65535) this._setPort(String(n + 1));
  }

  private _incrementLarge() {
    const port = this._model().port;
    if (port === '') { this._setPort('3000'); return; }
    const n = parseInt(port, 10);
    if (!isNaN(n)) this._setPort(String(Math.min(65535, n + 1000)));
  }

  private _onInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    if (raw === '') { this._setPort(''); return; }
    if (!/^\d+$/.test(raw)) return;
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= 65535) this._setPort(raw);
  }

  render() {
    const m = this._model();
    const show = m.port !== '' || m.protocol === 'http:' || m.protocol === 'https:';
    if (!show) return nothing;

    return html`
      <div style="margin-bottom:4px">
        <span class="mono" style="color:GrayText;font-size:0.85em">:</span>
        <span style="font-size:0.8em;color:GrayText;font-weight:500">Port</span>
      </div>
      <div style="display:flex;align-items:center;gap:2px">
        <button @click=${this._decrementLarge} title="−1000" style="cursor:pointer">−1k</button>
        <button @click=${this._decrement} title="−1" style="cursor:pointer">−</button>
        <input
          class="mono"
          inputmode="numeric"
          .value=${m.port}
          list="port-editor-suggestions"
          @input=${this._onInput}
          @focus=${this._fetchSuggestions}
          style="width:5em;text-align:center"
          placeholder="port"
          aria-label="Port number"
        />
        <datalist id="port-editor-suggestions">
          ${this._suggestions.map((s) => html`<option value=${s}></option>`)}
        </datalist>
        <button @click=${this._increment} title="+1" style="cursor:pointer">+</button>
        <button @click=${this._incrementLarge} title="+1000" style="cursor:pointer">+1k</button>
      </div>
    `;
  }
}
