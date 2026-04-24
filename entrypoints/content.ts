export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    browser.runtime.onMessage.addListener(
      (message: unknown, _sender, _sendResponse) => {
        if (!message || typeof message !== 'object') return;
        const msg = message as Record<string, unknown>;

        if (msg.type === 'HIGHLIGHT_TEXT' && typeof msg.text === 'string') {
          highlightText(msg.text);
          return;
        }

        if (
          msg.type === 'ADD_HIGHLIGHT' &&
          typeof msg.text === 'string' &&
          typeof msg.url === 'string'
        ) {
          history.replaceState(null, '', msg.url);
          highlightText(msg.text);
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

function highlightText(text: string): void {
  if (!text) return;

  // Try CSS Custom Highlight API first
  if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
    try {
      const ranges = findTextRanges(text);
      if (ranges.length > 0) {
        const highlight = new Highlight(...ranges);
        CSS.highlights.set('wxt-highlight', highlight);
        // Scroll first match into view
        const firstRange = ranges[0];
        if (firstRange) {
          const node = firstRange.startContainer;
          const el =
            node.nodeType === Node.ELEMENT_NODE
              ? (node as Element)
              : node.parentElement;
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
    } catch {
      // fall through to window.find
    }
  }

  // Fallback: window.find (non-standard but widely supported)
  const win = window as Window & { find?: (...args: unknown[]) => boolean };
  if (typeof win.find === 'function') {
    win.find(text, false, false, true, false, false, false);
  }
}

function findTextRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
  );
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const content = node.textContent ?? '';
    let pos = 0;
    while (true) {
      const idx = content.toLowerCase().indexOf(text.toLowerCase(), pos);
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
  if (video) {
    video.currentTime = time;
  }
}
