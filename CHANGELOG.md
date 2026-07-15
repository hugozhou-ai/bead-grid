# Changelog

## Unreleased

### Deployment

- Add automatic GitHub Pages deployment for every push to `main`.
- Add a dedicated static export build and verification test for the `/bead-grid` base path.

### Fixes

- Fit the entire canvas into the available desktop or mobile workspace by default.
- Keep every edge of a manually zoomed canvas reachable inside the scroll area.
- Center fit-mode canvases against the mobile viewport instead of their intrinsic content width.
- Redraw the canvas at the active zoom and device pixel ratio so bead labels remain sharp.
- Add two-finger pinch zoom on touch devices and Command/Control plus wheel zoom on desktop.
- Add one-finger canvas panning while preserving tap-to-edit behavior on touch devices.

## 0.1.0 - 2026-07-15

### Features

- Convert uploaded images into editable fuse-bead patterns entirely in the browser.
- Configure grid dimensions and palette size with responsive mobile and desktop layouts.
- Edit patterns with paint, erase, color picker, undo, redo, grid, labels, and zoom controls.
- Export labeled PNG patterns and JSON project files with real-time material counts.
