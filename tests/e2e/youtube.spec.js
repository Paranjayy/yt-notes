const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const { mockYouTubePage } = require('./helpers/mock-pages.js');

test.describe('YouTube Extension E2E Suite', () => {
  let context;
  let page;

  test.beforeEach(async () => {
    // Point to the root directory where manifest.json and content.js reside
    const pathToExtension = path.resolve(__dirname, '../../');

    // Launch Chromium with the Chrome Extension loaded
    context = await chromium.launchPersistentContext('', {
      headless: false, // Must be false to load unpacked extension
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    page = await context.newPage();
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('should inject the widget and extract video metadata', async () => {
    // Mock the youtube page
    await mockYouTubePage(page, {
      title: 'Learn Vitest in 15 Minutes',
      channel: 'Coding Academy',
      views: '5,000 views',
    });

    // Navigate to the video page (the mock will handle this URL)
    await page.goto('https://www.youtube.com/watch?v=vitest123');

    // Verify that the widget is injected into the DOM
    const widget = page.locator('#sc-youtube-widget');
    await expect(widget).toBeVisible({ timeout: 10000 });

    // Verify metadata was scraped correctly by checking the generated Markdown structure in the export panel
    // Go to Export Tab
    await page.click('.sc-tab[data-tab="export"]');

    // Wait for the markdown preview element to be populated
    const exportPreview = page.locator('#sc-export-preview');
    await expect(exportPreview).toBeVisible();
    
    const markdownContent = await exportPreview.innerText();
    expect(markdownContent).toContain('Title: Learn Vitest in 15 Minutes');
    expect(markdownContent).toContain('Channel: Coding Academy');
    expect(markdownContent).toContain('Views: 5,000 views');
  });

  test('should support note-taking workflow (create, edit, delete, and search)', async () => {
    await mockYouTubePage(page, {
      title: 'Note Taking Test Video',
    });

    await page.goto('https://www.youtube.com/watch?v=note123');

    // Ensure widget is injected
    await expect(page.locator('#sc-youtube-widget')).toBeVisible();

    // 1. Add a note
    const noteInput = page.locator('#sc-note-input');
    await noteInput.fill('This is an important concept at 5 seconds.');
    
    // Simulate setting video current time (e.g. 5s)
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.currentTime = 5.0;
    });

    await page.click('#sc-btn-add-note');

    // Verify note is rendered in the list
    const noteItem = page.locator('.sc-note-item').first();
    await expect(noteItem).toBeVisible();
    await expect(noteItem.locator('.sc-note-timestamp')).toHaveText('0:05.00');
    await expect(noteItem.locator('.sc-note-text')).toHaveText('This is an important concept at 5 seconds.');

    // 2. Edit the note
    await noteItem.locator('.sc-edit').click();
    const editTextArea = page.locator('[id^="sc-edit-textarea-"]');
    await expect(editTextArea).toBeVisible();
    await editTextArea.fill('This is an updated concept.');
    await page.locator('.sc-note-actions button:has-text("Save")').click();

    // Verify note text is updated
    await expect(noteItem.locator('.sc-note-text')).toHaveText('This is an updated concept.');

    // 3. Search notes
    const notesSearch = page.locator('#sc-notes-search');
    await notesSearch.fill('nonexistent term');
    await expect(page.locator('.sc-note-item')).toHaveCount(0); // Filters out the note
    
    await notesSearch.fill('updated concept');
    await expect(page.locator('.sc-note-item')).toHaveCount(1); // Matches the note again

    // 4. Delete the note
    await noteItem.locator('.sc-delete').click();
    await expect(page.locator('.sc-note-item')).toHaveCount(0);
  });

  test('should capture and download video screenshot', async () => {
    await mockYouTubePage(page, {
      title: 'Screenshot Test Video',
    });

    await page.goto('https://www.youtube.com/watch?v=screenshot123');
    await expect(page.locator('#sc-youtube-widget')).toBeVisible();

    // Verify video is loaded and ready
    const video = page.locator('video');
    await expect(video).toBeVisible();

    // Capture the click-triggered download event in Playwright
    const downloadPromise = page.waitForEvent('download');
    await page.click('#sc-btn-ss');
    const download = await downloadPromise;

    // Check that a file is successfully generated and downloaded
    expect(download.suggestedFilename()).toContain('screenshot_screenshot_test_video');
    
    // Verify it added the screenshot to the row list
    await expect(page.locator('#sc-screenshots-row img')).toHaveCount(1);
  });

  test('should detect playlist metadata', async () => {
    const playlistId = 'PLabc123';
    await mockYouTubePage(page, {
      title: 'Playlist Video 1',
      playlistId,
      playlistTitle: 'Vitest Mastery',
      playlistIndex: '3',
    });

    // Load URL containing list parameter
    await page.goto(`https://www.youtube.com/watch?v=video123&list=${playlistId}&index=3`);
    await expect(page.locator('#sc-youtube-widget')).toBeVisible();

    // Go to Export Tab
    await page.click('.sc-tab[data-tab="export"]');
    
    const exportPreview = page.locator('#sc-export-preview');
    await expect(exportPreview).toBeVisible();
    
    const markdownContent = await exportPreview.innerText();
    expect(markdownContent).toContain('Playlist: Vitest Mastery');
    expect(markdownContent).toContain('Playlist URL: https://www.youtube.com/playlist?list=PLabc123');
    expect(markdownContent).toContain('Playlist Index: 3');
  });

  test('should load transcript via script tag parsing', async () => {
    await mockYouTubePage(page, {
      title: 'Transcript Parsing Video',
      hasTranscript: true,
    });

    await page.goto('https://www.youtube.com/watch?v=transcript123');
    await expect(page.locator('#sc-youtube-widget')).toBeVisible();

    // Switch to Transcript Tab
    await page.click('.sc-tab[data-tab="transcript"]');
    // Wait for the transcript box to load lines
    const transcriptBox = page.locator('#sc-transcript-box');
    await expect(transcriptBox.locator('.sc-transcript-line')).toHaveCount(3);

    // Verify text contents of transcript segments
    await expect(transcriptBox.locator('.sc-transcript-line').first()).toContainText('Hello, and welcome back to the channel.');
    
    // Test search inside transcript
    const transSearch = page.locator('#sc-transcript-search');
    await transSearch.fill('analyzing');
    await expect(transcriptBox.locator('.sc-transcript-line')).toHaveCount(1);
    await expect(transcriptBox.locator('.sc-transcript-line')).toContainText('Today, we are analyzing');
  });
});
