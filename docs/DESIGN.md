# Design guide

## Intent

Fingertip should feel like a small party game: one clear action, friendly rounded type, generous space, and playful rings. Setup is cool white; play is navy so colored rings and the white ball stand out. Avoid adding a sidebar, persistent setup card, or footer that reduces the active Canvas area.

## Layout

- **Setup:** `fingertip.` wordmark, sound/help controls, “Who’s up?”, a small animated example, two-mode segmented control, “Let’s pick!”, and a practice link.
- **Active:** a fixed edge-to-edge Canvas sized to the browser viewport. A mode label and sound/close controls float at the top; countdown and short instructions pass touches through to the board.
- **Result:** the same board remains visible, the selected ring glows, and “You’re picked!” with its number and symbol appears above. “Again!” and “Change mode” float at the bottom.
- **Practice:** a compact floating toolbar chooses a simulated finger and lifts it. Practice uses the normal game rules.

`100dvh` tracks the mobile browser's changing visible height, with `100vh` as a fallback. Safe-area offsets keep buttons clear of notches and home indicators. Body scrolling is disabled during play and restored on exit. This layout does not use the Fullscreen API or promise to hide browser controls.

The board's measured dimensions feed input coordinates. Keep `ResizeObserver`, the single mounted Canvas, and the pointer adapter's size synchronization intact when changing the layout. There is no software participant maximum or screen-area count cap. Minimum finger spacing, edge margins, and actual device/browser touch capabilities still affect physical play. Show player count and the upcoming bounce duration in the floating hint during gathering.

## Player palette and symbols

These pairs live in `lib/game/identity.ts`. The first eight admissions use this order; after an expiration, a new participant may reuse a vacant style with a new number.

| Style slot | Color | Hex | Independent symbol |
| --- | --- | --- | --- |
| 1 | Sky blue | `#56B4E9` | Triangle |
| 2 | Orange / amber | `#E69F00` | Diamond |
| 3 | Reddish purple | `#CC79A7` | Star |
| 4 | Bluish green | `#009E73` | Square |
| 5 | Yellow | `#F0E442` | Plus |
| 6 | Vermillion | `#D55E00` | Crescent |
| 7 | Blue | `#0072B2` | Hexagon |
| 8 | White | `#FFFFFF` | Cross |

The seven chromatic colors come from Masataka Okabe and Kei Ito's [Color Universal Design guidance](https://jfly.uni-koeln.de/color/). White replaces that palette's black for visibility on the dark playfield. The palette is intended to improve differentiation for many people with color-vision deficiency; no palette guarantees that every pair is distinguishable for every observer.

Every participant also has a stable number and geometric symbol. Both are opaque white on the playfield and appear outside the finger ring. The renderer tries the outward side, the opposite side, then below/above, avoiding edges and neighboring finger centers where space permits. Keep these cues visible during pauses and when nonwinning rings dim. The winner's number and symbol also appear in DOM text/icon feedback. This follows the [WCAG guidance on using color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) as one cue among several.

Label offsets and horizontal edge bounds use the measured number width so longer participant numbers remain inside the board.

Returning within the grace period preserves number, color, and symbol. New admissions choose an unused style, so the live group stays distinct even after a removed participant's slot is reused.

For larger groups, `playerStyle` rotates the eight symbols against the eight base colors to provide 64 distinct pairs. Beyond those combinations, it generates hex colors using golden-angle hues, 70% saturation, and 72% lightness, paired with the same symbols. Generated color rounding can produce repeated colors, so the engine checks the final color/symbol pair against live participants before admission. The full group may share an individual color or symbol; the pair and opaque number carry identity. Numbers remain the unique cue in grayscale. Generated colors retain the six-digit hex representation required by the Canvas glow renderer.

## Theme values

| Use | Color |
| --- | --- |
| Setup background | `#F7F9FD` |
| Setup primary text | `#15203A` |
| Setup muted text | `#5B6F8C` |
| Primary action / selected mode | `#0962F4` |
| Playfield | `#111A2C` |
| Playfield primary text | `#F7F9FD` |
| Playfield secondary text | `#B1BED2` |
| Picker ball | `#FFFFFF` |

Use the local/system rounded font stack; the app does not download a web font. Controls have pill or circular outlines. Small glows, bounce trails, and winner particles provide playfulness without adding interface clutter. Reduced-motion preference removes decorative motion while keeping essential ball movement.

## Before changing the design

Check solid-color contrast, grayscale identity, common color-vision simulations, real fingertip occlusion, near-edge labels, portrait/landscape layouts, and safe areas. Automated color calculations are recorded in `TESTING.md`; they do not replace browser and phone review. Preserve simple setup, full play space, and redundant player identity as more features are added.
