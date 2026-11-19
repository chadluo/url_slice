import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, StoreController } from '../utils/appState.ts';
import { getHistorySuggestions, createDebouncer, type HistorySuggestion } from '../utils/historySuggestions.ts';
import { withPerf } from '../utils/perf.ts';
import { hostname, type UrlModel } from '../utils/urlParser.ts';
import './path-editor.css';

@customElement('path-editor')
export class PathEditor extends LitElement {
  override createRenderRoot() { return this; }

  @state() private _segmentSuggestions: HistorySuggestion[][] = [];
  private _store = new StoreController(this);
  private _debouncer = createDebouncer();

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._debouncer.cancelAll();
  }

  private _model(): UrlModel { return getState().model; }

  private _pathPrefix(upToIndex: number): string {
    const segs = this._model().pathSegments.slice(0, upToIndex);
    return segs.length === 0 ? '/' : '/' + segs.join('/') + '/';
  }

  private _fetchSuggestions(index: number) {
    this._debouncer.schedule(index, async () => {
      const prefix = this._pathPrefix(index);
      const currentSeg = this._model().pathSegments[index] ?? '';
      const suggestions = await getHistorySuggestions(prefix, 'path-segment', hostname(this._model()), currentSeg);
      const updated = [...this._segmentSuggestions];
      while (updated.length <= index) updated.push([]);
      updated[index] = suggestions;
      this._segmentSuggestions = updated;
    });
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

  private _clearPath() {
    setState({ model: { ...this._model(), pathSegments: [] }, dirty: true });
  }

  // A trailing slash (empty last segment) is dropped, so the toggle acts on the segment before it.
  private _mdTarget(): string[] {
    const segs = this._model().pathSegments;
    return segs.at(-1) === '' ? segs.slice(0, -1) : segs;
  }

  private _toggleMd() {
    const segs = [...this._mdTarget()];
    const i = segs.length - 1;
    const s = segs[i] ?? '';
    segs[i] = s.endsWith('.md') ? s.slice(0, -3) : s + '.md';
    setState({ model: { ...this._model(), pathSegments: segs }, dirty: true });
  }

  private async _addSegment() {
    const m = this._model();
    setState({ model: { ...m, pathSegments: [...m.pathSegments, ''] }, dirty: true });
    await this.updateComplete;
    const inputs = this.querySelectorAll<HTMLInputElement>('input.path-seg');
    inputs[inputs.length - 1]?.focus();
  }

  private _stepLast(delta: number) {
    const m = this._model();
    const segs = [...m.pathSegments];
    segs[segs.length - 1] = String(Math.max(0, Number(segs[segs.length - 1]) + delta));
    setState({ model: { ...m, pathSegments: segs }, dirty: true });
  }

  override render() {
    return withPerf('path', () => this._renderContent());
  }

  private _renderContent() {
    const m = this._model();
    const last = this._mdTarget().at(-1);
    const hasMd = last?.endsWith('.md');
    const canAdd = !/\.\w+$/.test(m.pathSegments.at(-1) ?? '');

    return html`
      <div class="editor-header">
        / Path
        <span class="header-actions">
        ${last
          ? html`<button @click=${this._toggleMd} aria-label="${hasMd ? 'Detach' : 'Append'} .md ${hasMd ? 'from' : 'to'} last segment" class="btn-link">${hasMd ? 'Detach' : 'Append'} .md</button>`
          : ''}
        ${m.pathSegments.length > 0
          ? html`<button @click=${this._clearPath} aria-label="Clear path" class="btn-link">Clear</button>`
          : ''}
        </span>
      </div>
      <div class="path-list">
        ${m.pathSegments.map((seg, i) => {
          const listId = `path-editor-seg-${i}`;
          const suggestions = this._segmentSuggestions[i] ?? [];
          return html`
            <div class="path-row">
            <span class="mono chip-sep">/</span>
            <input
              id="path-editor-seg-input-${i}"
              class="mono path-seg"
              .value=${seg}
              list=${listId}
              @input=${(e: Event) => this._onSegmentInput(i, e)}
              @focus=${() => this._onSegmentFocus(i)}
              placeholder="segment"
              aria-label="Path segment ${i + 1}"
            />
            <datalist id=${listId}>
              ${suggestions.map((s) => html`<option value=${s.value}>${s.title}</option>`)}
            </datalist>
            ${i === m.pathSegments.length - 1 && /^\d+$/.test(seg)
              ? html`
                  <button @click=${() => this._stepLast(-1)} aria-label="Last segment -1">-1</button>
                  <button @click=${() => this._stepLast(1)} aria-label="Last segment +1">+1</button>
                `
              : ''}
            <button
              @click=${() => this._truncateBefore(i)}
              title="Truncate path before this segment"
              aria-label="Remove segment ${i + 1} and after"
              class="btn-muted"
            >×</button>
            </div>
          `;
        })}
        ${canAdd
          ? html`<div class="path-row"><span class="mono chip-sep">/</span><button
              @click=${this._addSegment} title="Add path segment" aria-label="Add path segment" class="seg-add">+</button></div>`
          : ''}
      </div>
    `;
  }
}
