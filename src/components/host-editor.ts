import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../utils/appState.ts';
import { getHistorySuggestions, createDebouncer, type HistorySuggestion } from '../utils/historySuggestions.ts';
import type { UrlModel } from '../utils/urlParser.ts';
import './host-editor.css';

const CHROME_PAGES = [
  'extensions', 'downloads', 'settings', 'history', 'bookmarks',
  'newtab', 'flags', 'version', 'about', 'blank', 'apps',
  'accessibility', 'print', 'network-errors', 'update', 'credits',
];

@customElement('host-editor')
export class HostEditor extends LitElement {
  createRenderRoot() { return this; }

  @state() private _subdomainSuggestions: HistorySuggestion[][] = [];
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

  private _update(patch: Partial<UrlModel>) {
    setState({ model: { ...this._model(), ...patch }, dirty: true });
  }

  private _fetchSubdomainSuggestions(index: number, suffix: string) {
    this._debouncer.schedule(`sub-${index}`, async () => {
      const suggestions = await getHistorySuggestions(suffix, 'subdomain-segment', suffix, this._model().subdomains[index]);
      const updated = [...this._subdomainSuggestions];
      while (updated.length <= index) updated.push([]);
      updated[index] = suggestions;
      this._subdomainSuggestions = updated;
    });
  }

  private _onSubdomainInput(index: number, e: Event) {
    const input = e.target as HTMLInputElement;
    const m = this._model();
    const updated = m.subdomains.map((s, i) => (i === index ? input.value : s));
    this._update({ subdomains: updated, pathSegments: [] });
    const suffix = [...updated.slice(index + 1), m.domain].filter(Boolean).join('.');
    this._fetchSubdomainSuggestions(index, suffix);
  }

  private _onSubdomainFocus(index: number) {
    const m = this._model();
    const suffix = [...m.subdomains.slice(index + 1), m.domain].filter(Boolean).join('.');
    this._fetchSubdomainSuggestions(index, suffix);
  }

  private _removeSubdomain(index: number) {
    const m = this._model();
    this._update({ subdomains: m.subdomains.filter((_, i) => i !== index), pathSegments: [] });
  }

  private _addSubdomain() {
    const m = this._model();
    this._update({ subdomains: ['', ...m.subdomains], pathSegments: [] });
  }

  private _datalistId(index = 0) {
    return `host-editor-sub-${index}`;
  }

  render() {
    const m = this._model();

    return html`
      <div class="editor-header">// Host</div>
      <div class="host-chips">
        <span class="mono chip-sep">${m.protocol}//</span>

        ${m.protocol !== 'chrome:'
          ? html`<button @click=${this._addSubdomain} title="Add subdomain">+</button>`
          : ''}

        ${m.subdomains.map((sub, i) => {
          const listId = this._datalistId(i);
          const suggestions = this._subdomainSuggestions[i] ?? [];
          return html`
            <input
              id="host-editor-sub-input-${i}"
              class="mono"
              .value=${sub}
              list=${listId}
              @input=${(e: Event) => this._onSubdomainInput(i, e)}
              @focus=${() => this._onSubdomainFocus(i)}
              size=${Math.max(sub.length, 8)}
              style="width:${Math.max(sub.length, 8) + 2}ch"
              title="Subdomain segment"
            />
            <datalist id=${listId}>
              ${suggestions.map((s) => html`<option value=${s.value}>${s.title}</option>`)}
            </datalist>
            <button @click=${() => this._removeSubdomain(i)} title="Remove subdomain" class="btn-muted chip-remove">×</button>
            <span class="mono chip-sep">.</span>
          `;
        })}

        ${m.protocol === 'chrome:'
          ? html`
              <select
                class="mono"
                .value=${m.domain}
                @change=${(e: Event) => this._update({ domain: (e.target as HTMLSelectElement).value })}
              >
                ${CHROME_PAGES.map((p) => html`<option value=${p} ?selected=${p === m.domain}>${p}</option>`)}
              </select>
            `
          : html`<span class="mono">${m.domain}</span>`}
      </div>
    `;
  }
}
