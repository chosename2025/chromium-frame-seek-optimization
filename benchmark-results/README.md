# Benchmark Results

This directory contains a compact summary of captured frame-step seeking benchmark runs.

## Included

- `summary.csv` - aggregated metrics for patched Chromium, unpatched Chromium, Chrome, Brave, and Firefox.
- `patch-speedup.png` - patched vs unpatched Chromium comparison.
- `browser-comparison.png` - browser comparison for patched Chromium, Chrome, Brave, and Firefox.

## Headline Result

Patched Chromium 146 reduced median frame-step seek time from 6.8 ms to 0.3 ms on the captured benchmark set, a 22.7x median-speedup.
