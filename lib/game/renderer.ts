import { PLAYER_STYLES, RULES, type PickerEngine, type Player } from "./engine.js";
import type { PlayerSymbol } from "./identity.js";

const TAU = Math.PI * 2;
const BOARD = "#111A2C";
const START = "#F7F9FD";
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
}
function symbol(ctx: CanvasRenderingContext2D, name: PlayerSymbol, x: number, y: number, r: number) {
  ctx.save(); ctx.translate(x, y); ctx.beginPath();
  if (name === "square") ctx.rect(-r, -r, r * 2, r * 2);
  else if (name === "plus" || name === "cross") {
    if (name === "cross") ctx.rotate(Math.PI / 4);
    ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
  } else if (name === "crescent") {
    ctx.moveTo(r * .35, -r);
    ctx.bezierCurveTo(-r * 1.5, -r, -r * 1.5, r, r * .35, r);
    ctx.bezierCurveTo(-r * .35, r * .45, -r * .35, -r * .45, r * .35, -r);
  } else {
    const points = name === "star" ? 10 : name === "triangle" ? 3 : name === "hexagon" ? 6 : 4;
    for (let i = 0; i < points; i++) {
      const a = i / points * TAU - Math.PI / 2;
      const radius = name === "star" && i % 2 ? r * .45 : r;
      const sx = Math.cos(a) * radius, sy = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
  }
  if (name !== "plus" && name !== "cross") ctx.fill();
  ctx.restore();
}
function label(ctx: CanvasRenderingContext2D, p: Player, r: number, width: number, height: number, players: Player[]) {
  const side = p.x < width / 2 ? -1 : 1;
  const candidates = [
    { x: p.x + side * (r + 23), y: p.y - 2 },
    { x: p.x - side * (r + 23), y: p.y - 2 },
    { x: p.x, y: p.y + r + 23 },
    { x: p.x, y: p.y - r - 35 },
  ];
  const inside = candidates.filter(c => c.x >= 17 && c.x <= width - 17 && c.y >= 18 && c.y <= height - 26);
  const position = inside.find(c => players.every(other => other.id === p.id || Math.hypot(c.x - other.x, c.y + 7 - other.y) > RULES.ringRadius + 23)) ?? inside[0] ?? { x: Math.max(17, Math.min(width - 17, p.x)), y: Math.max(18, Math.min(height - 26, p.y + r + 20)) };
  // Opaque white labels stay readable even when nonwinning rings dim.
  ctx.save(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.fillStyle = "#F7F9FD"; ctx.strokeStyle = "#F7F9FD";
  ctx.font = "750 15px ui-rounded, system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText(String(p.id).padStart(2, "0"), position.x, position.y);
  symbol(ctx, p.symbol, position.x, position.y + 17, 6.5);
  ctx.restore();
}
function ring(ctx: CanvasRenderingContext2D, p: Player, now: number, selected: boolean, dim: boolean, reducedMotion: boolean, width: number, height: number, players: Player[], showLabel: boolean) {
  ctx.save();
  const pulse = reducedMotion ? 0 : Math.sin(now / 520 + p.id) * 1.5;
  const r = RULES.ringRadius + (selected ? 5 : 0);
  ctx.globalAlpha = dim ? .35 : p.active ? 1 : .7;
  const gradient = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, r + 40);
  gradient.addColorStop(0, p.color + "20"); gradient.addColorStop(.5, p.color + "16"); gradient.addColorStop(1, p.color + "00");
  ctx.fillStyle = gradient; circle(ctx, p.x, p.y, r + 40); ctx.fill();
  ctx.strokeStyle = p.color + "20"; ctx.lineWidth = 1;
  circle(ctx, p.x, p.y, r + 8 + pulse); ctx.stroke();
  ctx.shadowColor = p.color; ctx.shadowBlur = selected || now - p.lastHitAt < 180 ? 22 : 11;
  ctx.strokeStyle = p.color; ctx.lineWidth = selected ? 4 : 3;
  circle(ctx, p.x, p.y, r); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = p.color + (showLabel ? "09" : "28"); circle(ctx, p.x, p.y, r - 3); ctx.fill();
  if (!p.active && p.missingUntil !== null) {
    const remaining = Math.max(0, p.missingUntil - now);
    ctx.strokeStyle = p.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * remaining / RULES.returnMs); ctx.stroke();
    ctx.fillStyle = BOARD; circle(ctx, p.x, p.y, 20); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "750 23px ui-rounded, system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(Math.ceil(remaining / 1000)), p.x, p.y + 8);
  }
  if (selected && !reducedMotion) {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + now / 6000;
      const spread = 55 + Math.sin(now / 1000 + i) * 9;
      ctx.fillStyle = p.color + "b0";
      circle(ctx, p.x + Math.cos(a) * spread, p.y + Math.sin(a) * spread, i % 3 === 0 ? 2.5 : 1.5); ctx.fill();
    }
  }
  ctx.restore();
  if (showLabel) label(ctx, p, r, width, height, players);
}

export function drawGame(ctx: CanvasRenderingContext2D, engine: PickerEngine, now: number, reducedMotion = false) {
  const { width: w, height: h } = engine;
  const idle = engine.phase === "idle";
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = idle ? START : BOARD; ctx.fillRect(0, 0, w, h);
  let players = engine.players;
  if (idle) {
    const r = Math.min(w * .27, h * .29, 90);
    players = [0, 2, 1].map((styleIndex, n) => {
      const a = [-Math.PI / 2, Math.PI * 5 / 6, Math.PI / 6][n];
      return { id: n + 1, x: w / 2 + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r, ...PLAYER_STYLES[styleIndex], active: true, missingUntil: null, lastHitAt: -1000 } as Player;
    });
  }
  if (engine.ball.trail.length && !reducedMotion && !idle) {
    const points = engine.ball.trail;
    for (let i = 1; i < points.length; i++) {
      ctx.strokeStyle = "#FFFFFF" + Math.round(i / points.length * 80).toString(16).padStart(2, "0");
      ctx.lineWidth = 2 + i / points.length * 4;
      ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(points[i - 1].x, points[i - 1].y); ctx.lineTo(points[i].x, points[i].y); ctx.stroke();
    }
  }
  players.forEach(p => ring(ctx, p, now, engine.phase === "winner" && p.id === engine.winnerId, engine.phase === "winner" && p.id !== engine.winnerId, reducedMotion, w, h, players, !idle));
  if (idle || engine.phase === "picking" || engine.phase === "paused" || engine.phase === "winner") {
    let x = engine.ball.x, y = engine.ball.y;
    if (idle) {
      const progress = reducedMotion ? .45 : (now / 1800) % 3;
      const from = players[Math.floor(progress)], to = players[(Math.floor(progress) + 1) % 3], t = progress % 1;
      x = from.x + (to.x - from.x) * t; y = from.y + (to.y - from.y) * t;
    }
    if (engine.phase !== "paused" || engine.pickElapsed > 0) {
      ctx.save(); ctx.shadowColor = idle ? "#577BAA88" : "#FFFFFF88"; ctx.shadowBlur = idle ? 8 : 16;
      ctx.fillStyle = "#FFFFFF"; circle(ctx, x, y, RULES.ballRadius); ctx.fill(); ctx.restore();
    }
  }
}
