# Rosint full and quick capture

## Behavior

The Rosint widget has independent Posts and Comments selectors. Each defaults to Full. Full visits each available page for that tab and opens any collapsed post bodies before reading cards. Quick reads one page of that tab and leaves collapsed bodies alone. Capture and Download .md use the selected modes. A completed capture remains available for Copy, Links, and Download until the route or a selection changes.

The widget reports counts by tab and whether a crawl stopped at its safety limit or because Rosint failed to advance a page. It must not label a partial crawl as complete. Empty tabs produce empty sections rather than content from the previously selected tab.

## Implementation

Keep DOM selection in `rosint-helpers.js` using stable labels and roles. Posts use `open in reddit` links; Comments use `view comment` permalinks and their own card parser. In `rosint.js`, switch tabs, wait for a new page number and loaded cards after pagination, then open `Show post body` or `Expand comment` controls in Full mode. Persist the two mode choices in local extension storage. Use one capture path for Capture and Download.

## Verification

Unit tests cover body-toggle discovery and page progression. A Rosint widget test covers independent modes and Download retaining full results. Run the full unit suite and browser test when available.
