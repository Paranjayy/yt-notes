// Service worker — opens the dashboard tab when the toolbar icon is clicked
chrome.runtime.onInstalled.addListener(() => {
  console.log("Social Companion Extension installed successfully.");
});

// Open dashboard page on extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});
