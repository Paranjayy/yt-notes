(function() {
  // 1. Intercept fetch for timedtext requests
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('youtube.com/api/timedtext')) {
      window.postMessage({ type: 'YT_TIMEDTEXT_URL', url: url }, '*');
    }
    return originalFetch.apply(this, args);
  };

  // 2. Intercept XMLHttpRequest for timedtext requests
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && url.includes('youtube.com/api/timedtext')) {
      window.postMessage({ type: 'YT_TIMEDTEXT_URL', url: url }, '*');
    }
    return originalOpen.apply(this, arguments);
  };

  // 3. Listen for requests from content script to query the player response
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === 'GET_YT_PLAYER_RESPONSE') {
      window.postMessage({
        type: 'YT_PLAYER_RESPONSE_DATA',
        playerResponse: window.ytInitialPlayerResponse
      }, '*');
    }
  });

  // 4. Hook page-level SPA navigation to automatically send updated playerResponse
  document.addEventListener('yt-navigate-finish', () => {
    setTimeout(() => {
      window.postMessage({
        type: 'YT_PLAYER_RESPONSE_DATA',
        playerResponse: window.ytInitialPlayerResponse
      }, '*');
    }, 500);
  });
})();
