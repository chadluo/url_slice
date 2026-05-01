import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { initCurrentUrl } from "../lib/currentUrl.ts";
import { getState, setState, subscribe } from "../state/appState.ts";
import { buildUrl } from "../utils/urlBuilder.ts";
import "./fragment-editor.ts";
import "./host-editor.ts";
import "./path-editor.ts";
import "./port-editor.ts";
import "./search-params-editor.ts";
import "./url-slice-app.css";

@customElement("url-slice-app")
export class UrlSliceApp extends LitElement {
  @property({ type: String }) mode: "popup" | "sidebar" = "popup";

  createRenderRoot() {
    return this;
  }

  private _unsub?: () => void;
  private _cleanupUrl?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribe(() => this.requestUpdate());
    this._cleanupUrl = initCurrentUrl();
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
        <div class="url-error">
          <span style="font-size:2rem">🔒</span>
          <p>${error ?? "Loading…"}</p>
        </div>
      `;
    }

    const builtUrl = buildUrl(model);

    return html`
      <div class="url-bar">
        <code class="mono url-display">${builtUrl}</code>
        <button @click=${this._handleCopy} title="Copy URL" class="btn-muted">📋</button>
      </div>

      <host-editor></host-editor>
      <port-editor></port-editor>
      <path-editor></path-editor>
      <search-params-editor></search-params-editor>
      <fragment-editor></fragment-editor>

      <div class="action-bar">
        <button @click=${this._handleApply} ?disabled=${!dirty} class="btn-apply">Apply</button>
        <button @click=${this._handleReset} class="btn-reset">Reset</button>
      </div>
    `;
  }
}
