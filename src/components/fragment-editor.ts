import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../utils/appState.ts';
import { serializeTextFragment, serializeMediaFragment, type TextFragment, type MediaFragment } from '../utils/fragmentCodec.ts';
import type { UrlModel } from '../utils/urlParser.ts';
import { saveDisabledTextFragments } from '../utils/pageStateStorage.ts';
import './fragment-editor.css';

function secondsToMmss(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function mmssToSeconds(value: string): number {
  const trimmed = value.trim();
  if (trimmed.includes(':')) {
    const [mPart, sPart] = trimmed.split(':');
    return parseInt(mPart ?? '0', 10) * 60 + parseFloat(sPart ?? '0');
  }
  return parseFloat(trimmed);
}

type TabName = 'text' | 'media';

@customElement('fragment-editor')
export class FragmentEditor extends LitElement {
  createRenderRoot() { return this; }

  @state() private _activeTab: TabName = 'text';
  private _unsub?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  private _model(): UrlModel { return getState().model; }
  private _disabled(): TextFragment[] { return getState().disabledTextFragments; }

  private _setModel(m: UrlModel) { setState({ model: m, dirty: true }); }
  private _setDisabled(frags: TextFragment[]) {
    setState({ disabledTextFragments: frags });
    saveDisabledTextFragments(this._model(), frags);
  }

  // ── Text fragment handlers ──

  private _updateTextFrag(index: number, updated: TextFragment) {
    const m = this._model();
    this._setModel({ ...m, textFragments: m.textFragments.map((f, i) => i === index ? updated : f) });
  }

  private _removeTextFrag(index: number) {
    const m = this._model();
    this._setModel({ ...m, textFragments: m.textFragments.filter((_, i) => i !== index) });
  }

  private _disableTextFrag(index: number) {
    const m = this._model();
    const frag = m.textFragments[index];
    if (!frag) return;
    this._setModel({ ...m, textFragments: m.textFragments.filter((_, i) => i !== index) });
    this._setDisabled([...this._disabled(), frag]);
  }

  private _enableTextFrag(index: number) {
    const frag = this._disabled()[index];
    if (!frag) return;
    this._setDisabled(this._disabled().filter((_, i) => i !== index));
    const m = this._model();
    this._setModel({ ...m, textFragments: [...m.textFragments, frag] });
  }

  private _removeDisabledTextFrag(index: number) {
    this._setDisabled(this._disabled().filter((_, i) => i !== index));
  }

  private _updateDisabledTextFrag(index: number, updated: TextFragment) {
    this._setDisabled(this._disabled().map((f, i) => i === index ? updated : f));
  }

  private _addText() {
    const m = this._model();
    this._setModel({ ...m, textFragments: [...m.textFragments, { textStart: '' }] });
    this._activeTab = 'text';
  }

  // ── Media fragment handlers ──

  private _updateMediaFrag(index: number, updated: MediaFragment) {
    const m = this._model();
    const withRaw = { ...updated, raw: serializeMediaFragment(updated) };
    this._setModel({ ...m, mediaFragments: m.mediaFragments.map((f, i) => i === index ? withRaw : f) });
  }

  private _removeMediaFrag(index: number) {
    const m = this._model();
    this._setModel({ ...m, mediaFragments: m.mediaFragments.filter((_, i) => i !== index) });
  }

  private _addTime() {
    const m = this._model();
    this._setModel({ ...m, mediaFragments: [...m.mediaFragments, { type: 'time', raw: 't=0', startTime: 0 }] });
    this._activeTab = 'media';
  }

  // ── Render helpers ──

  private _renderTextRow(frag: TextFragment, index: number, enabled: boolean) {
    const onToggle = enabled ? () => this._disableTextFrag(index) : () => this._enableTextFrag(index);
    const onRemove = enabled ? () => this._removeTextFrag(index) : () => this._removeDisabledTextFrag(index);
    const onUpdate = (updated: TextFragment) =>
      enabled ? this._updateTextFrag(index, updated) : this._updateDisabledTextFrag(index, updated);

    return html`
      <div class="frag-text-row" ?data-disabled=${!enabled}>
        <input type="checkbox" ?checked=${enabled} @change=${onToggle} />
        <input
          class="mono tf-prefix"
          .value=${frag.prefix ?? ''}
          @change=${(e: Event) => onUpdate({ ...frag, prefix: (e.target as HTMLInputElement).value || undefined })}
          placeholder="prefix"
          spellcheck="false"
          title="prefix"
        />
        <span class="chip-sep">-,</span>
        <input
          class="mono tf-start"
          .value=${frag.textStart}
          @change=${(e: Event) => onUpdate({ ...frag, textStart: (e.target as HTMLInputElement).value })}
          placeholder="text start"
          spellcheck="false"
          title="text start (required)"
        />
        <span class="chip-sep">,</span>
        <input
          class="mono tf-end"
          .value=${frag.textEnd ?? ''}
          @change=${(e: Event) => onUpdate({ ...frag, textEnd: (e.target as HTMLInputElement).value || undefined })}
          placeholder="end"
          spellcheck="false"
          title="text end (optional)"
        />
        <span class="chip-sep">,-</span>
        <input
          class="mono tf-suffix"
          .value=${frag.suffix ?? ''}
          @change=${(e: Event) => onUpdate({ ...frag, suffix: (e.target as HTMLInputElement).value || undefined })}
          placeholder="suffix"
          spellcheck="false"
          title="suffix"
        />
        <button @click=${onRemove} class="btn-muted">×</button>
        ${frag.textStart ? html`
          <span class="mono frag-preview">text=${serializeTextFragment(frag)}</span>
        ` : ''}
      </div>
    `;
  }

  private _renderMediaRow(frag: MediaFragment, index: number) {
    const onUpdate = (updated: MediaFragment) => this._updateMediaFrag(index, updated);
    const removeBtn = html`<button @click=${() => this._removeMediaFrag(index)} class="btn-muted">×</button>`;

    if (frag.type === 'time') {
      return html`
        <div class="frag-media-row">
          <span class="mono chip-sep">t=</span>
          <input
            class="mono mf-time"
            .value=${secondsToMmss(frag.startTime ?? 0)}
            @change=${(e: Event) => {
              const s = mmssToSeconds((e.target as HTMLInputElement).value);
              onUpdate({ ...frag, startTime: isNaN(s) ? 0 : s });
            }}
            placeholder="0:00"
            title="start time (mm:ss)"
          />
          <span class="chip-sep">,</span>
          <input
            class="mono mf-time"
            .value=${frag.endTime !== undefined ? secondsToMmss(frag.endTime) : ''}
            @change=${(e: Event) => {
              const val = (e.target as HTMLInputElement).value.trim();
              const s = val ? mmssToSeconds(val) : NaN;
              onUpdate({ ...frag, endTime: isNaN(s) ? undefined : s });
            }}
            placeholder="end"
            title="end time (mm:ss, optional)"
          />
          ${removeBtn}
        </div>
      `;
    }

    if (frag.type === 'spatial') {
      return html`
        <div class="frag-media-row-wrap">
          <span class="mono chip-sep">xywh=</span>
          ${(['x', 'y', 'width', 'height'] as const).map((field, fi) => html`
            ${fi > 0 ? html`<span class="chip-sep">,</span>` : ''}
            <span class="chip-sep">${field === 'width' ? 'w' : field === 'height' ? 'h' : field}:</span>
            <input
              class="mono mf-coord"
              type="number"
              .value=${String(frag[field] ?? 0)}
              @change=${(e: Event) => onUpdate({ ...frag, [field]: parseFloat((e.target as HTMLInputElement).value) || 0 })}
              title=${field}
            />
          `)}
          ${removeBtn}
        </div>
      `;
    }

    return html`
      <div class="frag-media-row">
        <span class="mono chip-sep">${frag.type}=</span>
        <input
          class="mono mf-value"
          .value=${frag.value ?? ''}
          @change=${(e: Event) => onUpdate({ ...frag, value: (e.target as HTMLInputElement).value })}
          placeholder="value"
          spellcheck="false"
        />
        ${removeBtn}
      </div>
    `;
  }

  render() {
    const m = this._model();
    const disabled = this._disabled();

    return html`
      <div class="editor-header"># Fragments</div>

      <div class="frag-tabs">
        <label>
          <input type="radio" name="frag-tab" value="text" ?checked=${this._activeTab === 'text'}
            @change=${() => { this._activeTab = 'text'; }} />
          Text${m.textFragments.length ? ` (${m.textFragments.length})` : ''}
        </label>
        <label>
          <input type="radio" name="frag-tab" value="media" ?checked=${this._activeTab === 'media'}
            @change=${() => { this._activeTab = 'media'; }} />
          Media${m.mediaFragments.length ? ` (${m.mediaFragments.length})` : ''}
        </label>
      </div>

      ${this._activeTab === 'text' ? html`
        ${m.textFragments.map((f, i) => this._renderTextRow(f, i, true))}
        ${disabled.map((f, i) => this._renderTextRow(f, i, false))}
        <button @click=${this._addText} class="btn-add">+ Add text fragment</button>
      ` : html`
        ${m.mediaFragments.map((f, i) => this._renderMediaRow(f, i))}
        <button @click=${this._addTime} class="btn-add-time">+ Add time fragment</button>
      `}
    `;
  }
}
