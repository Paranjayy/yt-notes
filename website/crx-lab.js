(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CrxLab = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var EXTENSION_ID = /^[a-p]{32}$/;

  function extractExtensionId(value) {
    var source = String(value || '').trim().toLowerCase();
    if (EXTENSION_ID.test(source)) return source;
    try {
      var url = new URL(source);
      var host = url.hostname.replace(/^www\./, '');
      if (host !== 'chromewebstore.google.com' && host !== 'chrome.google.com') return '';
      var id = url.pathname.match(/[a-p]{32}/);
      return id ? id[0] : '';
    } catch (error) {
      return '';
    }
  }

  function list(value) {
    return Array.isArray(value) ? value.filter(function (item) { return typeof item === 'string' && item.trim(); }) : [];
  }

  function contentScripts(manifest) {
    return Array.isArray(manifest.content_scripts) ? manifest.content_scripts.map(function (entry) {
      return {
        matches: list(entry.matches),
        js: list(entry.js),
        css: list(entry.css),
        runAt: entry.run_at || 'document_idle',
      };
    }) : [];
  }

  function permissionNote(permission) {
    var notes = {
      activeTab: 'Temporary access to the tab you explicitly invoke it on.',
      tabs: 'Can read tab URLs, titles, and tab state when used.',
      scripting: 'Can inject scripts into sites covered by host access.',
      downloads: 'Can initiate and manage browser downloads.',
      history: 'Can read and search browser history.',
      bookmarks: 'Can read and change bookmarks.',
      cookies: 'Can read and modify cookies for permitted sites.',
      debugger: 'Can use Chrome debugging capabilities on attached tabs.',
      nativeMessaging: 'Can communicate with installed native desktop software.',
      storage: 'Can persist extension data in browser storage.',
      notifications: 'Can display browser notifications.',
      sidePanel: 'Can provide a browser side-panel surface in supporting browsers.',
    };
    return notes[permission] || 'Review this declared browser capability in context of the extension code.';
  }

  function hostNote(host) {
    if (host === '<all_urls>' || host === '*://*/*') return 'Runs on, or can request access to, essentially every web page.';
    return 'Can run on or request access to: ' + host;
  }

  function inspectManifest(manifest) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('That file is not a manifest JSON object.');
    var background = manifest.background || {};
    var commands = Object.keys(manifest.commands || {}).map(function (name) {
      var command = manifest.commands[name] || {};
      return { name: name, description: command.description || '', shortcut: command.suggested_key || {} };
    });
    var surfaces = [];
    if (manifest.action || manifest.browser_action || manifest.page_action) surfaces.push('Toolbar action');
    if (manifest.side_panel || manifest.sidebar_action) surfaces.push('Sidebar / side panel');
    if (manifest.options_page || manifest.options_ui) surfaces.push('Options page');
    return {
      inspectedAt: new Date().toISOString(),
      name: String(manifest.name || 'Unnamed extension'),
      version: String(manifest.version || 'Unknown'),
      description: String(manifest.description || ''),
      manifestVersion: manifest.manifest_version || 'Unknown',
      background: background.service_worker ? 'Service worker: ' + background.service_worker : background.scripts ? 'Background scripts: ' + list(background.scripts).join(', ') : 'None declared',
      permissions: list(manifest.permissions),
      optionalPermissions: list(manifest.optional_permissions),
      hostPermissions: list(manifest.host_permissions),
      optionalHostPermissions: list(manifest.optional_host_permissions),
      contentScripts: contentScripts(manifest),
      commands: commands,
      surfaces: surfaces,
    };
  }

  function inspectionMarkdown(receipt) {
    var lines = [
      '# Extension inspection: ' + receipt.name,
      '',
      '- Version: ' + receipt.version,
      '- Manifest version: ' + receipt.manifestVersion,
      '- Inspected locally: ' + receipt.inspectedAt,
      '- Background: ' + receipt.background,
      '',
      '## Declared permissions',
      '',
    ];
    lines = lines.concat(receipt.permissions.length ? receipt.permissions.map(function (permission) { return '- `' + permission + '` — ' + permissionNote(permission); }) : ['- None declared.']);
    if (receipt.optionalPermissions.length) lines = lines.concat(['', '## Optional permissions', ''], receipt.optionalPermissions.map(function (permission) { return '- `' + permission + '` — ' + permissionNote(permission); }));
    lines.push('', '## Host access', '');
    lines = lines.concat(receipt.hostPermissions.length ? receipt.hostPermissions.map(function (host) { return '- `' + host + '` — ' + hostNote(host); }) : ['- None declared.']);
    if (receipt.optionalHostPermissions.length) lines = lines.concat(['', '## Optional host access', ''], receipt.optionalHostPermissions.map(function (host) { return '- `' + host + '` — ' + hostNote(host); }));
    lines.push('', '## Content scripts', '');
    lines = lines.concat(receipt.contentScripts.length ? receipt.contentScripts.map(function (entry, index) { return '- ' + (index + 1) + '. Matches: ' + (entry.matches.join(', ') || 'none') + '; JS: ' + (entry.js.join(', ') || 'none') + '; CSS: ' + (entry.css.join(', ') || 'none') + '.'; }) : ['- None declared.']);
    lines.push('', '> This is a local manifest summary, not a security guarantee. It does not execute, install, or analyse the extension code.');
    return lines.join('\n');
  }

  return { extractExtensionId: extractExtensionId, inspectManifest: inspectManifest, inspectionMarkdown: inspectionMarkdown, permissionNote: permissionNote, hostNote: hostNote };
});
