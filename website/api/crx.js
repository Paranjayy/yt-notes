function sendError(response, status, message) {
  response.status(status).json({ error: message });
}

export default function handler(request, response) {
  if (request.method !== 'GET') return sendError(response, 405, 'Only GET is supported.');

  const id = String(request.query?.id || '').trim().toLowerCase();
  if (!/^[a-p]{32}$/.test(id)) {
    return sendError(response, 400, 'Enter a valid 32-character Chrome Web Store extension ID.');
  }

  const query = new URLSearchParams({
    response: 'redirect',
    prodversion: '128.0.0.0',
    acceptformat: 'crx3',
    x: `id=${id}&uc`,
  });
  response.redirect(302, `https://clients2.google.com/service/update2/crx?${query.toString()}`);
}
