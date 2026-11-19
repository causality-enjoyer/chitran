# Performance log

Judge the size budget on the binary and the .deb. The AppImage bundles
WebKitGTK, so it isn't representative of an Arch install and is no longer tracked.

## V1

| Version | Binary | .deb | .rpm | Cold start |
|---------|--------|------|------|------------|
| v0 | 6.1 MB | 2.5 MB | 2.5 MB | instant (unmeasured) |
| v1a (CM6, no vim) | 6.2 MB | 2.6 MB | 2.6 MB | instant (immediate on launch) |
| v1b (CM6 + vim) | 6.3 MB | 2.6 MB | 2.7 MB | instant (immediate on launch) |
| v1c (ex commands) | not measured | | | |
| v1d (layouts) | 6.3 MB | 2.7 MB | 2.7 MB | instant (slight lag, gone in v2a) |

At v1d the AppImage was also built, at 106 MB.

## V2

| Version | Binary | .deb | .rpm | Cold start |
|---------|--------|------|------|------------|
| v2a: markdown worker | 6.3 MB | 2.7 MB | 2.7 MB | instant (back to lightning fast) |
| v2b: sanitize + cursor sync | 6.3 MB | 2.7 MB | 2.7 MB | instant |

AppImage: 106 MB at v2a and v2b (last time it was tracked).

## Frontend chunks (from `pnpm build`)

| Version | Main chunk (raw) | Main chunk (gzip) | Worker chunk (raw) |
|---------|------------------|-------------------|--------------------|
| v1a (CM6, no vim) | 496.29 kB | 173.27 kB | n/a |
| v1b (CM6 + vim) | not recorded | not recorded | n/a |
| v2a: markdown worker | 659.48 kB | 223.91 kB | 201.62 kB |
| v2b: sanitize + cursor sync | 660.60 kB | 224.11 kB | 206.93 kB |

Notes:
- The main chunk jump from v1a to v2a covers vim plus everything added through
  v2 (the Svelte page, ex commands, layouts), so it is not the vim cost alone.
  The binary delta (about 0.1 MB) is the honest vim number.
- Sanitize cost about 5 kB in the worker (201.62 to 206.93 kB).
- Raw HTML in Markdown is disabled by design. Revisit in v4 with an allow-list.
