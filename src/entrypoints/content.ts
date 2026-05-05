import { parseAllFragments } from '../utils/fragmentCodec.ts';

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    browser.runtime.onMessage.addListener(
      (message: unknown, _sender, _sendResponse) => {
        if (!message || typeof message !== 'object') return;
        const msg = message as Record<string, unknown>;

        if (msg.type === 'UPDATE_URL' && typeof msg.url === 'string') {
          history.replaceState(null, '', msg.url);
          highlightAll(textFragmentsFromUrl(msg.url));
          return;
        }

        if (msg.type === 'HIGHLIGHT_ALL' && Array.isArray(msg.texts)) {
          highlightAll(msg.texts as string[]);
          return;
        }

        if (
          msg.type === 'JUMP_TO_FRAGMENT' &&
          Array.isArray(msg.texts) &&
          typeof msg.scrollTo === 'string'
        ) {
          highlightAll(msg.texts as string[]);
          scrollToText(msg.scrollTo);
          return;
        }

        if (msg.type === 'SEEK_VIDEO' && typeof msg.time === 'number') {
          seekVideo(msg.time);
          return;
        }
      },
    );
  },
});

function textFragmentsFromUrl(url: string): string[] {
  try {
    const hash = new URL(url).hash;
    return parseAllFragments(hash).textFragments.map(f => f.textStart).filter(Boolean);
  } catch {
    return [];
  }
}

function ensureHighlightStyle(): void {
  if (document.getElementById('url-slice-highlight-style')) return;
  const style = document.createElement('style');
  style.id = 'url-slice-highlight-style';
  style.textContent = '::highlight(url-slice-highlight) { background-color: Mark; color: MarkText; }';
  document.head.appendChild(style);
}

function highlightAll(texts: string[]): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
  const active = texts.filter(Boolean);
  if (active.length === 0) {
    CSS.highlights.delete('url-slice-highlight');
    return;
  }
  ensureHighlightStyle();
  const ranges: Range[] = active.flatMap(findTextRanges);
  if (ranges.length === 0) {
    CSS.highlights.delete('url-slice-highlight');
    return;
  }
  CSS.highlights.set('url-slice-highlight', new Highlight(...ranges));
}

function scrollToText(text: string): void {
  const ranges = findTextRanges(text);
  if (ranges.length === 0) return;
  const node = ranges[0]!.startContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function findTextRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const content = node.textContent ?? '';
    const lower = content.toLowerCase();
    const target = text.toLowerCase();
    let pos = 0;
    while (true) {
      const idx = lower.indexOf(target, pos);
      if (idx === -1) break;
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + text.length);
      ranges.push(range);
      pos = idx + 1;
    }
  }
  return ranges;
}

function seekVideo(time: number): void {
  const video = document.querySelector('video');
  if (video) video.currentTime = time;
}
