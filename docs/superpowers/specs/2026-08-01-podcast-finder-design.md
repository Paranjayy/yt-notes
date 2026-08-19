# Podcast Finder & Transcript Router Design

## Goal

Let a user paste Spotify podcast episode links, receive an official Spotify
metadata/player preview, and move deliberately toward an official YouTube,
RSS, creator-site, or user-supplied transcript source without extracting
Spotify playback audio or listener transcripts.

## Decisions

- Use Spotify's documented oEmbed API for public episode title, thumbnail, and
  embed information. This avoids keys, user accounts, scraping, and storing
  Spotify credentials.
- Validate only `open.spotify.com/episode/<22-char-id>` URLs in the Vercel
  endpoint. It proxies one metadata request, returns a reduced receipt, and
  never returns audio URLs or iframe HTML.
- Add a standalone `Podcast Finder` workspace. It accepts one or more Spotify
  episode URLs, shows a non-autoplaying official embed, and creates a direct
  YouTube search link from the returned title.
- Give each result clear source states: `Spotify metadata ready`, `Official
  YouTube match not verified`, and `Transcript download only if the creator or
  RSS source publishes one`. A user can paste a YouTube URL into the existing
  collector after selecting a match.
- Treat transcript import as a later local-only follow-on: VTT/SRT/Markdown
  files supplied by the user, converted into the archive format. Do not fetch
  Spotify's private/internal transcript services.

## Boundaries

- Spotify's Web API policy says third parties may not facilitate Spotify
  content downloads or stream ripping. No audio downloader, preview downloader,
  DRM bypass, or hidden playback endpoint is included.
- Spotify's documented transcript VTT download is for eligible show creators
  through Spotify for Creators. Listener-facing display is not represented as a
  general export API.
- A YouTube search result is a discovery handoff, not proof an episode exists
  there. The user chooses an official/public match before using the YouTube
  collector.

## Flow

1. Paste one or more Spotify episode URLs; non-Spotify text is ignored.
2. The website calls `/api/spotify?url=...` for each unique episode, with a
   concurrency cap of two.
3. The endpoint validates the Spotify episode URL and calls the documented
   oEmbed API. It returns title, thumbnail, canonical URL, and ID only.
4. Each result renders an official no-autoplay embed, source receipt, `Search
   YouTube`, `Open Spotify`, and `Copy title` actions.
5. If a user finds a YouTube URL, the existing collector remains the only
   transcript collector and validates it as YouTube before collection.

## Acceptance criteria

1. Spotify URLs resolve to a public metadata card without a user API key.
2. Invalid/non-Spotify links get a clear status and do not reach the endpoint.
3. The page never exposes an audio-download action or implies transcript
   availability.
4. Each preview has an official Spotify link and an explicit unverified
   YouTube-search handoff.
5. Errors preserve other episode cards and identify the affected URL.
