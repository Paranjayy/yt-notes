// Service worker — opens the dashboard tab when the toolbar icon is clicked
chrome.runtime.onInstalled.addListener(() => {
  console.log("Social Companion Extension installed successfully.");
});

// Open dashboard page on extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// Tab-scrape: open a URL in a new tab, inject scraper, return results
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "cd_scrape_tab") {
    (async () => {
      try {
        const tab = await chrome.tabs.create({ url: msg.url, active: false });
        // Wait for tab to finish loading
        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("tab load timeout")),
            20000,
          );
          const listener = (tabId, info) => {
            if (tabId === tab.id && info.status === "complete") {
              clearTimeout(timer);
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });

        // Small extra wait for AMP rendering
        await new Promise((r) => setTimeout(r, 2000));

        // Inject scraper into the tab
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const words = [];
            const seen = new Set();
            document
              .querySelectorAll("li.wordlistentry-row")
              .forEach((entry) => {
                const id = entry.dataset.wordId || "";
                const phraseEl = entry.querySelector("a .phrase");
                const word = (phraseEl?.textContent || "")
                  .replace(/\s+/g, " ")
                  .trim();
                if (!word) return;
                const pos = (
                  entry.querySelector("a .pos")?.textContent || ""
                ).trim();
                const gcSpans = entry.querySelectorAll("a .gram .gc");
                const grammar =
                  gcSpans.length === 1
                    ? gcSpans[0].textContent.trim()
                    : gcSpans.length > 1
                      ? [...gcSpans]
                          .map((s) => s.textContent.trim())
                          .join(" or ")
                      : "";
                const usage = [...entry.querySelectorAll("a .usage, a .dusage")]
                  .map((e) => e.textContent.trim())
                  .filter(Boolean)
                  .join(", ");
                const domain = [
                  ...entry.querySelectorAll("a .domain, a .ddomain"),
                ]
                  .map((e) => e.textContent.trim())
                  .filter(Boolean)
                  .join(", ");
                const cefr = (
                  entry.querySelector("a .epp-xref, a .dxref")?.textContent ||
                  ""
                ).trim();
                const definition = (
                  entry.querySelector(".def")?.textContent || ""
                ).trim();
                const dictionary = (
                  entry.querySelector(".h6, .lm-0")?.textContent || ""
                ).trim();
                const key = id + "-" + word;
                if (seen.has(key)) return;
                seen.add(key);
                words.push({
                  word,
                  pos,
                  grammar,
                  usage,
                  domain,
                  cefr,
                  definition,
                  dictionary,
                  id,
                });
              });
            return words;
          },
        });

        // Close the tab
        await chrome.tabs.remove(tab.id);

        sendResponse({ words: results?.[0]?.result || [] });
      } catch (e) {
        sendResponse({ words: [], error: e.message });
      }
    })();
    return true; // async sendResponse
  }
});
