# Frontier Amiga Face Editor

Current editor version: **v0.01**.

This `app/` directory is the complete deployable browser editor. It does not contain Frontier artwork or executable data. Open `index.html` directly in a modern browser and load a legally owned Amiga `Frontier` executable.

## v0.01 scope

- Decodes the two known face-component banks directly from the executable.
- Reconstructs complete normal portraits from the game's 32-bit face seed.
- Exposes Bank A / Bank B browsing, seed entry, Previous / Next and Random.
- Implements the exact eight runtime four-colour face palettes for palette indices 1–4.
- Allows a component category and variant to be selected.
- Shows a component-local preview and exact table/bitmap offsets.
- Shows eight representative complete faces with the selected component locked for consistency checking.
- Provides the intended artist-tool layout as a disabled placeholder. The next editing pass should reuse the indexed-raster primitives from the Indy Heat editor rather than reimplementing them.
- Includes an internal fixed-size planar encoder so edited pixels can later be written back to their original bitmap payloads.

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

## Known executable

The analysis build has SHA-256:

`ec97dbb2424a3b66509fc742d3c7960be223c2c12c86d7aa17960e4f0577231c`

The editor warns rather than hard-failing on a different hash, because later Frontier versions may retain the same layout. Such versions are not yet proven.

## Palette display

The eight four-colour tables used for runtime palette indices 1–4 are decoded exactly.

The full face-screen palette assignment for indices 5–13 has not yet been traced. v0.01 therefore shows those entries using neutral reference greys. Renderer conventions for indices 14 and 15 are shown as dark blue and grey. Do not treat the resulting hybrid display as final colour-authentic output.

## Write-back

The face bitmap records are direct, uncompressed, four-bitplane data. A decode → encode round-trip has been verified against every valid table slot in the supplied executable.

This means fixed-size pixel edits can ultimately be patched directly into the executable at the original payload offset. Resizing or relocating components is a separate problem and is deliberately not part of v0.01.
