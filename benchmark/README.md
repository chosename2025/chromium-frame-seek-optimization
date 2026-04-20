# Browser Video Seeking Benchmark

Production-grade Vue 3 + TypeScript benchmark suite for measuring frame-by-frame video seek performance across resolutions, fps, and iframe densities.

Inspired by [HTML Video Element Seeking Performance](https://stepancar.github.io/articles/articles/html-video-element-seeking/) by Stepan Karpov.

## Features

- Frame-by-frame seek performance measurement
- 30 test videos (Big Buck Bunny) with varying resolutions (480p-2160p), fps (30/60), audio, and iframe densities
- Browser hardware profiling (GPU, codecs, decoding capabilities)
- O(n) degradation detection via linear regression
- CSV and .vsbench export (JSON snapshot with full results)
- Load .vsbench files back into the app for analysis
- Bilingual interface (EN/RU)
- Wizard-based workflow: select → run → analyze

## Architecture

Feature-Sliced Design (FSD) with strict layer imports:
```
app → pages → widgets → features → entities → shared
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Tech Stack

- Vue 3 Composition API + TypeScript
- Pinia state management
- shadcn-vue UI components
- Chart.js visualization
- Vite build
