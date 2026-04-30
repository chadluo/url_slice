import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getState, setState, subscribe } from '../state/appState.ts';
import { serializeTextFragment, serializeMediaFragment } from '../utils/fragmentParser.ts';
import type { UrlModel, TextFragment, MediaFragment } from '../utils/urlParser.ts';

function pageKey(m: UrlModel): string {
  const host = [...m.subdomains, m.domain].filter(Boolean).join('.');
  const path = m.pathSegments.length ? '/' + m.pathSegments.join('/') : '';
  return `${host}${path}`;
}

function saveDisabledTextFragments(m: UrlModel, frags: TextFragment[]) {
  const key = `disabledTextFragments:${pageKey(m)}`;
  if (frags.length > 0) {
    localStorage.setItem(key, JSON.stringify(frags));
  } else {
    localStorage.removeItem(key);
  }
}

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
  private _tabId(): number | null { return getState().tabId; }

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

  private _highlight(frag: TextFragment) {
    const tabId = this._tabId();
    if (tabId === null || !frag.textStart) return;
    browser.tabs.sendMessage(tabId, { type: 'HIGHLIGHT_TEXT', text: frag.textStart }).catch(() => {});
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
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:2px 0;opacity:${enabled ? '1' : '0.6'}">
        <input type="checkbox" ?checked=${enabled} @change=${onToggle} style="cursor:pointer;flex-shrink:0" />
        <input
          class="mono"
          .value=${frag.prefix ?? ''}
          @change=${(e: Event) => onUpdate({ ...frag, prefix: (e.target as HTMLInputElement).value || undefined })}
          style="width:6em"
          placeholder="prefix"
          spellcheck="false"
          title="prefix"
        />
        <span style="color:GrayText">-,</span>
        <input
          class="mono"
          .value=${frag.textStart}
          @change=${(e: Event) => onUpdate({ ...frag, textStart: (e.target as HTMLInputElement).value })}
          style="width:10em"
          placeholder="text start"
          spellcheck="false"
          title="text start (required)"
        />
        <span style="color:GrayText">,</span>
        <input
          class="mono"
          .value=${frag.textEnd ?? ''}
          @change=${(e: Event) => onUpdate({ ...frag, textEnd: (e.target as HTMLInputElement).value || undefined })}
          style="width:7em"
          placeholder="end"
          spellcheck="false"
          title="text end (optional)"
        />
        <span style="color:GrayText">,-</span>
        <input
          class="mono"
          .value=${frag.suffix ?? ''}
          @change=${(e: Event) => onUpdate({ ...frag, suffix: (e.target as HTMLInputElement).value || undefined })}
          style="width:6em"
          placeholder="suffix"
          spellcheck="false"
          title="suffix"
        />
        <button
          @click=${() => this._highlight(frag)}
          ?disabled=${this._tabId() === null || !frag.textStart}
          style="cursor:pointer"
          title="Highlight in page"
        >Highlight ▶</button>
        <button @click=${onRemove} style="cursor:pointer;background:none;border:none;color:GrayText">×</button>
        ${frag.textStart ? html`
          <span class="mono" style="color:GrayText;width:100%;padding-left:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            text=${serializeTextFragment(frag)}
          </span>
        ` : ''}
      </div>
    `;
  }

  private _renderMediaRow(frag: MediaFragment, index: number) {
    const onUpdate = (updated: MediaFragment) => this._updateMediaFrag(index, updated);
    const removeBtn = html`<button @click=${() => this._removeMediaFrag(index)} style="cursor:pointer;background:none;border:none;color:GrayText">×</button>`;

    if (frag.type === 'time') {
      return html`
        <div style="display:flex;align-items:center;gap:4px;margin:2px 0">
          <span class="mono" style="color:GrayText">t=</span>
          <input
            class="mono"
            .value=${secondsToMmss(frag.startTime ?? 0)}
            @change=${(e: Event) => {
              const s = mmssToSeconds((e.target as HTMLInputElement).value);
              onUpdate({ ...frag, startTime: isNaN(s) ? 0 : s });
            }}
            style="width:5em"
            placeholder="0:00"
            title="start time (mm:ss)"
          />
          <span style="color:GrayText">,</span>
          <input
            class="mono"
            .value=${frag.endTime !== undefined ? secondsToMmss(frag.endTime) : ''}
            @change=${(e: Event) => {
              const val = (e.target as HTMLInputElement).value.trim();
              const s = val ? mmssToSeconds(val) : NaN;
              onUpdate({ ...frag, endTime: isNaN(s) ? undefined : s });
            }}
            style="width:5em"
            placeholder="end"
            title="end time (mm:ss, optional)"
          />
          ${removeBtn}
        </div>
      `;
    }

    if (frag.type === 'spatial') {
      return html`
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:2px 0">
          <span class="mono" style="color:GrayText">xywh=</span>
          ${(['x', 'y', 'width', 'height'] as const).map((field, fi) => html`
            ${fi > 0 ? html`<span style="color:GrayText">,</span>` : ''}
            <span style="color:GrayText">${field === 'width' ? 'w' : field === 'height' ? 'h' : field}:</span>
            <input
              class="mono"
              type="number"
              .value=${String(frag[field] ?? 0)}
              @change=${(e: Event) => onUpdate({ ...frag, [field]: parseFloat((e.target as HTMLInputElement).value) || 0 })}
              style="width:4em"
              title=${field}
            />
          `)}
          ${removeBtn}
        </div>
      `;
    }

    return html`
      <div style="display:flex;align-items:center;gap:4px;margin:2px 0">
        <span class="mono" style="color:GrayText">${frag.type}=</span>
        <input
          class="mono"
          .value=${frag.value ?? ''}
          @change=${(e: Event) => onUpdate({ ...frag, value: (e.target as HTMLInputElement).value })}
          style="width:12em"
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

    const tabStyle = (tab: TabName) =>
      `cursor:pointer;background:none;border:none;border-bottom:2px solid ${this._activeTab === tab ? 'AccentColor' : 'transparent'};padding:4px 8px;color:${this._activeTab === tab ? 'AccentColor' : 'GrayText'}`;

    return html`
      <div style="margin-bottom:4px">
        <span class="mono" style="color:GrayText">#</span>
        <span style="color:GrayText;font-weight:500">Fragments</span>
      </div>

      <div style="display:flex;gap:0;border-bottom:1px solid GrayText;margin-bottom:8px">
        <button style=${tabStyle('text')} @click=${() => { this._activeTab = 'text'; }}>
          Text${m.textFragments.length ? ` (${m.textFragments.length})` : ''}
        </button>
        <button style=${tabStyle('media')} @click=${() => { this._activeTab = 'media'; }}>
          Media${m.mediaFragments.length ? ` (${m.mediaFragments.length})` : ''}
        </button>
      </div>

      ${this._activeTab === 'text' ? html`
        ${m.textFragments.map((f, i) => this._renderTextRow(f, i, true))}
        ${disabled.map((f, i) => this._renderTextRow(f, i, false))}
        <button @click=${this._addText} class="btn-add">+ Add text fragment</button>
      ` : html`
        ${m.mediaFragments.map((f, i) => this._renderMediaRow(f, i))}
        <button @click=${this._addTime} style="cursor:pointer;background:none;border:none;color:LinkText;margin-top:4px">+ Add time fragment</button>
      `}
    `;
  }
}
