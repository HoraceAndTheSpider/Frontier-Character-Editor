# Changelog

## v0.09 — mobile logo and hosted binary loading

- Corrected the phone breakpoint that allowed the Frontier logo to expand to nearly the full screen width.
- Keeps the supplied logo file unchanged; only its responsive HTML/CSS display size changes.
- On phone-size displays the logo is capped at 140 px / 36vw.
- Automatic Frontier loading now tries the same hosted repository path (`../whdload/data/game/Frontier`) before `raw.githubusercontent.com`.
- This makes GitHack-hosted copies use the GitHack-hosted binary directly instead of depending first on a cross-origin request.
- Increased the per-source automatic-load timeout from 3.5 seconds to 10 seconds for slower mobile/CDN connections.
- Failed automatic source attempts are now also reported to the browser console for diagnosis.

## v0.08 — title, logo and palette selector

- Restored visible page versioning and changed the title to `Frontier: Elite II - (Amiga Version) Face Editor v0.08`.
- Added the supplied Frontier: Elite II logo to the top-right header without modifying the PNG data; HTML/CSS renders it at 20% of its 2048px intrinsic width.
- Removed the redundant top-level `Import Frontier binary` control.
- Replaced the Display palette dropdown with a range slider while retaining Auto, palettes 0–7 and Indexed greyscale.
- Added descriptive names for palette 0–7: Khaki, Red, Yellow, Grey, Dark Grey, Pink, Green and Blue.

## v0.07 — patchable portrait palette and indexed PNG components

- Added direct editing and binary-B patching for fixed portrait palette indices `$5`–`$C` at file `$87878`.
- Added native Amiga 12-bit `$RGB` controls with 0–15 R/G/B sliders and a colour picker that snaps to 4-bit channel values.
- Locked palette indices `$0`, `$1`–`$4` and `$D`–`$F` from palette editing.
- Added genuine 4-bit indexed PNG export for the selected component.
- Added indexed PNG import with dimension checks and direct preservation of palette indices 0–15.
- Added component PNG import/export controls to the left Component panel.
- Compacted the selected-component heading into a fixed-height sub-box and shortened it to `Bank X (reference/working) · Part · vari. N (WxHpx)`.
- Binary B modification status now includes both component and base-palette edits.

## v0.06 — authentic portrait palette and UI housekeeping

- Replaced the neutral placeholder colours with the traced Frontier portrait palette for indices 5–15.
- Preserved the eight runtime-selected colour sets at indices 1–4.
- Removed loaded-file names, hashes and binary statistics from the A/B loader UI.
- Replaced the large page-wide drop area with compact `Drop A` / `Drop B` targets inside the binary slots.
- Removed the palette developer-description text from the normal UI.
- Variant selection now applies immediately; the `Use variant in current face` button is removed.
- Moved Undo / Revert component directly below the primary artist tools and above the colour palette.
- Removed the long palette/transparency instruction paragraph from the artist panel.

## v0.05 — A/B binary editing and direct export

- Added independent binary A (reference) and B (working) slots.
- First import/automatic load fills both slots when both are empty; later A/B imports are explicit and independent.
- Added View A / Edit B switching for direct visual comparison.
- Made A read-only and B the sole paint/write target.
- Every B component edit is re-encoded immediately into its original four-bitplane payload in the working executable.
- Added complete B binary download and A reference download.
- Added Restore B from A for whole-binary rollback to the reference state.
- Added per-B modified-component tracking.
- Restored Indy Heat-style editor brush transparency: right-click a palette swatch to set the capture/mask transparency index; right-click drawing writes that index.
- Kept Frontier's game compositing transparency fixed at palette index 0 and visually distinguished it from editor brush transparency.

## v0.04 — component-first editor and Indy Heat artist tools

- Swapped UI priority: the selected facial feature is now the large central editor; the complete assembled face is the compact top-right preview.
- Added native-dimension component editing with 100%–1600% pixel-perfect zoom.
- Added a resizable Fixed viewport mode whose window size is retained independently of zoom/component dimensions.
- Imported/adapted Indy Heat's resource-neutral `layer-tools.js` and `brush-tools.js` rather than duplicating raster geometry/brush logic.
- Added Pencil, Line, outlined/filled Rectangle, outlined/filled Ellipse, Curve, Free-form, Fill and Pick.
- Added 1–9 pixel square/circle standard brushes.
- Added rectangle, ellipse, multi-edge and traced-freeform brush pickup from the selected facial component.
- Added captured-brush rotate/flip and IHBR v1 brush save/load using Frontier's 16-colour indexed pixels.
- Deliberately excluded Indy Heat's custom brush library and Brush Manager.
- Added per-component Undo and Revert; right-click drawing erases to transparent index 0.
- Live component edits propagate to every selector slot that aliases the same source bitmap offset, then update complete-face and consistency previews.
- Direct modified-Frontier export remains disabled pending the separate write-back/validation pass.

## v0.03 — correct GitHub Frontier source

- Changed automatic startup loading to use the exact repository path:
  `HoraceAndTheSpider/Frontier-Character-Editor/whdload/data/game/Frontier`.
- Uses the raw `master` branch URL as the primary source.
- Keeps `../whdload/data/game/Frontier` as a same-project hosted fallback.
- Retains manual file selection and drag/drop unchanged.
- Preserves the compact v0.02 assembled-face preview sizing.

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
