# Changelog

## Unreleased

### Deployment

- Add automatic GitHub Pages deployment for every push to `main`.
- Add a dedicated static export build and verification test for the `/bead-grid` base path.

### Features

- Add visible aspect-ratio locking, common grid presets, and 5 mm finished-size estimates.
- Autosave editable projects locally and restore the latest draft on return.
- Import validated JSON projects and export material lists as CSV with a 10% reserve estimate.
- Preserve artwork when resizing imported or manually edited projects, including dimension-aware undo and redo.
- Add click, drag-box, and long-press trajectory selection for existing beads.
- Add a contextual batch toolbar for recoloring, removing, selecting all, and clearing selections.
- Standardize all interface action icons on the Lucide icon library.

### Fixes

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
