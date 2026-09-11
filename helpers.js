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

/**
 * Strip noise from a cloned DOM root for AI snapshots.
 * - "low": faithful clean — drops scripts/styles/iframes, empties SVGs and
 *   inline images, trims vendor/telemetry attributes. Keeps classes/ids.
 * - "high": aggressive clean for extension-building — everything low does,
 *   PLUS drops ALL class attributes (X's r-xxx / Spotify's hashed tokens
 *   are ~70% of snapshot bytes), generated ids (id__*), and dangling
 *   aria-labelledby/describedby refs. Keeps the parser anchors:
 *   data-testid, role, aria-label, href, datetime, dir, alt, title, content.
 * Operates on a detached clone; DOM-only so it runs under jsdom tests.
 * Returns { removedElements, removedAttrs } counts for receipts.
 */
function stripDomNoise(root, mode = 'low') {
  const counts = { removedElements: 0, removedAttrs: 0 };
  if (!root || !root.querySelectorAll) return counts;
  const drop = (sel) => {
    const els = root.querySelectorAll(sel);
    els.forEach((el) => {
      el.remove();
      counts.removedElements++;
    });
  };
  drop("script, style, link[rel='stylesheet'], noscript, iframe, template");
  root.querySelectorAll("svg").forEach((svg) => {
    svg.innerHTML = "<!-- [SVG CONTENT STRIPPED] -->";
  });
  const all = [root, ...root.querySelectorAll("*")];
  all.forEach((el) => {
    if (el.tagName === "IMG") {
      if (el.src && String(el.src).startsWith("data:")) {
        el.removeAttribute("src");
        counts.removedAttrs++;
      }
      if (el.srcset) {
        el.removeAttribute("srcset");
        counts.removedAttrs++;
      }
    }
    if (el.hasAttribute("style")) {
      const style = el.getAttribute("style");
      if (style && style.length > 120) {
        el.removeAttribute("style");
        counts.removedAttrs++;
      }
    }
    Array.from(el.attributes).forEach((attr) => {
      const n = attr.name;
      if (
        n.startsWith("data-sc-") || n.startsWith("__react") ||
        n.startsWith("data-google-") || n.startsWith("data-analytics-")
      ) {
        el.removeAttribute(n);
        counts.removedAttrs++;
      }
    });
    if (mode === "high") {
      if (el.hasAttribute("class")) {
        el.removeAttribute("class");
        counts.removedAttrs++;
      }
      const id = el.getAttribute("id");
      if (id && /^id__/.test(id)) {
        el.removeAttribute("id");
        counts.removedAttrs++;
      }
      for (const ref of ["aria-labelledby", "aria-describedby"]) {
        if (el.hasAttribute(ref)) {
          el.removeAttribute(ref);
          counts.removedAttrs++;
        }
      }
    }
  });
  return counts;
}

// Export for Node.js testing environment (Vitest / CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatTime,
    escapeHtml,
    decodeHtmlEntities,
    stripDomNoise
  };
} else {
  // Expose to the content script context when running in the browser
  window.formatTime = formatTime;
  window.escapeHtml = escapeHtml;
  window.decodeHtmlEntities = decodeHtmlEntities;
  window.stripDomNoise = stripDomNoise;
}
