import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, StoreController } from '../utils/appState.ts';
import { createDebouncer, getHistorySuggestions, type HistorySuggestion } from '../utils/historySuggestions.ts';
import { withPerf } from '../utils/perf.ts';
import type { UrlModel } from '../utils/urlParser.ts';
import './host-editor.css';

@customElement('host-editor')
export class HostEditor extends LitElement {
  override createRenderRoot() { return this; }

  @state() private _subdomainSuggestions: HistorySuggestion[][] = [];
  private _store = new StoreController(this);
  private _debouncer = createDebouncer();

  override disconnectedCallback() {
    super.disconnectedCallback();
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
    this._update({ subdomains: updated });
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
    this._update({ subdomains: m.subdomains.filter((_, i) => i !== index) });
  }

  private _addSubdomain() {
    const m = this._model();
    this._update({ subdomains: ['', ...m.subdomains] });
  }

  private _datalistId(index = 0) {
    return `host-editor-sub-${index}`;
  }

  override render() {
    return withPerf('host', () => this._renderContent());
  }

  private _renderContent() {
    const m = this._model();

    return html`
      <div class="editor-header">// Host</div>
      <div class="host-chips">
        <span class="mono chip-sep">${m.protocol}//</span>

        <button @click=${this._addSubdomain} title="Add subdomain" aria-label="Add subdomain">+</button>

        ${m.subdomains.map((sub, i) => {
          const listId = this._datalistId(i);
          const suggestions = this._subdomainSuggestions[i] ?? [];
          return html`
            <input
              id="host-editor-sub-input-${i}"
              class="mono host-sub"
              .value=${sub}
              list=${listId}
              @input=${(e: Event) => this._onSubdomainInput(i, e)}
              @focus=${() => this._onSubdomainFocus(i)}
              title="Subdomain segment"
            />
            <datalist id=${listId}>
              ${suggestions.map((s) => html`<option value=${s.value}>${s.title}</option>`)}
            </datalist>
            <button @click=${() => this._removeSubdomain(i)} title="Remove subdomain" aria-label="Remove subdomain ${sub} #${i + 1}" class="btn-muted chip-remove">×</button>
            <span class="mono chip-sep">.</span>
          `;
        })}

        <span class="mono">${m.domain}</span>
      </div>
    `;
  }
}
