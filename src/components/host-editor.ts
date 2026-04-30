import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../state/appState.ts';
import { getHistorySuggestions } from '../lib/historySuggestions.ts';
import type { UrlModel } from '../utils/urlParser.ts';

const CHROME_PAGES = [
  'extensions', 'downloads', 'settings', 'history', 'bookmarks',
  'newtab', 'flags', 'version', 'about', 'blank', 'apps',
  'accessibility', 'print', 'network-errors', 'update', 'credits',
];

@customElement('host-editor')
export class HostEditor extends LitElement {
  createRenderRoot() { return this; }

  @state() private _subdomainSuggestions: string[][] = [];
  @state() private _domainSuggestions: string[] = [];
  private _unsub?: () => void;
  private _debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    for (const t of this._debounceTimers.values()) clearTimeout(t);
  }

  private _model(): UrlModel { return getState().model; }

  private _fullHostname(): string {
    const m = this._model();
    return [...m.subdomains, m.domain].filter(Boolean).join('.');
  }

  private _update(patch: Partial<UrlModel>) {
    setState({ model: { ...this._model(), ...patch }, dirty: true });
  }

  private _debounce(key: string, fn: () => void, ms = 150) {
    const existing = this._debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    this._debounceTimers.set(key, setTimeout(() => { fn(); this._debounceTimers.delete(key); }, ms));
  }

  private _fetchSubdomainSuggestions(index: number, suffix: string) {
    this._debounce(`sub-${index}`, async () => {
      const suggestions = await getHistorySuggestions(suffix, 'subdomain-segment', suffix, this._model().subdomains[index]);
      const updated = [...this._subdomainSuggestions];
      while (updated.length <= index) updated.push([]);
      updated[index] = suggestions;
      this._subdomainSuggestions = updated;
    });
  }

  private _fetchDomainSuggestions(value: string) {
    this._debounce('domain', async () => {
      this._domainSuggestions = await getHistorySuggestions(value, 'host', this._fullHostname());
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

  private _onDomainInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this._update({ domain: input.value, pathSegments: [] });
    this._fetchDomainSuggestions(input.value);
  }

  private _onDomainFocus() {
    this._fetchDomainSuggestions(this._model().domain);
  }

  private _removeSubdomain(index: number) {
    const m = this._model();
    this._update({ subdomains: m.subdomains.filter((_, i) => i !== index), pathSegments: [] });
  }

  private _addSubdomain() {
    const m = this._model();
    this._update({ subdomains: [...m.subdomains, 'www'], pathSegments: [] });
  }

  private _datalistId(type: string, index = 0) {
    return `host-editor-${type}-${index}`;
  }

  render() {
    const m = this._model();

    return html`
      <div style="margin-bottom:4px">
        <span class="mono" style="color:GrayText;font-size:0.85em">//</span>
        <span style="font-size:0.8em;color:GrayText;font-weight:500">Host</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px">
        <span class="mono" style="color:GrayText">${m.protocol}//</span>

        ${m.subdomains.map((sub, i) => {
          const suffix = [...m.subdomains.slice(i + 1), m.domain].filter(Boolean).join('.');
          const listId = this._datalistId('sub', i);
          const suggestions = this._subdomainSuggestions[i] ?? [];
          return html`
            <input
              class="mono"
              .value=${sub}
              list=${listId}
              @input=${(e: Event) => this._onSubdomainInput(i, e)}
              @focus=${() => this._onSubdomainFocus(i)}
              size=${Math.max(sub.length, 3)}
              style="width:${Math.max(sub.length, 3) + 2}ch"
              title="Subdomain segment"
            />
            <datalist id=${listId}>
              ${suggestions.map((s) => html`<option value=${s}></option>`)}
            </datalist>
            <button @click=${() => this._removeSubdomain(i)} title="Remove subdomain" style="cursor:pointer;background:none;border:none;color:GrayText;padding:0 2px">×</button>
            <span class="mono" style="color:GrayText">.</span>
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
          : html`
              <input
                class="mono"
                .value=${m.domain}
                list=${this._datalistId('domain')}
                @input=${this._onDomainInput.bind(this)}
                @focus=${this._onDomainFocus.bind(this)}
                size=${Math.max(m.domain.length, 6)}
                style="width:${Math.max(m.domain.length, 6) + 2}ch"
                placeholder="domain"
              />
              <datalist id=${this._datalistId('domain')}>
                ${this._domainSuggestions.map((s) => html`<option value=${s}></option>`)}
              </datalist>
              <button @click=${this._addSubdomain} title="Add subdomain" style="cursor:pointer;background:none;border:none;color:GrayText;font-size:0.8em">+sub</button>
            `}
      </div>
    `;
  }
}
