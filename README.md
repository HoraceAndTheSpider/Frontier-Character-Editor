# Frontier: Elite II - (Amiga Version) Face Editor
**Author**: Dom Cresswell - 2026

Browser-based editor and reverse-engineering project for the modular character portraits used by the Amiga version of **Frontier: Elite II**. Created by request due to "the original portaits looking awful." (Or less polite wording.)

The current editor can decode the original portrait components directly from the Frontier executable, reconstruct generated faces, edit the individual indexed-colour components, edit the fixed portrait palette, and write those changes back into a working copy of the executable.

## Quick start

Open `app/index.html` in a modern browser.

The editor uses an A/B workflow:

- **A** is the reference binary and is read-only.
- **B** is the editable working binary.
- If both slots are empty, the first Frontier binary loaded fills both.
- Edit components and palette colours in B.
- Use **View A / Edit B** for comparison.
- Use **Restore B from A** to discard the working changes.
- Use **Download B** to save the modified Frontier executable.

When hosted from this repository, the editor attempts to load `whdload/data/game/Frontier` automatically. Manual A/B loading and drop zones remain available.

## What is currently editable

- Existing face-component pixels within their original dimensions.
- Fixed portrait palette entries `$5`–`$C`.
- Components can be exchanged as indexed PNGs using Frontier palette indices 0–15.
- Captured brushes can be saved and loaded using the IHBR brush format.

Component resizing, relocation and adding new face components are deliberately outside the current scope.

## Documentation

The wiki documentation is split into:

- **Face Graphics and Assembly** — executable layout, component records, selectors, draw order and direct write-back.
- **Face Palettes** — the fixed 16-colour portrait palette and eight dynamic palette sets.
- **Face Editor Workflow** — practical guide to A/B editing, artist tools, palette editing, PNG exchange and export.
- **Further Investigation** — the small number of reverse-engineering points that remain unresolved.

The app-specific change history remains in `app/CHANGELOG.md`.

## Known reference executable

The analysed Amiga Frontier executable is 645,752 bytes with SHA-256:

`ec97dbb2424a3b66509fc742d3c7960be223c2c12c86d7aa17960e4f0577231c`

Other executable revisions may share the same layout, but are not yet treated as proven.
