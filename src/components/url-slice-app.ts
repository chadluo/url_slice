import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../state/appState.ts';
import { initCurrentUrl } from '../lib/currentUrl.ts';
import { buildUrl } from '../utils/urlBuilder.ts';
import './host-editor.ts';
import './port-editor.ts';
import './path-editor.ts';
import './search-params-editor.ts';
import './fragment-editor.ts';

@customElement('url-slice-app')
export class UrlSliceApp extends LitElement {
  @property({ type: String }) mode: 'popup' | 'sidebar' = 'popup';

  createRenderRoot() { return this; }

  private _unsub?: () => void;
  private _cleanupUrl?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribe(() => this.requestUpdate());
    this._cleanupUrl = initCurrentUrl();

    if (this.mode === 'popup') {
      Object.assign(this.style, { display: 'block', width: '600px', minHeight: '200px', maxHeight: '600px', overflowY: 'auto', padding: '16px' });
    } else {
      Object.assign(this.style, { display: 'block', padding: '16px' });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    this._cleanupUrl?.();
  }

  private _handleApply() {
    const { model, tabId } = getState();
    if (tabId === null || !model) return;
    browser.tabs.update(tabId, { url: buildUrl(model) });
  }

  private _handleReset() {
    const { committedModel } = getState();
    if (!committedModel) return;
    setState({ model: { ...committedModel }, dirty: false });
  }

  private _handleCopy() {
    const { model } = getState();
    if (!model) return;
    navigator.clipboard.writeText(buildUrl(model));
  }

  render() {
    const { model, error, dirty } = getState();

    if (error || !model) {
      return html`
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;height:100%">
          <span style="font-size:2rem">🔒</span>
          <p style="color:GrayText;font-size:0.9em">${error ?? 'Loading…'}</p>
        </div>
      `;
    }

    const builtUrl = buildUrl(model);

    return html`
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:12px">
        <code class="mono" style="flex:1;color:GrayText;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${builtUrl}</code>
        <button @click=${this._handleCopy} title="Copy URL" style="cursor:pointer;background:none;border:none;color:GrayText">📋</button>
      </div>

      <hr>
      <host-editor></host-editor>
      <hr>
      <port-editor></port-editor>
      <hr>
      <path-editor></path-editor>
      <hr>
      <search-params-editor></search-params-editor>
      <hr>
      <fragment-editor></fragment-editor>
      <hr>

      <div style="display:flex;gap:8px;margin-top:12px">
        <button
          @click=${this._handleApply}
          ?disabled=${!dirty}
          style="flex:1;padding:6px 16px;cursor:${dirty ? 'pointer' : 'not-allowed'};opacity:${dirty ? '1' : '0.5'}"
        >Apply</button>
        <button @click=${this._handleReset} style="padding:6px 12px;cursor:pointer">Reset</button>
      </div>
    `;
  }
}
