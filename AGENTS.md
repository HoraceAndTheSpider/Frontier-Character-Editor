# Frontier Face Editor project instructions

## Mandatory startup protocol

- Read this `AGENTS.md` first.
- Treat the current checked-in source, current pushed wiki, user-tested local build and latest explicit handover/runtime evidence as authority.
- Repository access is read-only/reference work unless the user explicitly asks otherwise. The user tests locally and owns commits/pushes.
- Do not repeat settled face-table, bitmap-format, seed-selector or palette-table research merely because work has moved to a new conversation.
- A user-reported live editor or Amiga runtime result is the acceptance result. Static inspection is not a substitute for that runtime observation.

## Targeted tasks — default for small editor changes

A targeted task is a small localised request where the user identifies a control, panel, tool or behaviour and is not asking for new reverse engineering.

For a targeted task:

1. Inspect the most likely owning `app/` file first.
2. Do not perform a repo-wide investigation.
3. Do not re-read the whole wiki or search historical commits unless the current source genuinely leaves the requested behaviour unclear.
4. Do not broaden the task into architecture cleanup or reverse engineering.
5. Make the smallest production change that satisfies the request.
6. Perform one focused verification pass.
7. Increment the visible/internal editor version on every app change.
8. Deliver complete changed files only, suitable for direct replacement.

## Canonical app files

- `app/index.html` — application shell, controls, script order and visible version.
- `app/style.css` — application layout and presentation.
- `app/frontier-face-data.js` — Frontier executable layout, face-bank decoding, seed selectors, palette tables, planar decoder/encoder and composition.
- `app/app.js` — UI state, file loading, assembled preview, component selection and consistency preview.
- `app/README.md` — current app contract and known limitations.
- `app/CHANGELOG.md` — editor change history.

Artist/raster tooling should later be added as a genuinely independent file by adapting the proven resource-neutral tools from the Indy Heat editor. Do not create repeated `*-fix-vNN.js` or patch-layer files.

## Editor deliverables

- Deliver only complete changed existing app files at their repository-relative paths.
- For a newly added production file, deliver the complete file.
- Do not provide patches, apply scripts or partial snippets as the primary deliverable.
- A ZIP is a convenience bundle containing only the files intended for replacement/addition.
- Do not package Frontier executable data or extracted copyrighted face artwork into the app. The browser app decodes the user's own executable.
- Do not ask the user to run development test suites unless requested; normal acceptance is direct browser testing.

## Documentation

- Preserve wiki page names once established.
- Keep one and only one `Further Investigation.md`.
- Settled findings belong on the relevant subject page.
- Only unresolved work belongs on `Further Investigation.md`.
- Routine targeted UI changes do not require a wiki pass unless the user asks.

## Current reverse-engineered authority

Known Amiga Frontier executable SHA-256:

`ec97dbb2424a3b66509fc742d3c7960be223c2c12c86d7aa17960e4f0577231c`

Known face-bank tables:

- Bank A: hunk 7 + `$0F308`, file `$644CC`
- Bank B: hunk 7 + `$1094E`, file `$65B12`

Bitmap records are uncompressed four-bitplane data:

- `+0 WORD` X
- `+2 WORD` Y
- `+4 WORD` width in 16-pixel words
- `+6 WORD` height
- `+8` four plane-major bitmap payloads

Normal face selector mapping from 32-bit seed:

- bit 0 bank;
- bits 1–3 hair / outer head;
- bits 5–7 upper face / hairline;
- bits 8–10 neck / clothing;
- bits 11–13 paired left/right cheek/ear;
- bits 14–16 chin;
- bits 17–19 mouth;
- bits 20–22 nose;
- bits 23–25 eyes/eyewear;
- bits 25–27 dynamic palette when the secondary control word is zero.

The eight dynamic palette sets are exact 12-bit RGB values written to palette indices 1–4. Full face-screen colours for indices 5–13 remain unresolved.

## Binary integrity and export development

- Preserve record dimensions and header values unless relocation has been explicitly designed and runtime-proven.
- Fixed-size pixel editing may patch the existing planar payload directly.
- Do not expose a modified executable export until editor mutations, planar re-encoding and byte-range validation are all implemented together.
- Keep a pristine copy of the loaded executable in memory and generate exports from a copy.
- A different executable version must not be silently treated as proven merely because known offsets happen to decode.
- If direct executable replacement becomes unsafe for a later feature, then investigate a WHDLoad override. Do not introduce WHDLoad merely because it was useful in another project.
