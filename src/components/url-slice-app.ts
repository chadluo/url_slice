import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { initCurrentUrl } from "../utils/currentUrl.ts";
import { getState, setState, subscribe } from "../utils/appState.ts";
import { buildUrl } from "../utils/urlBuilder.ts";
import type { UrlModel } from "../utils/urlParser.ts";
import "./fragment-editor.ts";
import "./host-editor.ts";
import "./path-editor.ts";
import "./port-editor.ts";
import "./search-params-editor.ts";
import "./url-slice-app.css";

function onlyFragmentsChanged(a: UrlModel, b: UrlModel): boolean {
  return (
    a.protocol === b.protocol &&
    a.domain === b.domain &&
    JSON.stringify(a.subdomains) === JSON.stringify(b.subdomains) &&
    a.port === b.port &&
    JSON.stringify(a.pathSegments) === JSON.stringify(b.pathSegments) &&
    JSON.stringify(a.searchParams) === JSON.stringify(b.searchParams)
  );
}

@customElement("url-slice-app")
export class UrlSliceApp extends LitElement {
  @property({ type: String }) mode: "popup" | "sidebar" = "popup";

  createRenderRoot() {
    return this;
  }

  private _unsub?: () => void;
  private _cleanupUrl?: () => void;
  private _highlightedOnLoad = false;

  connectedCallback() {
    super.connectedCallback();
    this._highlightedOnLoad = false;
    this._unsub = subscribe(() => {
      this.requestUpdate();
      if (!this._highlightedOnLoad) {
        const { model, tabId, dirty } = getState();
        if (model && tabId !== null && !dirty) {
          this._highlightedOnLoad = true;
          this._sendHighlightAll(model, tabId);
        }
      }
    });
    this._cleanupUrl = initCurrentUrl();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    this._cleanupUrl?.();
  }

  private _sendHighlightAll(model: UrlModel, tabId: number) {
    const texts = model.textFragments.map(f => f.textStart).filter(Boolean);
    if (texts.length === 0) return;
    browser.tabs.sendMessage(tabId, { type: 'HIGHLIGHT_ALL', texts }).catch(() => {});
  }

  private _handleApply() {
    const { model, committedModel, tabId } = getState();
    if (tabId === null || !model || !committedModel) return;
    const newUrl = buildUrl(model);
    if (onlyFragmentsChanged(model, committedModel)) {
      setState({ dirty: false, committedModel: model });
      browser.tabs.sendMessage(tabId, { type: 'UPDATE_URL', url: newUrl }).catch(() => {});
    } else {
      setState({ dirty: false });
      browser.tabs.update(tabId, { url: newUrl });
    }
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
      <hr />
      <port-editor></port-editor>
      <hr />
      <path-editor></path-editor>
      <hr />
      <search-params-editor></search-params-editor>
      <hr />
      <fragment-editor></fragment-editor>

      <div class="action-bar">
        <button @click=${this._handleApply} ?disabled=${!dirty} class="btn-apply">Apply</button>
        <button @click=${this._handleReset} class="btn-reset">Reset</button>
      </div>
    `;
  }
}
