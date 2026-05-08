export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.log('URLs extension installed');
  });
});
