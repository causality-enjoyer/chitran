# Performance log

## V1

| Version | Binary | .deb   | .rpm   | Cold start           |
|---------|--------|--------|--------|----------------------|
| v0      | 6.1 MB | 2.5 MB | 2.5 MB | instant (unmeasured) |
| v1a (CM6, no vim) | 6.2 MB | 2.6 MB | 2.6 MB  | instant (immediate on launch) |
| v1b (CM6 + vim) | 6.3 MB | 2.6 MB | 2.7 MB | instant (immediate on launch)|
| v1c (unmeasured) | | | | |
| v1d (layout) | 6.3 MB |  2.7 MB | 2.7 MB | instant (but doesn't feel as lightning fast as others) |

At this time, appimage was also built, and now has size of 106 MB
v1d's slight lag is gone in v2a.

## V2

| Version | Binary | .deb   | .rpm   | .AppImage | Cold start           |
|---------|--------|--------|------|---|----------------------|
| v2a: mdworker      | 6.3 MB | 2.7 MB | 2.7 MB | 106 MB | instant (back to lightning fast as others) |


