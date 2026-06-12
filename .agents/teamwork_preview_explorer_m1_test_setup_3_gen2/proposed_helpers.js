/**
 * Social Companion & YT Note-Taker Helpers
 * Extracted pure utility functions to support unit testing in isolation.
 */

function formatTime(secs) {
  const totalCentiseconds = Math.round(secs * 100);
  const cs = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  const csStr = cs.toString().padStart(2, '0');
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${csStr}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}.${csStr}`;
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
