# Fingertip

A mobile-first, shared-screen random picker. Each person holds one finger on the screen. Colored rings, numbers, and distinct symbols identify participants, and a bouncing ball lands on the selected finger. Active rounds fill the browser viewport, leaving more room for everyone.

Version 1.1 adds the approved minimal, playful design: a light setup screen, a dark edge-to-edge playfield, and small floating controls. The player palette uses the seven chromatic Okabe–Ito colors plus white, with numbers and shapes so identification never depends on color alone.

## Run locally

Use **Node.js 22.13 or newer**. Node.js 24 LTS is a suitable choice. The project includes a pnpm lockfile for reproducible installs.

```sh
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:5173**. You can also use `npm install` followed by `npm run dev` if you prefer npm; that creates an npm lockfile instead of using the supplied pnpm lockfile. Use one package manager consistently afterward.

No API keys, accounts, environment variables, server, or database are needed to run the app locally.

### Test on your phone

1. Connect the computer and phone to the same Wi-Fi network.
2. Run `pnpm dev`. The server listens on your network interfaces.
3. Use the Network address printed by Vite, for example `http://192.168.1.20:5173`, in the phone browser. Use your computer's actual address.
4. If the phone cannot connect, allow Node.js through the computer's firewall and check that your network permits devices to communicate.
5. Tap **Let’s pick!** with two or more people. The whole browser viewport becomes the play area. Use one finger per person, keep space between fingers, and avoid the edges and floating buttons.

An HTTPS host is preferable when sharing the app beyond your own network. There is no installation requirement, service worker, or offline cache in this version.

### Try it without a touch screen

Choose a mode and click **Try practice fingers**. Up to six simulated fingers join the same engine used by real touches, depending on available space. Drag a ring to move it. Select a numbered finger in the floating toolbar and click **Lift NN** to try the five-second pause. Click inside its countdown ring before it expires to return it. Practice fingers stay down when you release the mouse.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server, normally port 5173 |
| `pnpm build` | Build a static production website in `dist/` |
| `pnpm preview` | Serve the built website locally on port 4173 |
| `pnpm typecheck` | Check all TypeScript source |
| `pnpm test` | Run the game-engine and optional tool-contract tests |

The corresponding `npm run` commands work as well. Build before running preview. Do not open `index.html` directly from disk; use Vite or another HTTP server for the built output.

## Play

1. Choose **Random Pick** or **Pinball Play**, then tap **Let’s pick!**.
2. Place one finger per player within ten seconds. Each accepted touch gets a colored ring with an external number and symbol.
3. Hold your finger down while the ball bounces and slows over seven seconds.
4. The ball lands on the winning ring's edge so it remains visible around the fingertip.
5. Lift your fingers once the result appears. Tap **Again!** to reuse the mode, or **Change mode** to return to setup.

The board fills the browser's visible viewport, including when its height changes. It does not request native fullscreen or hide browser controls. Sound and close controls float over the board, and the available participant cap is recalculated from the expanded area and the device's reported touch capacity.

### The two modes

- **Random Pick:** every accepted participant has an equal chance. Finger movement changes the animation, without changing the selected participant. A temporary pause preserves that result. Removing an expired participant starts a fresh draw.
- **Pinball Play:** moving fingers act as moving bumpers and affect the ball's trajectory. During the last 1.2 seconds, a trajectory-based final approach locks onto a ring and follows it until landing. This guarantees a clear result. It is a playful, movement-influenced selection, not an equal-probability picker.

### Finger lifts

Gathering or picking pauses when a registered finger lifts or the browser cancels its contact. The last position gets a five-second countdown ring. A new contact within 50 CSS pixels of that position reclaims the same number, color, and symbol. Every missing finger must return before resuming.

If a finger's deadline expires, it leaves the round. During picking, the ball and draw restart from the beginning with the survivors. If fewer than two remain, gathering reopens. With multiple missing fingers, surviving missing fingers retain their own deadlines; the ball restarts only after all outstanding contacts are resolved.

The ten-second gathering timer waits for at least two players if it reaches zero. New players cannot join while picking. The revealed result is stable when people lift their fingers. Leaving the tab during an unfinished round resets it to setup, avoiding a stale result after browser suspension.

## Documentation

- [DEPLOYMENT.md](docs/DEPLOYMENT.md): production build, Nginx VPS deployment, HTTPS, and updates.
- [APP.md](docs/APP.md): rules, timings, controls, and behavior.
- [DESIGN.md](docs/DESIGN.md): viewport layout, palette, player symbols, and visual design guidance.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): source map, state transitions, physics, rendering, sound, and extension points.
- [TESTING.md](docs/TESTING.md): automated checks and a real-device test checklist.
- [CHANGELOG.md](CHANGELOG.md): changes in each release.
- [AGENTS.md](AGENTS.md): instructions for Codex CLI and other coding agents.

## Continue with Codex CLI

Extract the source ZIP into a folder, open a terminal there, and run `codex`. This project is self-contained; you do not need the conversation to understand it. `AGENTS.md` points the agent to the relevant files and checks.

For example:

> Read AGENTS.md and docs/ARCHITECTURE.md. Add a setting that lets players choose a 5-, 10-, or 15-second gathering countdown. Preserve the existing pause behavior and run the relevant checks.

You can initialize your own repository with `git init` and commit the source before making enhancements. The source ZIP excludes generated output, dependencies, runtime state, credentials, and the private hosted project's identity.

## Implementation

React, TypeScript, Vite, Canvas 2D, Pointer Events, Web Audio, and CSS. Device-local storage remembers the selected mode and sound toggle. All gameplay runs on the device. The project retains its starter's dependency catalog and lockfile; production bundling includes only imported code. No WebAssembly module is required for this workload. The isolated engine makes a later Wasm experiment possible without replacing the interface.
