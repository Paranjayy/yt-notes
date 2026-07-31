const YT_ORIGINS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be']);
const USER_AGENT = 'Mozilla/5.0 (compatible; SocialCompanionArchive/1.0; +https://yt-notes-paranjayy-paranjay245s-projects.vercel.app/)';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function youtubeTarget(raw) {
  const url = new URL(String(raw || ''));
  if (!YT_ORIGINS.has(url.hostname)) throw new Error('Use a public YouTube playlist or video URL.');
  const parts = url.pathname.split('/').filter(Boolean);
  const videoId = url.hostname === 'youtu.be' ? parts[0] : url.searchParams.get('v') || (['shorts', 'live', 'embed'].includes(parts[0]) ? parts[1] : '');
  return { playlistId: url.searchParams.get('list') || '', videoId: videoId || '' };
}

async function youtubeFetch(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!response.ok) throw new Error(`YouTube returned ${response.status}. Try again later or use your own API key.`);
  return response.text();
}

function innertubeConfig(source) {
  const apiKey = source.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] || '';
  const clientVersion = source.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] || '';
  return apiKey && clientVersion ? { apiKey, clientVersion } : null;
}

function extractJsonAfter(source, marker) {
  const startAt = source.indexOf(marker);
  if (startAt < 0) return null;
  const objectStart = source.indexOf('{', startAt + marker.length);
  if (objectStart < 0) return null;
  let quote = false, escape = false, depth = 0;
  for (let index = objectStart; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') quote = false;
      continue;
    }
    if (char === '"') quote = true;
    else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(source.slice(objectStart, index + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function text(value) {
  if (!value) return '';
  if (typeof value.simpleText === 'string') return value.simpleText;
  return Array.isArray(value.runs) ? value.runs.map((run) => run.text || '').join('') : '';
}

function walk(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  Object.values(node).forEach((value) => {
    if (Array.isArray(value)) value.forEach((child) => walk(child, callback));
    else if (value && typeof value === 'object') walk(value, callback);
  });
}

function itemsFromInitialData(data) {
  const byId = new Map();
  walk(data, (node) => {
    const renderer = node.playlistVideoRenderer;
    if (!renderer?.videoId || byId.has(renderer.videoId)) return;
    byId.set(renderer.videoId, {
      videoId: renderer.videoId,
      title: text(renderer.title) || 'Untitled video',
      channel: text(renderer.shortBylineText) || text(renderer.longBylineText),
      duration: text(renderer.lengthText),
      thumbnail: renderer.thumbnail?.thumbnails?.at(-1)?.url || '',
      unavailable: false,
    });
  });
  return [...byId.values()].map((item, index) => ({ ...item, position: index + 1, url: `https://www.youtube.com/watch?v=${item.videoId}` }));
}

function playlistTitleFromInitialData(data) {
  let title = '';
  walk(data, (node) => {
    if (!title && node.playlistMetadataRenderer?.title) title = node.playlistMetadataRenderer.title;
  });
  return title;
}

function durationLabel(isoDuration) {
  const parts = String(isoDuration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!parts) return '';
  const hours = Number(parts[1] || 0), minutes = Number(parts[2] || 0), seconds = Number(parts[3] || 0);
  return [hours, String(minutes).padStart(hours ? 2 : 1, '0'), String(seconds).padStart(2, '0')].filter((part, index) => index || hours || minutes).join(':') || `0:${String(seconds).padStart(2, '0')}`;
}

async function enrichApiVideoMetadata(items, apiKey) {
  for (let index = 0; index < items.length; index += 50) {
    const batch = items.slice(index, index + 50).filter((item) => !item.unavailable);
    if (!batch.length) continue;
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,contentDetails,statistics');
    url.searchParams.set('id', batch.map((item) => item.videoId).join(','));
    url.searchParams.set('key', apiKey);
    const response = await fetch(url);
    if (!response.ok) continue;
    const data = await response.json();
    const byId = new Map((data.items || []).map((video) => [video.id, video]));
    batch.forEach((item) => {
      const video = byId.get(item.videoId);
      if (!video) return;
      item.duration = durationLabel(video.contentDetails?.duration);
      item.title = video.snippet?.title || item.title;
      item.channel = video.snippet?.channelTitle || item.channel;
      item.thumbnail = video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || item.thumbnail;
      item.description = video.snippet?.description || '';
      item.publishedAt = video.snippet?.publishedAt || '';
      item.views = video.statistics?.viewCount || '';
      item.likes = video.statistics?.likeCount || '';
      item.commentCount = video.statistics?.commentCount || '';
    });
  }
}

async function playlistFromApi(playlistId, apiKey) {
  const items = [], seen = new Set();
  let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails,status');
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`YouTube Data API returned ${response.status}. Check the key and quota.`);
    const data = await response.json();
    (data.items || []).forEach((entry) => {
      const videoId = entry.contentDetails?.videoId || '';
      if (!videoId || seen.has(videoId)) return;
      seen.add(videoId);
      const snippet = entry.snippet || {};
      items.push({ position: items.length + 1, videoId, title: snippet.title || 'Unavailable video', channel: snippet.videoOwnerChannelTitle || snippet.channelTitle || '', duration: '', url: `https://www.youtube.com/watch?v=${videoId}`, thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '', unavailable: snippet.title === 'Private video' || snippet.title === 'Deleted video' });
    });
    pageToken = data.nextPageToken || '';
  } while (pageToken && items.length < 500);
  if (!items.length) throw new Error('No videos were returned for that playlist.');
  await enrichApiVideoMetadata(items, apiKey);
  return items;
}

async function playlistFromPublicBrowse(playlistId, page) {
  const config = innertubeConfig(page);
  if (!config) return { items: [], title: '' };
  const response = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: config.clientVersion } }, browseId: playlistId }),
  });
  if (!response.ok) return { items: [], title: '' };
  const data = await response.json();
  return { items: itemsFromInitialData(data), title: playlistTitleFromInitialData(data) };
}

async function collectPlaylist({ url, apiKey }) {
  const { playlistId } = youtubeTarget(url);
  if (!playlistId) throw new Error('Paste a YouTube playlist URL containing ?list=.');
  let items, title = `YouTube playlist ${playlistId}`;
  if (apiKey) items = await playlistFromApi(playlistId, apiKey);
  else {
    const page = await youtubeFetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`);
    const initialData = extractJsonAfter(page, 'var ytInitialData =') || extractJsonAfter(page, 'ytInitialData =');
    items = itemsFromInitialData(initialData);
    title = playlistTitleFromInitialData(initialData) || title;
    if (!items.length) {
      const browsed = await playlistFromPublicBrowse(playlistId, page);
      items = browsed.items;
      title = browsed.title || title;
    }
    if (!items.length) throw new Error('YouTube did not expose playlist items through its public page. This playlist may be private, age-restricted, or require a signed-in session; use your optional API key for public playlists.');
  }
  return { format: 'social-companion-playlist-backup', schemaVersion: 1, id: playlistId, title, url: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`, exportedAt: new Date().toISOString(), source: apiKey ? 'youtube-data-api' : 'youtube-public-page', items };
}

function entityDecode(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

async function collectTranscript(videoId) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) throw new Error('That video ID is invalid.');
  const page = await youtubeFetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);
  const player = extractJsonAfter(page, 'var ytInitialPlayerResponse =') || extractJsonAfter(page, 'ytInitialPlayerResponse =');
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) return { status: 'no-transcript', reason: 'YouTube did not expose caption tracks for this video.', segments: [] };
  const track = tracks.find((item) => item.languageCode === 'en') || tracks[0];
  const captionUrl = new URL(track.baseUrl);
  captionUrl.searchParams.set('fmt', 'json3');
  const response = await fetch(captionUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return { status: 'error', reason: `YouTube captions returned ${response.status}.`, segments: [] };
  const data = await response.json();
  const segments = (data.events || []).map((event) => ({ start: Number(event.tStartMs || 0) / 1000, text: (event.segs || []).map((segment) => entityDecode(segment.utf8)).join('').replace(/\s+/g, ' ').trim() })).filter((segment) => segment.text);
  return segments.length ? { status: 'complete', reason: `Collected ${segments.length} caption segments.`, segments, language: track.languageCode || '' } : { status: 'no-transcript', reason: 'YouTube returned an empty caption track.', segments: [] };
}

async function collectComments(videoId, apiKey) {
  if (!apiKey) throw new Error('Add your YouTube API key before collecting comments.');
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) throw new Error('That video ID is invalid.');
  const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('videoId', videoId);
  url.searchParams.set('maxResults', '10');
  url.searchParams.set('order', 'relevance');
  url.searchParams.set('textFormat', 'plainText');
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  if (response.status === 403) return { status: 'unavailable', reason: 'Comments are disabled or unavailable for this video.', items: [] };
  if (!response.ok) throw new Error(`YouTube comments returned ${response.status}. Check the key and quota.`);
  const data = await response.json();
  const items = (data.items || []).map((thread) => {
    const top = thread.snippet?.topLevelComment?.snippet || {};
    return { author: top.authorDisplayName || 'Unknown', text: top.textDisplay || '', likes: Number(top.likeCount || 0), publishedAt: top.publishedAt || '' };
  }).filter((comment) => comment.text);
  return { status: 'complete', reason: `Collected ${items.length} top comment${items.length === 1 ? '' : 's'}.`, items };
}

async function inspectVideo(videoId) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) throw new Error('That video ID is invalid.');
  const page = await youtubeFetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);
  const player = extractJsonAfter(page, 'var ytInitialPlayerResponse =') || extractJsonAfter(page, 'ytInitialPlayerResponse =');
  const details = player?.videoDetails;
  if (!details?.videoId || details.videoId !== videoId) {
    // oEmbed is a small public, no-key metadata fallback. It does not expose
    // duration/caption state, but it gives the collector a useful title,
    // channel and preview instead of treating a valid video as unusable.
    const fallback = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`);
    if (!fallback.ok) throw new Error('YouTube did not expose metadata for this video.');
    const embed = await fallback.json();
    return { videoId, title: embed.title || 'YouTube video', channel: embed.author_name || '', durationSeconds: 0, thumbnail: embed.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, url: `https://www.youtube.com/watch?v=${videoId}`, captionsAvailable: false, source: 'oembed' };
  }
  return { videoId, title: details.title || 'YouTube video', channel: details.author || '', durationSeconds: Number(details.lengthSeconds || 0), thumbnail: details.thumbnail?.thumbnails?.at(-1)?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, url: `https://www.youtube.com/watch?v=${videoId}`, captionsAvailable: Boolean(player?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'Use POST.' });
  try {
    const body = req.body || {};
    if (body.action === 'playlist') return json(res, 200, { ok: true, playlist: await collectPlaylist(body) });
    if (body.action === 'transcript') return json(res, 200, { ok: true, transcript: await collectTranscript(body.videoId) });
    if (body.action === 'comments') return json(res, 200, { ok: true, comments: await collectComments(body.videoId, body.apiKey) });
    if (body.action === 'inspect') return json(res, 200, { ok: true, video: await inspectVideo(body.videoId) });
    return json(res, 400, { ok: false, reason: 'Unknown YouTube collection action.' });
  } catch (error) {
    return json(res, 400, { ok: false, reason: error?.message || 'YouTube collection failed.' });
  }
}
