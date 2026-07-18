# Changelog

## Unreleased

### Deployment

- Add automatic GitHub Pages deployment for every push to `main`.
- Add a dedicated static export build and verification test for the `/bead-grid` base path.

### Features

- Raise the grid limit to 160×160 and expand the general palette and color limit from 16 to 32 colors.
- Sample multiple source pixels per bead and choose the modal palette code instead of averaging each region during image downscaling.
- Size PNG exports dynamically from the grid dimensions so dense patterns retain sharp grids and color codes.
- Ask for the project name only when saving and keep it out of the regular settings panel.
- Use self-hosted LXGW WenKai for headings, body copy, and Canvas color codes; keep tiny supporting text in the system UI font for legibility.
- Redesign the complete interface with warm sketchbook paper, fountain-pen linework, irregular hand-drawn controls, and a matching social preview card.
- Render beads and grid lines with deterministic hand-inked variations while preserving color-code readability at every zoom level.
- Add visible aspect-ratio locking, common grid presets, and 5 mm finished-size estimates.
- Autosave editable projects locally and restore the latest draft on return.
- Import validated JSON projects and export material lists as CSV with a 10% reserve estimate.
- Preserve artwork when resizing imported or manually edited projects, including dimension-aware undo and redo.
- Add click, drag-box, and long-press trajectory selection for existing beads.
- Add a contextual batch toolbar for recoloring, removing, selecting all, and clearing selections.
- Standardize all interface action icons on the Lucide icon library.

### Fixes

- Hide scrollbars throughout the page while preserving touch, wheel, trackpad, and keyboard scrolling.
- Scope WebKit scrollbar styling to real scroll containers so mobile Safari continues painting the canvas workspace.
- Route horizontal touch gestures on the mobile color strip to its own scroller so every swatch remains reachable.
- Contain the 32-color strip within the mobile panel so its intrinsic width cannot push the centered canvas outside the viewport.
- Reduce the aspect-ratio lock control to a lightweight icon-only action with an accessible label.
- Fit the entire canvas into the available desktop or mobile workspace by default.
- Keep every edge of a manually zoomed canvas reachable inside the scroll area.
- Center fit-mode canvases against the mobile viewport instead of their intrinsic content width.
- Redraw the canvas at the active zoom and device pixel ratio so bead labels remain sharp.
- Add two-finger pinch zoom on touch devices and Command/Control plus wheel zoom on desktop.
- Add one-finger canvas panning while preserving tap-to-edit behavior on touch devices.
- Prevent browser-level zoom while wheel or trackpad gestures originate inside the canvas workspace.

## 0.1.0 - 2026-07-15

### Features

- Convert uploaded images into editable fuse-bead patterns entirely in the browser.
- Configure grid dimensions and palette size with responsive mobile and desktop layouts.
- Edit patterns with paint, erase, color picker, undo, redo, grid, labels, and zoom controls.
- Export labeled PNG patterns and JSON project files with real-time material counts.
