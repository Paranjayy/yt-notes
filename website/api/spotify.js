function sendError(response, status, message) {
  response.status(status).json({ error: message });
}

function canonicalEpisodeUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'https:' || url.hostname.replace(/^www\./, '') !== 'open.spotify.com') return null;
    const match = url.pathname.match(/^\/episode\/([A-Za-z0-9]{22})$/);
    return match ? { id: match[1], url: `https://open.spotify.com/episode/${match[1]}` } : null;
  } catch (error) {
    return null;
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendError(response, 405, 'Only GET is supported.');

  const episode = canonicalEpisodeUrl(request.query?.url);
  if (!episode) return sendError(response, 400, 'Paste an open.spotify.com/episode/... URL.');

  try {
    const upstream = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(episode.url)}`);
    if (upstream.status === 404) return sendError(response, 404, 'Spotify could not find that public episode.');
    if (!upstream.ok) return sendError(response, 502, 'Spotify metadata is temporarily unavailable.');
    const payload = await upstream.json();
    response.status(200).json({
      id: episode.id,
      url: episode.url,
      title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : 'Spotify episode',
      thumbnail: typeof payload.thumbnail_url === 'string' ? payload.thumbnail_url : '',
    });
  } catch (error) {
    sendError(response, 502, 'Spotify metadata is temporarily unavailable.');
  }
}
