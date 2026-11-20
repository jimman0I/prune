# Bundled fonts

All fonts are licensed under the SIL Open Font License 1.1. iced (cosmic-text)
cannot load woff/woff2, so these are static TrueType files taken from the
upstream releases rather than converted from `@fontsource`.

| Files | Source | Version | Licence file |
| --- | --- | --- | --- |
| `Geist-Regular/Medium/SemiBold/Bold.ttf` (400/500/600/700) | npm `geist` (Vercel), `dist/fonts/geist-sans/` | 1.9.2 (tarball sha256 `febc71ab4c9c06b9085f5e8be83847d91510dbef89b57fe8d45fce911a6ac271`) | `Geist-OFL.txt` |
| `JetBrainsMono-Regular/Medium/SemiBold.ttf` (400/500/600) | GitHub release `JetBrains/JetBrainsMono` `JetBrainsMono-2.304.zip`, `fonts/ttf/` | 2.304 (zip sha256 `6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf`) | `JetBrainsMono-OFL.txt` |

These are the same weights 3.x loads in `frontend/src/main.jsx`.
