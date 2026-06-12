/**
 * Social Companion & YT Note-Taker Helpers
 * Extracted pure utility functions to support unit testing in isolation.
 */

function formatTime(secs) {
  if (!secs && secs !== 0) return '0:00';
  const total = Math.floor(secs);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function decodeHtmlEntities(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

// Export for Node.js testing environment (Vitest / CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatTime,
    escapeHtml,
    decodeHtmlEntities
  };
} else {
  // Expose to the content script context when running in the browser
  window.formatTime = formatTime;
  window.escapeHtml = escapeHtml;
  window.decodeHtmlEntities = decodeHtmlEntities;
}
