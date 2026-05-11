import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../utils/appState.ts';
import { getHistorySuggestions, createDebouncer, type HistorySuggestion } from '../utils/historySuggestions.ts';
import type { UrlModel } from '../utils/urlParser.ts';
import './port-editor.css';

@customElement('port-editor')
export class PortEditor extends LitElement {
  createRenderRoot() { return this; }

  @state() private _suggestions: HistorySuggestion[] = [];
  private _unsub?: () => void;
  private _debouncer = createDebouncer();

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    this._debouncer.cancelAll();
  }

  private _model(): UrlModel { return getState().model; }

  private _setPort(value: string) {
    setState({ model: { ...this._model(), port: value }, dirty: true });
  }

  private _fetchSuggestions() {
    this._debouncer.schedule(0, async () => {
      const m = this._model();
      const host = [...m.subdomains, m.domain].filter(Boolean).join('.');
      this._suggestions = await getHistorySuggestions(m.port, 'port', host);
    });
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
    this.hidden = !show;
    if (!show) return nothing;

    return html`
      <div class="editor-header">: Port</div>
      <div class="port-controls">
        <button @click=${this._decrementLarge} title="−1000">−1k</button>
        <button @click=${this._decrement} title="−1">−</button>
        <input
          class="mono port-input"
          inputmode="numeric"
          .value=${m.port}
          list="port-editor-suggestions"
          @input=${this._onInput}
          @focus=${this._fetchSuggestions}
          placeholder="port"
          aria-label="Port number"
        />
        <datalist id="port-editor-suggestions">
          ${this._suggestions.map((s) => html`<option value=${s.value}>${s.title}</option>`)}
        </datalist>
        <button @click=${this._increment} title="+1">+</button>
        <button @click=${this._incrementLarge} title="+1000">+1k</button>
      </div>
    `;
  }
}
