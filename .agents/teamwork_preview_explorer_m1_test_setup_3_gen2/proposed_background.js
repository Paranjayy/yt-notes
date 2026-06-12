// Service worker for background messaging and lifecycle events.
chrome.runtime.onInstalled.addListener(() => {
  console.log("Goated Social Companion Extension installed successfully.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'YT_TIMEDTEXT_URL') {
    console.log("Background received YT_TIMEDTEXT_URL:", message.url);
    sendResponse({ status: 'ok' });
  } else if (message.type === 'DOWNLOAD_FILE') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
    return true; // async response
  } else if (message.type === 'CAPTURE_TAB') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, dataUrl });
      }
    });
    return true; // async response
  }
});
