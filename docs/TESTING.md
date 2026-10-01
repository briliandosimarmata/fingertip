# Testing

## Automated checks

```sh
pnpm typecheck
pnpm test
pnpm build
```

The engine tests run with injected repeatable random choices and a synthetic monotonic clock. They do not depend on a display or a browser and cover:

- Minimum participant count, gathering expiry, and locked late admissions.
- Finger spacing and edges without a screen-area or numeric participant cap.
- Player-count-dependent timing in both modes, including continued bouncing beyond seven seconds, final landing, pause/return, and survivor restarts.
- Paused timers, returning pointer IDs, and preserving a Random Pick winner.
- Independent missing-finger deadlines, expirations, and fresh picking runs.
- Reopening gathering when fewer than two remain.
- Freezing a revealed winner and clearing the next round.
- Movement leaving Random Pick odds unchanged.
- Positions affecting Pinball landing, physical collisions, and a finite final position.
- Hiding unrevealed selections in public snapshots.
- Viewport expansion preserving participant coordinates and identity.
- Unique live color/symbol pairs for 100 participants, including a replacement after expiration and a return.
- Every participant beyond the old eight-player cap remaining eligible for Random Pick.
- A revealed result staying selected and on its ring rim after resize.
- Cryptographic index range validation.
- Optional agent-tool registration contracts, invalid inputs, shared state, and cleanup.

Version 1.1 passes 18 behavioral tests and TypeScript validation. The production build produces a static bundle. Development-server startup was checked in the build environment.

Production packaging was checked locally on 2026-10-02 using Node.js 24.20.0 and pnpm 11.25.0: TypeScript validation, all 18 tests, and `pnpm build` passed. The generated HTML, JavaScript, and CSS responded successfully through Vite's production preview, and the deployment archive contained only the static build files. The supplied VPS configuration still requires `nginx -t` and HTTP/HTTPS checks on the target server; Nginx was not installed on the local computer. These HTTP checks do not replace browser or physical-phone testing.

The subsequent player-cap and variable-duration enhancement passes all 33 behavior tests, TypeScript validation, and the production build. Its checks include admission of 12 spaced contacts on a 380×260 board, 100 simulated identities, and both modes' timing, continued bouncing, final-approach returns, and survivor restarts. The production archive was regenerated. Browser layout, actual device touch counts, audio, and physical comfort remain unverified for this change.

An sRGB relative-luminance calculation checked the full-opacity base palette against the dark `#111A2C` board: the lowest ratio is 3.35:1. Sampling the first 1,000 generated larger-group colors gave a lowest ratio of 5.47:1. Setup's muted `#5B6F8C` text on `#F7F9FD` is 4.86:1, and white primary-button text on `#0962F4` is 5.17:1. These checks cover those solid color pairs, not every rendered or translucent UI state. The opaque white numbers and symbols identify participants independently of color. Color-vision simulations, label placement, and visual comfort still need browser review.

## Checks still requiring a browser or real device

A physical multitouch session, audible sound quality, visual layout inspection, and browser-specific gesture handling have not been verified in this build environment. Browser automation was unavailable. The optional agent API was validated with a contract mock, not in a live browser that implements the proposed API. Do not treat these checks as completed solely because the engine tests pass.

Test on current iOS Safari and Android Chrome, plus a tablet if available. The following checklist is intentionally concrete:

1. At 320–430 CSS pixels wide, verify that **Let’s pick!** is easy to reach and no content scrolls horizontally. At a short viewport, vertical scrolling on setup is allowed. During play, the Canvas should fill the visible viewport without page scrolling or a setup panel.
2. Start each mode with 2, 3, and 4 real fingers, then try more than eight on hardware supporting that many touches. Check that all accepted contacts have distinct color/symbol pairs and unique external white numbers. There is no app count cap; actual contacts still depend on device/browser capabilities and available spacing. Larger groups can share an individual color or symbol.
3. Place two fingers close together. The new contact should get a spacing message; moving it away while still touching should register it.
4. Hold two fingers through the ten-second gathering timer and seven-second picking animation. Repeat with four players (nine-second animation) and more players. Check the displayed duration during gathering, sound effects, and final visible ball on a ring rim in both modes.
5. In Random Pick, move both fingers during picking. The predetermined selection should remain consistent with the engine rule; a small number of rounds does not establish statistical fairness.
6. In Pinball, move a finger into the ball path before the final approach. Look for a changed outgoing bounce. The final target remains locked during the last 1.2 seconds.
7. Lift one finger during gathering and return within five seconds. The gathering timer should continue from its previous point.
8. Lift during picking and return within five seconds. The ball should resume with its original duration and elapsed progress. Repeat during the final approach in both modes.
9. Lift during picking and do not return. Its ring should expire, and the remaining players should get a fresh run timed for the survivor count.
10. Lift two fingers at different times. Verify distinct return timers and no resume while one remains missing.
11. Drop to one participant after expiry. Verify gathering reopens and admits another finger.
12. After the winner appears, lift every finger. The result must remain visible. **Again!** must start a new gathering phase, and **Change mode** must restore setup and normal scrolling.
13. Mute before starting and during a round. Confirm visual play still works and the preference survives a refresh.
14. Rotate the device during a round and show/hide the browser controls. Verify the board follows viewport height, rings stay inside it, identity remains stable, and the interface remains usable. Rotate a revealed result too: the ball must remain on the selected rim. Reorientation may cause the browser to cancel touches, which should use the normal return flow.
15. Switch tabs during a round and return. It should show setup rather than continuing a stale round.
16. Test portrait and landscape, larger text, reduced-motion preference, and a device with a display notch. Floating controls must remain reachable inside safe areas while leaving the Canvas full-size.
17. On desktop, run **Try practice fingers**, confirm up to six rings appear where space permits, drag a ring, lift it with the control, return it by clicking the ring, then let another ring expire.
18. Navigate setup by keyboard. Verify mode radio selection and the help dialog's focus handling.
19. Inspect in grayscale and with protanopia, deuteranopia, and tritanopia simulations. Identify the winner using only its number and symbol, including larger groups sharing an individual symbol. Check external labels near each edge, near another finger, during a pause, and after nonwinning rings dim. Confirm labels remain outside real fingertips where space permits. Check three-digit and longer numbers in a simulated large group.
20. End a practice round immediately after starting it, then begin a real round. No scheduled simulated contact should appear in the new round.

## Regressions worth keeping

When a rule changes, add a test of its externally visible behavior, rather than a test that repeats the implementation formula. Tests are most useful for timer transitions and membership changes. Keep manual-device checks for browser input and physical comfort.
