# Changelog

## 1.1.0

- Expanded gathering, picking, paused rounds, and results to fill the browser viewport. Setup no longer occupies play space; controls float over the Canvas with safe-area offsets.
- Replaced the palette with the seven chromatic Okabe–Ito colors plus white. Every participant has an external number and distinct geometric symbol, retained through finger returns. Vacant styles are reused without duplicating live styles.
- Redesigned setup with a light background, rounded typography, a segmented mode choice, a single “Let’s pick!” action, and a minimal practice link. The dark playfield and result use short, playful copy.
- Expanded practice to up to six simulated fingers, subject to space, and guarded against delayed practice seeding after a reset.
- Preserved participant identity and final-approach geometry when the board resizes. A revealed result keeps its ball on the selected ring rim.
- Added three behavior tests, design documentation, and updated local-testing and Codex CLI guidance.

## 1.0.0

- Initial React, TypeScript, Vite, and Canvas app with Random Pick and Pinball Play.
- Ten-second gathering, seven-second selection, independent five-second return grace, sound effects, and desktop practice.
- Local-run documentation, an isolated tested engine, and optional browser agent tools.
