# CRX Lab Design

## Goal

Add a standalone, local-first CRX Lab workspace to the website so someone can
download a Chrome Web Store package and understand its declared extension
surface without installing or executing it.

## Scope

### Input and package retrieval

- Accept a Chrome Web Store extension URL or a 32-character Chrome extension
  ID. Normalise the ID and reject other URLs before any request.
- Continue using the existing `/api/crx?id=...` redirect solely to initiate the
  official CRX download. The site never proxies, stores, or runs the package.
- Make the download action visibly distinguish a package download from an
  inspection. A downloaded `.crx` is an install package, not an unpacked
  source folder.

### Local inspection

- Accept an extracted `manifest.json` for a fully local, reliable inspection.
  Explain that a CRX needs to be unpacked before its manifest can be read.
- Render a readable receipt for manifest version, name, version, description,
  background/service-worker entry, content scripts, action/sidebar, commands,
  permissions, optional permissions, and host permissions.
- Turn each permission/host into a plain-language risk note; do not present a
  heuristic as a security verdict.
- Export the normalized inspection receipt as Markdown or JSON. Nothing leaves
  the browser.

### UX

- Make CRX Lab its own top-level workspace beside Collector, Library, Reddit,
  and X. It must not be hidden in a generic tools grid.
- Start with a clear two-step path: `1. Download package` and `2. Inspect
  extracted manifest`. Include a short safety notice that users should inspect
  before loading unpacked code.
- Give every validation, download handoff, parse success, parse failure, and
  export result a visible toast/status receipt.

## Non-goals

- Do not execute code, emulate a browser, install a CRX, or claim malware
  detection.
- Do not silently unpack a downloaded CRX server-side, upload packages, or
  retain extension files.
- Do not promise Safari conversion. A Chromium CRX and a Safari Web Extension
  have different packaging, APIs, permissions, and review/signing paths.

## Architecture

The static page parses an explicitly selected `manifest.json` with
`FileReader`, normalises a narrow inspection model, renders the receipt, and
generates text downloads with `Blob`/object URLs. The small Vercel endpoint
only validates an extension ID and redirects to Google's CRX update endpoint.

The first release intentionally treats an extracted manifest as the inspection
input. Full in-browser CRX/ZIP extraction is a later, separate enhancement:
it needs a robust ZIP reader and careful CRX-header handling, and should not
turn a simple safety utility into an opaque package-processing feature.

## Acceptance criteria

1. A Store URL and bare extension ID both resolve to the same valid ID.
2. Invalid input yields an explanatory status, never a malformed download URL.
3. A chosen valid manifest renders all declared fields without network access.
4. Manifest parsing errors state what is wrong and preserve the last good
   inspection.
5. Markdown and JSON exports contain only the normalized local inspection.
6. The website copy consistently states that inspection is not a security
   guarantee and a CRX is not automatically an unpacked extension.

## Follow-on work

- Optional client-side CRX/ZIP manifest extraction.
- File listing and package hash display, still local-only.
- Separate Reddit post/subreddit and X profile/thread workspaces with explicit
  user-authorized API credential flows, quota/cost guides, and export receipts.
