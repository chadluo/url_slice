import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { getState, setState, subscribe } from "../utils/appState.ts";
import { initCurrentUrl } from "../utils/currentUrl.ts";
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
  private _handleKeydown = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.key !== "Enter" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !this._isApplyTextField(event.target)
    ) {
      return;
    }

    event.preventDefault();
    this._handleApply();
  };

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("keydown", this._handleKeydown);
    this._unsub = subscribe(() => this.requestUpdate());
    this._cleanupUrl = initCurrentUrl();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this._handleKeydown);
    this._unsub?.();
    this._cleanupUrl?.();
  }

  private _isApplyTextField(target: EventTarget | null): boolean {
    return target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;
  }

  private _handleApply() {
    const { model, committedModel, tabId, dirty } = getState();
    if (tabId === null || !model || !committedModel || !dirty) return;
    const newUrl = buildUrl(model);
    setState({ dirty: false });
    browser.tabs.update(tabId, { url: newUrl });
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

  private _handleCopyMarkdown() {
    const { model, title } = getState();
    if (!model) return;
    const url = buildUrl(model);
    const text = title ? `[${title}](${url})` : `<${url}>`;
    navigator.clipboard.writeText(text);
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
        <button @click=${this._handleCopyMarkdown} title="Copy as Markdown" class="btn-muted">📝</button>
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
