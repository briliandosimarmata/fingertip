# Working on Fingertip

This is a client-only, mobile-first shared-screen picker. Read `README.md`, `docs/APP.md`, and `docs/ARCHITECTURE.md` before changing gameplay. Read `docs/DESIGN.md` before changing colors or layout. The source package is intended to work independently of its original chat and hosted deployment.

## Development

- Use Node.js 22.13 or newer.
- Prefer the supplied pnpm lockfile: `pnpm install --frozen-lockfile`.
- `pnpm dev` starts Vite on port 5173 and listens on the local network for phone testing.
- `pnpm typecheck`, `pnpm test`, and `pnpm build` are the main checks.
- `pnpm preview` serves the production output after building.
- No API keys, credentials, backend, database, or special hosting runtime are needed.

## Source boundaries

- `app/page.tsx`: visible controls, pointer adapter, practice mode, and Canvas lifecycle.
- `app/globals.css`: theme and responsive layouts.
- `lib/game/engine.ts`: game rules, phases, membership, timing, and physics.
- `lib/game/identity.ts`: palette, symbols, and player identity style pairs.
- `lib/game/renderer.ts`: visual feedback; do not move game decisions into drawing code.
- `lib/game/audio.ts`: audio lifecycle and effects.
- `tests/engine.test.ts`: behavior checks using a repeatable random source and clock.

## Preserve these behaviors

1. Random Pick gives accepted participants equal probability. Movement affects animation, without biasing selection.
2. Pinball movement affects collisions and selection. Its final approach guarantees a visible landing on a ring.
3. New contacts cannot join during picking, except to reclaim a missing participant's ring.
4. A lift pauses the gathering or picking progress. Each missing participant has an independent five-second deadline.
5. Returning preserves number, color, symbol, elapsed progress, and any existing random selection.
6. Expiry removes that participant and restarts picking among survivors; fewer than two survivors reopen gathering.
7. Finger lifts after the revealed result cannot erase it.
8. Mode changes take effect only before a new round.
9. Audio remains optional and begins only following a user gesture.
10. Preserve clean component cleanup, Canvas sizing, and pointer-cancel handling.
11. Active rounds occupy the whole browser viewport with floating controls, safe-area offsets, and scrolling restored on exit. Keep the same Canvas mounted through setup/play transitions.
12. Each live player has a distinct color/symbol pair and an opaque external number. Do not convey identity or the winner through color alone, including when dimming nonwinners.

Keep the engine independent of React and browser rendering. Extend the existing accessible UI primitives when a suitable control exists. Keep the lockfile consistent with dependency changes and avoid unrelated cleanup. Update the relevant Markdown docs when changing rules or commands.

For gameplay edits, run the relevant behavior tests, typecheck, and production build. Real multitouch, audio, and comfort need a physical phone check; do not claim those passed based on unit tests or a simulated mouse alone. `docs/TESTING.md` records which checks were completed and the remaining checklist.

Build output in `dist/` and installed dependencies in `node_modules/` are generated. Do not edit them. A future Wasm implementation should keep the current engine boundary and prove a benefit with profiling before replacing the working simulation.
