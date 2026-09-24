# Frontier: Elite II - (Amiga Version) Face Editor

Current editor version: **v0.09**.

This `app/` directory is the complete deployable browser editor. It does not contain Frontier artwork or executable data. Open `index.html` directly in a modern browser and load a legally owned Amiga `Frontier` executable.

## v0.09 scope

- Restores the visible page version and adopts the title `Frontier: Elite II - (Amiga Version) Face Editor`.
- Adds the supplied Frontier: Elite II logo to the top-right header, using the original PNG bytes and rendering it at 20% of its 2048px intrinsic width.
- Removes the redundant top-level `Import Frontier binary` control; binary loading remains in the A/B panel and its drop zones.
- Replaces the Display palette dropdown with an immediate range slider covering Auto, palettes 0–7 and Indexed greyscale.
- Names the eight runtime palette overrides: Khaki, Red, Yellow, Grey, Dark Grey, Pink, Green and Blue.


- Adds explicit **A/B binary slots**: A is the read-only reference and B is the editable/export working copy. A first import fills both empty slots; later A or B loads are independent.
- Patches every committed B component edit directly back into its original uncompressed planar payload and downloads B as a complete modified `Frontier` binary.
- Adds **Restore B from A** for a full return to the reference binary while preserving the user's A slot.
- Allows A/B visual comparison by switching between **View A** and **Edit B** without changing face seed/component selection.
- Separates Frontier's fixed game compositing transparency (index 0) from the editor brush-transparency key. Right-clicking a palette swatch changes the editor transparency; right-click painting writes that colour; brush pickup ignores it.
- Attempts to auto-load `Frontier` from `HoraceAndTheSpider/Frontier-Character-Editor` at `whdload/data/game/Frontier` before falling back to manual file selection.
- Decodes the two known face-component banks directly from the executable.
- Reconstructs complete normal portraits from the game's 32-bit face seed.
- Makes the selected facial component the main central editing surface; the complete assembled face is now a compact top-right preview.
- Adds live fixed-size 4-bit indexed editing of the selected component, with the complete-face and consistency previews updating from the same edited bitmap record.
- Imports the resource-neutral raster geometry and brush engines used by the Indy Heat editor rather than implementing a second drawing system.
- Adds Pencil, Line, outlined/filled Rectangle and Ellipse, Curve, Free-form, Fill and Pick tools.
- Adds square/circle standard brushes, rectangular/elliptical/multi-edge/traced brush pickup, brush rotation/flip, and IHBR v1 brush save/load. Indy Heat's custom brush library/manager is intentionally not included.
- Adds 100%–1600% component zoom and a resizable Fixed viewport mode so the editing window can stay the same size while zooming or switching facial features.
- Exposes Bank A / Bank B browsing, seed entry, Previous / Next and Random.
- Implements the exact eight runtime four-colour face palettes for palette indices 1–4.
- Allows a component category and variant to be selected.
- Shows a component-local preview and exact table/bitmap offsets.
- Shows eight representative complete faces with the selected component locked for consistency checking.
- Uses the fixed-size planar encoder for live B-binary write-back at each committed edit.

## Important runtime model

Frontier does not contain a small fixed list of complete faces. Normal portraits are generated from a 32-bit seed:

- bit 0: face bank;
- bits 1–3: hair / outer head;
- bits 5–7: upper face / hairline;
- bits 8–10: neck / clothing;
- bits 11–13: paired left/right cheek and ear;
- bits 14–16: lower face / chin;
- bits 17–19: mouth;
- bits 20–22: nose;
- bits 23–25: eyes / eyewear;
- bits 25–27: dynamic palette when the secondary control word is zero.

Because selectors are combinatorial, one component can occur in millions of valid generated portraits. The consistency grid therefore supplies representative complete faces with the chosen component locked rather than claiming to list every possible use.

## v0.07 palette and component exchange

- Palette indices `$5`–`$C` in the fixed portrait palette can be edited in binary B.
- RGB controls operate at native Amiga 4-bit-per-channel precision and patch the 12-bit `$RGB` WORDs at file `$87878`.
- Palette indices `$0`, `$1`–`$4` and `$D`–`$F` are locked. `$1`–`$4` remain controlled by Frontier's eight dynamic face palettes.
- Selected components export as genuine indexed-colour PNGs with 16 palette entries and index 0 transparent.
- Component PNG import accepts non-interlaced indexed PNGs that use only pixel indices 0–15, preserves those indices directly, and requires the image dimensions to match the selected component.


## Automatic source loading

v0.09 first tries the binary from the same hosted repository structure:

`../whdload/data/game/Frontier`

This is particularly useful when the editor is opened through GitHack, because the app and binary can be fetched from the same origin. If that source is unavailable it falls back to the known raw GitHub source:

`https://raw.githubusercontent.com/HoraceAndTheSpider/Frontier-Character-Editor/master/whdload/data/game/Frontier`

The fetch timeout is 10 seconds to allow the 645,752-byte binary to load over slower mobile/CDN connections. If automatic loading still fails, the A/B manual load and drop controls remain available.

## Known executable

The analysis build has SHA-256:

`ec97dbb2424a3b66509fc742d3c7960be223c2c12c86d7aa17960e4f0577231c`

The editor warns rather than hard-failing on a different hash, because later Frontier versions may retain the same layout. Such versions are not yet proven.

## Palette display

v0.06 uses the traced Frontier portrait palette. The complete base table is:

`$000, $F33, $811, $600, $500, $410, $520, $741, $952, $A74, $C96, $EB9, $FEC, $87C, $549, $AAA`

During normal face rendering, the face routine replaces indices 1–4 with one of the eight exact dynamic four-colour sets. Indices 5–15 remain the fixed runtime colours from the base table. Index 0 remains the game's component-compositing transparency index.

## Editing state

Binary A is the read-only comparison/reference source. Binary B is the working source and the only paint target. Every selector entry that aliases the same underlying bitmap offset is updated together, so previews remain consistent with the executable's shared artwork.

Each committed edit is also encoded immediately into B's original fixed-size planar payload. **Download B** therefore exports a complete ready-to-test working binary rather than a separate patch file. **Restore B from A** replaces the complete working binary with a fresh copy of A.

## Write-back

The face bitmap records are direct, uncompressed, four-bitplane data. A decode → encode round-trip has been verified against every valid table slot in the supplied executable.

v0.06 performs that fixed-size write-back live in binary B. Every committed edit re-encodes the component's 0–15 indexed pixels into its original four bitplanes and replaces only that record's payload bytes. Binary A remains untouched. Resizing or relocating components remains deliberately unsupported.

