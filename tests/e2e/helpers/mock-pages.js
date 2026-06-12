/**
 * E2E Page Mocking Helpers for Playwright
 * Setup routes to intercept requests to YouTube, X, and Reddit,
 * returning minimal HTML containing the exact selectors targeted by the content script.
 */

async function mockYouTubePage(page, options = {}) {
  const {
    title = 'Test Video Title',
    channel = 'Tech Explored',
    subscribers = '100K subscribers',
    views = '1,234 views',
    description = 'This is a description of the video. It is awesome.',
    commentsCount = '5 comments',
    playlistId = null,
    playlistTitle = 'My Playlist',
    playlistIndex = '1',
    hasTranscript = true,
  } = options;

  const urlPattern = playlistId
    ? `https://www.youtube.com/watch?v=*&list=${playlistId}*`
    : 'https://www.youtube.com/watch?v=*';

  await page.route(urlPattern, async (route) => {
    // Determine video ID
    const url = new URL(route.request().url());
    const videoId = url.searchParams.get('v') || 'default_id';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - YouTube</title>
      </head>
      <body>
        <!-- Video Player -->
        <video id="movie_player" width="640" height="360" controls src="https://www.w3schools.com/html/mov_bbb.mp4"></video>

        <!-- Progress Bar (for timeline markers) -->
        <div class="ytp-progress-bar" style="position:relative; width: 640px; height: 10px; background: #ccc;"></div>

        <!-- Sidebar / Insertion Target for Social Companion Widget -->
        <div id="secondary">
          <div id="secondary-inner"></div>
        </div>

        <!-- Video Metadata -->
        <h1 class="ytd-watch-metadata">
          <yt-formatted-string>${title}</yt-formatted-string>
        </h1>

        <ytd-video-owner-renderer>
          <div id="channel-name">
            <a href="/@techexplored">${channel}</a>
          </div>
          <span id="owner-sub-count">${subscribers}</span>
        </ytd-video-owner-renderer>

        <ytd-watch-info-text>
          <div id="info">
            <span>${views}</span>
          </div>
        </ytd-watch-info-text>

        <div id="description-inline-expander">
          <span>${description}</span>
        </div>

        <!-- Comments -->
        <ytd-comments>
          <div id="title">${commentsCount}</div>
          <ytd-comment-thread-renderer>
            <div id="author-text"><span>User One</span></div>
            <div id="content-text">Incredible video! Thanks for sharing.</div>
            <span id="vote-count-middle">12</span>
            <div id="author-thumbnail"><img src="https://placehold.co/40x40" /></div>
          </ytd-comment-thread-renderer>
          <ytd-comment-thread-renderer>
            <div id="author-text"><span>User Two</span></div>
            <div id="content-text">This was extremely helpful.</div>
            <span id="vote-count-middle">3</span>
            <div id="author-thumbnail"><img src="https://placehold.co/40x40" /></div>
          </ytd-comment-thread-renderer>
        </ytd-comments>

        <!-- Recommendations -->
        <ytd-compact-video-renderer>
          <span id="video-title">Recommended Video 1</span>
          <ytd-channel-name>
            <yt-formatted-string id="text">Other Channel</yt-formatted-string>
          </ytd-channel-name>
          <div id="metadata-line"><span>50K views</span></div>
          <a id="thumbnail" href="/watch?v=rec1"></a>
          <img src="https://placehold.co/120x90" />
        </ytd-compact-video-renderer>

        <!-- Playlist Panel (if playlistId is present) -->
        ${playlistId ? `
          <ytd-playlist-panel-renderer>
            <div id="title-container">
              <span id="title">${playlistTitle}</span>
            </div>
          </ytd-playlist-panel-renderer>
        ` : ''}

        <!-- Show Transcript Button fallback -->
        <ytd-video-description-transcript-section-renderer>
          <button>Show transcript</button>
        </ytd-video-description-transcript-section-renderer>

        <!-- Mock ytInitialPlayerResponse script tag -->
        <script>
          window.ytInitialPlayerResponse = ${JSON.stringify({
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    languageCode: 'en',
                    baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`
                  }
                ]
              }
            }
          })};
        </script>
      </body>
      </html>
    `;

    await route.fulfill({
      contentType: 'text/html',
      body: html,
    });
  });

  // Mock the Transcript API response if transcript has been enabled
  if (hasTranscript) {
    await page.route('https://www.youtube.com/api/timedtext*', async (route) => {
      const xml = `
        <?xml version="1.0" encoding="utf-8" ?>
        <transcript>
          <text start="0.00" dur="2.50">Hello, and welcome back to the channel.</text>
          <text start="2.50" dur="3.00">Today, we are analyzing the new Social Companion extension.</text>
          <text start="5.50" dur="4.20">It allows taking timestamped notes directly inside YouTube.</text>
        </transcript>
      `;
      await route.fulfill({
        contentType: 'text/xml',
        body: xml.trim(),
      });
    });
  }
}

async function mockXPage(page, options = {}) {
  const {
    author = 'Jane Doe',
    text = 'Just launched the Social Companion extension! It is fully goated. 🚀 #webdev #browser-ext',
    replies = '45',
    retweets = '12',
    likes = '350',
  } = options;

  await page.route('https://x.com/*/status/*', async (route) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${author} on X</title>
      </head>
      <body>
        <div data-testid="User-Name">
          <span>${author}</span>
        </div>
        <div data-testid="tweetText">
          ${text}
        </div>
        <div style="display:flex;">
          <span data-testid="reply">${replies}</span>
          <span data-testid="retweet">${retweets}</span>
          <span data-testid="like">${likes}</span>
        </div>
        
        <!-- Hashtags -->
        <a href="/hashtag/webdev">#webdev</a>
        <a href="/hashtag/browser-ext">#browser-ext</a>
      </body>
      </html>
    `;
    await route.fulfill({
      contentType: 'text/html',
      body: html,
    });
  });
}

async function mockRedditPage(page, options = {}) {
  const {
    title = 'Social Companion is awesome for taking study notes',
    author = 'redditor_prime',
    text = 'I have been using this tool to capture screenshots and notes from lectures. Highly recommend exporting as Markdown!',
  } = options;

  await page.route('https://www.reddit.com/r/**/comments/**', async (route) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
      </head>
      <body>
        <shreddit-title title="${title}"></shreddit-title>
        
        <div class="author-info">
          <a href="/user/${author}/">${author}</a>
        </div>

        <div id="test-post-rtjson-content">
          <p>${text}</p>
        </div>
      </body>
      </html>
    `;
    await route.fulfill({
      contentType: 'text/html',
      body: html,
    });
  });
}

module.exports = {
  mockYouTubePage,
  mockXPage,
  mockRedditPage,
};
