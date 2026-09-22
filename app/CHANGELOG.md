# Changelog

## v0.02 — automatic source load and preview sizing

- Added an automatic startup attempt to fetch `Frontier` from the hosted project.
- Added GitHub Pages repository inference and raw `main` / `master` branch fallbacks.
- Preserved the existing local file picker and drag/drop flow as a non-fatal fallback.
- Consolidated automatic and manual loading through the same decoder/verification path.
- Reduced the assembled-face preview from 512×576 CSS pixels to 256×288.
- Reduced the central preview panel's minimum height so it leaves proportionally more room for the future segment editor.

## v0.01 — initial face viewer

- Added direct Frontier executable loader and known-build SHA-256 verification.
- Added Bank A / Bank B component-table decoder.
- Added 4-bitplane bitmap decoding for all face component records.
- Added exact 32-bit seed-to-component selector mapping.
- Added assembled portrait preview.
- Added exact eight four-colour dynamic face palette sets for indices 1–4.
- Added palette Auto/0–7/greyscale viewing controls.
- Added selected component preview and exact offset/dimension diagnostics.
- Added representative consistency-preview grid with selected component locked.
- Added secondary runtime control field and provisional special-headgear preview.
- Added disabled artist-tool placeholder ready for direct reuse of the Indy Heat indexed-raster tool core.
- Added fixed-size planar encoder/write-back primitive, without exposing executable export in the UI yet.
