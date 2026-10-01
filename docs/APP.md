# App behavior

## Purpose

Replace typing participant names with one touch per participant on a shared phone or tablet. The game runs entirely in the browser and uses distinct color/symbol pairs and external numbers so color alone is not required to identify the selected contact.

## Opening screen

- Select one of two modes using the rounded segmented control. Keyboard arrow keys work within the mode radio group.
- Random Pick is the default for a first visit; the last mode is remembered on that device.
- **Let’s pick!** begins gathering immediately, rather than waiting for the first finger.
- **Try practice fingers** creates up to six simulated persistent contacts for desktop testing, subject to available space.
- Sound can be muted at any time. The help button explains the full flow before a round.

## Full-viewport play

Gathering, picking, pauses, and the result use the entire browser viewport. Setup disappears, the Canvas expands, and body scrolling is locked until returning to setup. A mode label, sound toggle, and close control float at the top. Countdown and result messages float over the board without intercepting touches. The result has **Again!** and **Change mode** buttons at the bottom.

Dynamic viewport units and safe-area offsets accommodate mobile browser controls and display notches. This is a browser-viewport layout, not a native fullscreen request. Touch admission still requires room between fingers and a margin from the edge. The small floating buttons remain control areas.

## Timings and geometry

These values live in `RULES` in `lib/game/engine.ts`.

| Setting | Value |
| --- | --- |
| Gathering countdown | 10 seconds |
| Ball animation | 7 seconds for two players, plus 1 second per additional player |
| Return grace for each missing finger | 5 seconds |
| Final landing approach | Last 1.2 seconds of ball animation |
| Finger-ring radius | 30 CSS pixels |
| Ball radius | 9 CSS pixels |
| Minimum admission distance between finger centers | 86 CSS pixels |
| Return contact's maximum distance from its missing ring | 50 CSS pixels |
| Edge margin for finger centers | 34 CSS pixels |
| Maximum logical participants | No software cap |

Admission does not cap the count based on screen area or reported touch capacity. A contact too near another ring or an edge is rejected with an instruction to move. Keeping the rejected contact down and moving it to an eligible location retries admission. Moving an accepted contact toward another ring produces a spacing reminder; it does not silently remove or relocate either player. Actual simultaneous contacts remain subject to device/browser capabilities and physical room.

Both modes use the accepted participant count when picking starts to fix that run's duration: two players take 7 seconds, four take 9 seconds, eight take 13 seconds, and twelve take 17 seconds. Gathering shows the upcoming duration. A pause/return preserves the duration and elapsed progress. An expiration restarts picking with a newly calculated duration for the survivors, after all missing contacts are resolved. The final landing approach remains 1.2 seconds.

CSS pixels do not guarantee a particular physical finger spacing on every screen. Tune spacing after real-device testing. The app identifies touch contacts, not people, so one finger per person is a social rule.

## Round states

- `idle`: setup and an animated example board. No participants are registered.
- `gathering`: contacts can join while the gathering countdown runs. After it ends, the app waits if fewer than two contacts are present.
- `picking`: admission is locked, fingers can move, and the ball bounces and slows.
- `paused`: at least one contact is missing. Gathering time or ball progress freezes, while each missing contact's independent grace timer continues.
- `winner`: the ball has landed and the result is frozen. Finger releases no longer affect it.

Let’s pick! and Again! clear the participant list and begin a new gathering countdown. Change mode or the header's close control returns to setup. Mode cannot change during an active round. Muting sound does not change timing or the result.

## Pause examples

**One finger returns:** Finger 02 lifts two seconds into picking. The ball freezes. They touch their countdown ring after three seconds. Finger 02 keeps its number, color, and symbol; the ball continues from the same point, with the same Random Pick winner.

**One finger does not return:** Finger 02 misses the five-second deadline. Its ring disappears. With at least two remaining contacts, the ball begins a new animation timed for the survivor count, and Random Pick draws again among the survivors. A four-player run takes nine seconds; losing one player restarts it as an eight-second run for three players.

**Several fingers lift:** Each missing ring has its own deadline. Returning just one does not resume the game. If another expires, a restart is queued and occurs after all remaining missing contacts either return or expire.

**Only one survives:** The existing contact is retained and a new ten-second gathering phase starts. Additional people can place fingers and join.

## Sound and accessibility

Effects are synthesized: joining notes, final countdown ticks, a launch arpeggio, short bounce notes, pause and return tones, and a winner flourish. Audio starts only after a user gesture. If audio is unavailable, the complete game still works visually.

Buttons have accessible names. Mode selection uses a radio group and help uses a dialog with focus management. Essential status text is outside Canvas. Every finger has a distinct color/symbol pair and an opaque white number, placed outside its ring so the fingertip does not cover the identity. Larger groups can share individual colors or symbols; numbers uniquely identify every participant. Labels try alternative positions near screen edges and nearby fingers. Symbols and numbers remain visible when nonwinning rings dim.

The palette starts with Okabe–Ito's seven chromatic colors, with white replacing black for visibility on the dark board. Additional participants use new combinations of those colors and symbols, then generated bright colors when those pairs are occupied. The independent numbers and shapes are essential when colors remain hard to distinguish. See [DESIGN.md](DESIGN.md) for exact values and credits. A returned contact keeps its original style. New participants reuse vacant styles so the live group has distinct color/symbol pairs.

Reduced-motion preference disables decorative pulses, trails, and celebration particles; essential ball movement remains visible. Touch interaction is inherently required for a real shared-screen round; the desktop practice controls provide a way to explore the flow with a mouse. Physical-device accessibility and comfort still need the checks in [TESTING.md](TESTING.md).

## Data

Only `fingertip.mode` and `fingertip.sound` are saved in local storage. Participants, coordinates, results, and round progress remain in memory and are cleared on refresh. There are no accounts, analytics, network calls for gameplay, server storage, or result history.
