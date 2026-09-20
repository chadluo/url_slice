import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { PERF_STORAGE_KEY, getPerfTimes, isPerfEnabled, setPerfEnabled, subscribePerf } from '../utils/perf.ts';
import './perf-tracker.css';

@customElement('perf-tracker')
export class PerfTracker extends LitElement {
  override createRenderRoot() { return this; }

  private _unsub?: () => void;

  // The options page toggles the setting from another document; a sidebar left
  // open would otherwise keep the old value until reopened.
  private _handleStorage = (event: StorageEvent) => {
    if (event.key === PERF_STORAGE_KEY) setPerfEnabled(event.newValue !== 'off');
  };

  override connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribePerf(() => this.requestUpdate());
    window.addEventListener('storage', this._handleStorage);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    window.removeEventListener('storage', this._handleStorage);
  }

  override render() {
    const entries = isPerfEnabled() ? Object.entries(getPerfTimes()) : [];
    if (!entries.length) return html``;

    return html`
      <div class="mono perf-tracker">
        ${entries.map(([name, ms]) => html`<span>${name} ${ms.toFixed(1)}ms</span>`)}
      </div>
    `;
  }
}
