import '../../components/url-slice-app.ts';
import '../../assets/style.css';
import { getState } from '../../utils/appState.ts';
import { savePendingState } from '../../utils/pageStateStorage.ts';

if (!new URLSearchParams(location.search).has('detached')) {
  window.addEventListener('blur', () => {
    const state = getState();
    if (!state.dirty) return;
    savePendingState(state);
    browser.windows.create({
      url: browser.runtime.getURL('/popup.html') + '?detached',
      type: 'popup',
      width: 400,
      height: 600,
    }).catch(() => {});
  });
}
