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
// Numbers and distinct symbols convey identity independently of these colors.
export const COLORS = PLAYER_STYLES.map(style => style.color);
export type PlayerSymbol = (typeof PLAYER_STYLES)[number]["symbol"];
