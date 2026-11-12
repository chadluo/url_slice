import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getState, setState, subscribe } from "../utils/appState.ts";
import { initCurrentUrl } from "../utils/currentUrl.ts";
import { buildUrl } from "../utils/urlBuilder.ts";
import "./fragment-editor.ts";
import "./host-editor.ts";
import "./origins-editor.ts";
import "./path-editor.ts";
import "./perf-tracker.ts";
import "./port-editor.ts";
import "./search-params-editor.ts";
import "./url-slice-app.css";

@customElement("url-slice-app")
export class UrlSliceApp extends LitElement {
  @property({ type: String }) mode: "popup" | "sidebar" = "popup";
  @state() private _copyStatus = "";
  private _copyStatusTimer?: number;

  override createRenderRoot() {
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

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("keydown", this._handleKeydown);
    this._unsub = subscribe(() => this.requestUpdate());
    this._cleanupUrl = initCurrentUrl();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this._handleKeydown);
    this._unsub?.();
    this._cleanupUrl?.();
  }

  private _isApplyTextField(target: EventTarget | null): boolean {
    return target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;
  }

  private async _handleApply() {
    const { model, committedModel, tabId, dirty } = getState();
    if (tabId === null || !model || !committedModel || !dirty) return;
    const newUrl = buildUrl(model);
    // Cleared first so the navigation's own tab update replaces the model (see currentUrl.ts).
    setState({ dirty: false });
    try {
      await browser.tabs.update(tabId, { url: newUrl });
    } catch {
      // Only if the user is still on the same tab and edit; after a tab switch the edit is gone.
      const now = getState();
      if (now.tabId === tabId && now.model === model) setState({ dirty: true });
    }
  }

  private _handleReset() {
    const { committedModel } = getState();
    if (!committedModel) return;
    setState({ model: { ...committedModel }, dirty: false });
  }

  private async _copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this._copyStatus = "Copied";
    } catch {
      this._copyStatus = "Copy failed";
    }
    clearTimeout(this._copyStatusTimer);
    this._copyStatusTimer = window.setTimeout(() => (this._copyStatus = ""), 2000);
  }

  private _handleCopy() {
    const { model } = getState();
    if (!model) return;
    this._copy(buildUrl(model));
  }

  private _handleCopyMarkdown() {
    const { model, title } = getState();
    if (!model) return;
    const url = buildUrl(model);
    const text = title ? `[${title.replace(/[\\[\]]/g, "\\$&")}](${url})` : `<${url}>`;
    this._copy(text);
  }

  override render() {
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
        <span role="status">${this._copyStatus}</span>
      </div>

      <div class="editors-grid">
        <host-editor></host-editor>
        <port-editor></port-editor>
        <origins-editor></origins-editor>
        <hr />
        <path-editor></path-editor>
        <hr />
        <search-params-editor></search-params-editor>
        <hr />
        <fragment-editor></fragment-editor>
      </div>

      <div class="action-bar">
        <button @click=${this._handleApply} ?disabled=${!dirty} class="btn-apply">Apply</button>

        <button @click=${this._handleReset} class="btn-reset">Reset</button>
      </div>

      <perf-tracker></perf-tracker>
    `;
  }
}
