export const PLAYER_STYLES = [
  { color: "#56B4E9", symbol: "triangle" },
  { color: "#E69F00", symbol: "diamond" },
  { color: "#CC79A7", symbol: "star" },
  { color: "#009E73", symbol: "square" },
  { color: "#F0E442", symbol: "plus" },
  { color: "#D55E00", symbol: "crescent" },
  { color: "#0072B2", symbol: "hexagon" },
  { color: "#FFFFFF", symbol: "cross" },
] as const;

// Okabe–Ito's seven chromatic colors; white replaces black on the dark board.
// Numbers and symbols convey identity independently of these colors.
export const COLORS = PLAYER_STYLES.map(style => style.color);
export type PlayerSymbol = (typeof PLAYER_STYLES)[number]["symbol"];

/** Extend the original palette without imposing a participant limit. */
export function playerStyle(index: number): { color: string; symbol: PlayerSymbol } {
  const size = PLAYER_STYLES.length;
  const base = PLAYER_STYLES[index % size];
  if (index < size * size) {
    // All 64 color/symbol pairs, starting with the original eight styles.
    return { color: base.color, symbol: PLAYER_STYLES[(index + Math.floor(index / size)) % size].symbol };
  }
  // Golden-angle hues with bright channels; keep hex for Canvas alpha suffixes.
  const hue = ((index - size * size) * 137.50776405003785 % 360) / 30;
  const channel = (offset: number) => {
    const k = (offset + hue) % 12;
    const value = .72 - .196 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return { color: `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase(), symbol: base.symbol };
}
