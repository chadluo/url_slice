import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../state/appState.ts';
import { getHistorySuggestions } from '../lib/historySuggestions.ts';
import type { UrlModel } from '../utils/urlParser.ts';
import './path-editor.css';

@customElement('path-editor')
export class PathEditor extends LitElement {
  createRenderRoot() { return this; }

  @state() private _segmentSuggestions: string[][] = [];
  private _unsub?: () => void;
  private _debounceTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

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

  private _hostname(): string {
    const m = this._model();
    return [...m.subdomains, m.domain].filter(Boolean).join('.');
  }

  private _pathPrefix(upToIndex: number): string {
    const segs = this._model().pathSegments.slice(0, upToIndex);
    return segs.length === 0 ? '/' : '/' + segs.join('/') + '/';
  }

  private _fetchSuggestions(index: number) {
    const existing = this._debounceTimers.get(index);
    if (existing) clearTimeout(existing);
    this._debounceTimers.set(index, setTimeout(async () => {
      const prefix = this._pathPrefix(index);
      const currentSeg = this._model().pathSegments[index] ?? '';
      const suggestions = await getHistorySuggestions(prefix, 'path-segment', this._hostname(), currentSeg);
      const updated = [...this._segmentSuggestions];
      while (updated.length <= index) updated.push([]);
      updated[index] = suggestions;
      this._segmentSuggestions = updated;
      this._debounceTimers.delete(index);
    }, 150));
  }

  private _onSegmentInput(index: number, e: Event) {
    const value = (e.target as HTMLInputElement).value;
    const m = this._model();
    setState({ model: { ...m, pathSegments: [...m.pathSegments.slice(0, index), value] }, dirty: true });
    this._fetchSuggestions(index);
  }

  private _onSegmentFocus(index: number) {
    this._fetchSuggestions(index);
  }

  private _truncateBefore(index: number) {
    const m = this._model();
    setState({ model: { ...m, pathSegments: m.pathSegments.slice(0, index) }, dirty: true });
  }

  private _addSegment() {
    const m = this._model();
    setState({ model: { ...m, pathSegments: [...m.pathSegments, ''] }, dirty: true });
    setTimeout(() => {
      const inputs = this.querySelectorAll<HTMLInputElement>('input.path-seg');
      inputs[inputs.length - 1]?.focus();
    }, 0);
  }

  render() {
    const m = this._model();

    return html`
      <div class="editor-header">/ Path</div>
      <div class="path-row">
        <span class="mono chip-sep">/</span>
        ${m.pathSegments.map((seg, i) => {
          const listId = `path-editor-seg-${i}`;
          const suggestions = this._segmentSuggestions[i] ?? [];
          return html`
            <input
              id="path-editor-seg-input-${i}"
              class="mono path-seg"
              .value=${seg}
              list=${listId}
              @input=${(e: Event) => this._onSegmentInput(i, e)}
              @focus=${() => this._onSegmentFocus(i)}
              size=${Math.max(seg.length, 8)}
              style="width:${Math.max(seg.length, 8) + 2}ch"
              placeholder="segment"
            />
            <datalist id=${listId}>
              ${suggestions.map((s) => html`<option value=${s}></option>`)}
            </datalist>
            <button
              @click=${() => this._truncateBefore(i)}
              title="Truncate path before this segment"
              class="btn-muted seg-remove"
            >×</button>
            ${i < m.pathSegments.length - 1
              ? html`<span class="mono chip-sep">/</span>`
              : ''}
          `;
        })}
        <button @click=${this._addSegment} title="Add path segment" class="seg-add">+</button>
      </div>
    `;
  }
}
