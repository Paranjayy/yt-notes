/**
 * Cambridge Dictionary — Bulk Export Downloader
 *
 * Run this in the browser console on https://dictionary.cambridge.org/plus/wordlist
 * It fetches the official export for every wordlist and merges them into one CSV.
 *
 * Usage:
 *   1. Go to https://dictionary.cambridge.org/plus/wordlist (make sure you're logged in)
 *   2. Open console (Cmd+Option+J)
 *   3. Paste this entire script and press Enter
 *   4. Wait — it'll download a merged CSV when done
 */
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const abs = href => new URL(href, location.origin).href;

  console.log('%c╔══════════════════════════════════════════╗', 'color: #0d9488');
  console.log('%c║  Cambridge Dictionary — Bulk Exporter    ║', 'color: #0d9488; font-weight: bold');
  console.log('%c╚══════════════════════════════════════════╝', 'color: #0d9488');

  // ── Step 1: Collect all wordlist IDs from index pages ──
  console.log('\n📋 Step 1: Discovering all wordlists...');

  async function fetchIndex(url) {
    const r = await fetch(url, { credentials: 'include' });
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc;
  }

  const indexUrls = new Set([location.href]);
  document.querySelectorAll('a[href*="/plus/myWordlists"], a[href*="/plus/cambridgeWordlists"]').forEach(a => {
    if (a.href) indexUrls.add(abs(a.href));
  });
  indexUrls.add(abs('/plus/wordlist?type=personal'));
  indexUrls.add(abs('/plus/wordlist?type=cup'));
  indexUrls.add(abs('/plus/wordlist?type=community_default'));

  const allLists = [];
  for (const url of indexUrls) {
    try {
      const doc = url === location.href ? document : await fetchIndex(url);
      const rows = doc.querySelectorAll('li.wordlist-row');
      rows.forEach(row => {
        const a = row.querySelector('.wl-name a');
        const id = row.dataset.wordlistId || '';
        if (!id || allLists.some(l => l.id === id)) return;
        const name = clean(a?.textContent?.replace(/\(\d+\)/, '') || '');
        const countMatch = clean(a?.textContent || '').match(/\((\d+)\)/);
        const count = countMatch ? +countMatch[1] : 0;
        let type = 'unknown';
        if (row.classList.contains('sort-personal')) type = 'my';
        else if (row.classList.contains('sort-cup')) type = 'cambridge';
        else if (row.classList.contains('sort-community')) type = 'community';
        let level = clean(row.querySelector('.wl-mobile a')?.textContent || '');
        allLists.push({ id, name, count, type, level });
      });
      await sleep(100);
    } catch (e) {
      console.warn('Index failed:', url, e.message);
    }
  }

  console.log(`✅ Found ${allLists.length} wordlists`);
  console.table(allLists.map(l => ({ name: l.name, words: l.count, type: l.type, level: l.level || '—' })));

  // ── Step 2: Fetch each export page and parse words ──
  console.log(`\n📥 Step 2: Fetching exports for ${allLists.length} lists...`);

  const mergedRows = []; // CSV rows: word, pos, definition, list_name, list_type, list_level
  let successCount = 0;
  let totalWords = 0;

  for (let i = 0; i < allLists.length; i++) {
    const list = allLists[i];
    const exportUrl = abs(`/plus/wordlist/${list.id}/export`);

    try {
      process.stdout?.write(`  [${i + 1}/${allLists.length}] ${list.name}...`);
      const r = await fetch(exportUrl, { credentials: 'include' });
      const html = await r.text();

      // Parse the export HTML
      // The export page has entries like:
      //   <a href="/dictionary/english/WORD"><span class="phrase">WORD</span><span class="pos">POS</span></a>
      //   <div class="def">DEFINITION</div>
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const entries = doc.querySelectorAll('li');
      let wordCount = 0;

      entries.forEach(entry => {
        const phraseEl = entry.querySelector('.phrase, span.phrase');
        const word = clean(phraseEl?.textContent);
        if (!word) return;

        const posEl = entry.querySelector('.pos, span.pos');
        const pos = clean(posEl?.textContent);

        const defEl = entry.querySelector('.def, div.def');
        const definition = clean(defEl?.textContent);

        // Also try getting from the link text if def not found
        const definitionFinal = definition || '';

        mergedRows.push({
          word,
          pos,
          definition: definitionFinal,
          listName: list.name,
          listType: list.type,
          listLevel: list.level,
        });
        wordCount++;
      });

      totalWords += wordCount;
      successCount++;
      console.log(` ✓ ${wordCount} words`);

      // Save to storage too
      try {
        const storeKey = `cd_export_${list.id}`;
        const storeData = { name: list.name, type: list.type, level: list.level, words: [] };
        entries.forEach(entry => {
          const phraseEl = entry.querySelector('.phrase, span.phrase');
          const word = clean(phraseEl?.textContent);
          if (!word) return;
          const pos = clean(entry.querySelector('.pos, span.pos')?.textContent);
          const definition = clean(entry.querySelector('.def, div.def')?.textContent);
          storeData.words.push({ word, pos, definition });
        });
        chrome.storage.local.set({ [storeKey]: storeData });
      } catch (e) { /* storage quota, ignore */ }

      await sleep(300);
    } catch (e) {
      console.log(` ✗ ${e.message}`);
    }
  }

  // ── Step 3: Generate merged CSV ──
  console.log(`\n📊 Step 3: Generating merged CSV...`);
  console.log(`   ✅ ${successCount}/${allLists.length} lists exported`);
  console.log(`   📝 ${totalWords} total words`);

  const csvHeader = 'word,pos,definition,list_name,list_type,list_level';
  const csvRows = mergedRows.map(r =>
    [r.word, r.pos, `"${r.definition.replace(/"/g, '""')}"`, `"${r.listName}"`, r.listType, r.listLevel].join(',')
  );
  const csv = [csvHeader, ...csvRows].join('\n');

  // ── Step 4: Download ──
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cambridge-all-wordlists-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  console.log(`\n🎉 Done! Downloaded ${a.download}`);
  console.log(`   File size: ~${(blob.size / 1024).toFixed(1)} KB`);

  // Also save summary to window for easy access
  window.__cdExport = { mergedRows, allLists, csv };
  console.log(`\n💡 Access raw data: window.__cdExport.mergedRows`);
  console.log(`   Copy CSV: copy(window.__cdExport.csv)`);
})();
