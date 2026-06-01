import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../utils/appState.ts';
import { getHistoryOrigins, type OriginEntry } from '../utils/historySuggestions.ts';
import { parseUrl } from '../utils/urlParser.ts';
import type { UrlModel } from '../utils/urlParser.ts';
import './origins-editor.css';

@customElement('origins-editor')
export class OriginsEditor extends LitElement {
  createRenderRoot() { return this; }

  @state() private _origins: OriginEntry[] = [];
  private _unsub?: () => void;
  private _lastPath = '';

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribe(() => {
      const path = this._encodedPath();
      if (path !== this._lastPath) {
        this._lastPath = path;
        this._fetchOrigins();
      }
      this.requestUpdate();
    });
    this._fetchOrigins();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  private _model(): UrlModel { return getState().model; }

  private _currentOrigin(): string {
    const m = this._model();
    const host = [...m.subdomains, m.domain].filter(Boolean).join('.');
    return host + (m.port ? `:${m.port}` : '');
  }

  private _encodedPath(): string {
    const m = this._model();
    return m.pathSegments.length ? '/' + m.pathSegments.map(encodeURIComponent).join('/') : '/';
  }

  private _fetchOrigins() {
    const path = this._encodedPath();
    this._lastPath = path;
    getHistoryOrigins(path).then(origins => {
      this._origins = origins;
      this.requestUpdate();
    });
  }

  private _onChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    const current = this._currentOrigin();
    if (value === current) return;
    const entry = this._origins.find(o => o.origin === value);
    if (!entry) return;
    try {
      const parsed = parseUrl(`${entry.protocol}//${value}/`);
      const m = this._model();
      setState({
        model: { ...m, subdomains: parsed.subdomains, domain: parsed.domain, port: parsed.port, protocol: entry.protocol },
        dirty: true,
      });
    } catch {}
  }

  protected updated() {
    const select = this.querySelector<HTMLSelectElement>('.origins-select');
    if (select) select.value = this._currentOrigin();
  }

  render() {
    const current = this._currentOrigin();
    const others = this._origins.filter(o => o.origin !== current);
    this.hidden = others.length === 0;
    if (others.length === 0) return nothing;

    return html`
      <div class="editor-header">// Origin</div>
      <select class="mono origins-select" @change=${this._onChange}>
        <option value=${current}>${current}</option>
        ${others.map(o => html`<option value=${o.origin}>${o.origin}</option>`)}
      </select>
    `;
  }
}
