export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.log('URLs extension installed');
    browser.contextMenus.create({
      id: 'add-highlight',
      title: 'Add to highlights',
      contexts: ['selection'],
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'add-highlight') return;
    const text = info.selectionText;
    if (!text || !tab?.id || !info.pageUrl) return;

    const newUrl = appendTextFragment(info.pageUrl, text);
    browser.tabs
      .sendMessage(tab.id, { type: 'ADD_HIGHLIGHT', text, url: newUrl })
      .catch(() => {});
  });
});

function appendTextFragment(pageUrl: string, text: string): string {
  const encoded = encodeURIComponent(text);
  const hashIdx = pageUrl.indexOf('#');

  if (hashIdx === -1) {
    return pageUrl + '#:~:text=' + encoded;
  }

  const hash = pageUrl.slice(hashIdx + 1);
  if (hash === '') {
    return pageUrl.slice(0, hashIdx) + '#:~:text=' + encoded;
  }
  if (hash.includes(':~:')) {
    return pageUrl + '&text=' + encoded;
  }
  // Has anchor but no text directive
  return pageUrl + ':~:text=' + encoded;
}
