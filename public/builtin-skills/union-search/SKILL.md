---
name: union-search
description: Search the web across general engines, developer communities, social/content platforms, RSS feeds, and individual URLs, returning candidate links or cleaned Markdown webpage content. Use when Codex needs fresh external information, source discovery, site-limited search, multi-platform search, or to visit a URL and extract readable Markdown from the page.
---

# Union Search

## Overview

Use this skill to search multiple external sources and to visit a specific URL for cleaned Markdown content. Search commands find candidate links. `visit_url` reads the chosen page and returns structured Markdown plus metadata, headings, links, and images.

This skill is designed to run as a standalone Codex skill. It does not rely on ChatroomAI / ActiChat host-specific webpage extraction logic.

## Quick Start

Use these entrypoints:

- `scripts/union_search`
- `scripts/web_search`
- `scripts/social_search`
- `scripts/dev_search`
- `scripts/image_search`
- `scripts/rss_search`
- `scripts/visit_url`
- `scripts/fetch_url`

Examples:

```text
scripts/union_search --query "OpenAI agent runtime" --group preferred --preset medium --deduplicate
scripts/web_search --query "OpenAI agent runtime" --site github.com --limit 5
scripts/visit_url --url "https://example.com"
scripts/visit_url --url "https://example.com" --extract browser
```

## Workflow

1. Search first to discover candidate links.
2. Treat search snippets as clues, not as webpage正文.
3. Visit the chosen URL with `scripts/visit_url`.
4. Use `--extract browser` when the page depends on client-side rendering and a local Chrome or Edge executable is available.

## Commands

### `scripts/union_search`

Multi-platform aggregated search.

Common options:

- `--query <string>`: required search query
- `--group <string>`: `dev`, `social`, `search`, `rss`, `no_api_key`, `preferred`, `all`
- `--platforms <comma-separated>`: explicit platform list
- `--providers <comma-separated>`: fallback web-search providers for site-limited lookups
- `--limit <number>`: per-platform result count
- `--preset <small|medium|large|extra|max>`: per-platform result preset
- `--deduplicate`: deduplicate merged results
- `--list-platforms`
- `--list-groups`

### `scripts/web_search`

General web-search aggregation with optional site filtering.

Common options:

- `--query <string>`: required
- `--site <domain>`: optional site filter such as `github.com`
- `--providers <comma-separated>`: optional provider list
- `--limit <number>`

### `scripts/social_search`

Search social/content platforms. If `--platform` is omitted, it aggregates the `social` group.

### `scripts/dev_search`

Search developer-oriented platforms. If `--platform` is omitted, it aggregates the `dev` group.

### `scripts/image_search`

Image search across supported providers.

### `scripts/rss_search`

Keyword search across configured RSS feeds.

### `scripts/visit_url`

Visit a single URL and return cleaned Markdown content plus structured metadata.

Common options:

- `--url <string>`: required
- `--extract <html|direct|browser>`: extraction mode
- `--max-content-chars <number>`
- `--max-links <number>`
- `--max-images <number>`
- `--max-headings <number>`
- `--no-links`
- `--no-images`
- `--no-headings`
- `--no-metadata`
- `--browser-executable <path>`: optional explicit Chrome / Edge executable for browser mode
- `--browser-virtual-time-budget-ms <number>`: optional browser render budget

Behavior:

- `html` / `direct`: fetch the raw HTML with the skill's request client, then extract readable content with Defuddle
- `browser`: ask a local Chrome / Edge executable to render the page headlessly, then extract readable content with Defuddle

### `scripts/fetch_url`

Compatibility alias for `scripts/visit_url`.

## Output

All commands support:

- `--format <json|markdown|text>`
- `--markdown`
- `--json`
- `--pretty`
- `--compact`
- `--output <path>`

`scripts/visit_url` defaults to Markdown output when no explicit output format is selected.

Typical `visit_url` fields:

- `title`
- `url`
- `finalUrl`
- `description`
- `content`
- `metadata`
- `headings`
- `links`
- `images`
- `warnings`
- `truncated`

## Browser Mode

Browser mode is optional and local-machine dependent.

- It requires a local Chrome or Edge executable.
- The skill first checks `--browser-executable`.
- Then it checks `UNION_SEARCH_BROWSER_EXECUTABLE`, `CHROME_PATH`, or `EDGE_PATH`.
- Then it tries common Chrome / Edge locations for the current OS.

If no supported browser executable is available, browser mode fails with a clear error instead of silently falling back.

## Config

Skill configuration can come from:

1. command-line flags
2. `SKILL_CONFIG_JSON`
3. environment variables where supported
4. built-in defaults

See [references/config.md](references/config.md) for the main config keys and browser-mode notes.

## Sources

- Search aggregation and overall skill shape are adapted from `runningZ1/union-search-skill`
- Webpage extraction and Markdown conversion are adapted from `kepano/defuddle`
