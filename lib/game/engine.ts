import { randomIndex } from "./random.js";
import { playerStyle, type PlayerSymbol } from "./identity.js";
export { COLORS, PLAYER_STYLES } from "./identity.js";

export type Mode = "random" | "pinball";
export type Phase = "idle" | "gathering" | "picking" | "paused" | "winner";
export type SoundEvent = "join" | "tick" | "launch" | "bounce" | "pause" | "return" | "restart" | "winner";
export const RULES = {
  gatherMs: 10_000,
  pickMs: 7_000,
  pickExtraPlayerMs: 1_000,
  returnMs: 5_000,
  settleMs: 1_200,
  ringRadius: 30,
  ballRadius: 9,
  minSpacing: 86,
  reclaimRadius: 50,
};

export interface Player {
  id: number;
  pointerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  movedAt: number;
  color: string;
  symbol: PlayerSymbol;
  active: boolean;
  missingUntil: number | null;
  lastHitAt: number;
}
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  targetId: number | null;
  trail: { x: number; y: number }[];
}
export interface Snapshot {
  phase: Phase;
  mode: Mode;
  players: Player[];
  countdown: number;
  winnerId: number | null;
  pickDurationMs: number;
  notice: string;
  returnSeconds: number;
  demo: boolean;
}
type EngineOptions = {
  random?: (length: number) => number;
  sound?: (event: SoundEvent, playerId?: number) => void;
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const pickingDuration = (players: number) => RULES.pickMs + Math.max(0, players - 2) * RULES.pickExtraPlayerMs;

/** The simulation is independent of React, Canvas, and browser input. */
export class PickerEngine {
  phase: Phase = "idle";
  mode: Mode = "random";
  players: Player[] = [];
  ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, color: "#ffffff", targetId: null, trail: [] };
  width = 640;
  height = 480;
  pickDurationMs = RULES.pickMs;
  winnerId: number | null = null;
  demo = false;
  now = 0;
  gatherElapsed = 0;
  pickElapsed = 0;
  notice = "";
  private noticeUntil = 0;
  private previousNow: number | null = null;
  private pausedFrom: "gathering" | "picking" = "gathering";
  private restartPending = false;
  private nextId = 1;
  private lastCountdown = 10;
  private lastBounceAt = -1000;
  private lastHitId: number | null = null;
  private landingId: number | null = null;
  private landingFrom: { x: number; y: number } | null = null;
  private select: (length: number) => number;
  private sound: NonNullable<EngineOptions["sound"]>;

  constructor(options: EngineOptions = {}) {
    this.select = options.random ?? randomIndex;
    this.sound = options.sound ?? (() => {});
  }

  resize(width: number, height: number) {
    const oldWidth = this.width;
    const oldHeight = this.height;
    this.width = Math.max(160, width);
    this.height = Math.max(160, height);
    for (const player of this.players) {
      player.x = clamp(player.x / oldWidth * this.width, 34, this.width - 34);
      player.y = clamp(player.y / oldHeight * this.height, 34, this.height - 34);
    }
    this.ball.x = clamp(this.ball.x / oldWidth * this.width, 10, this.width - 10);
    this.ball.y = clamp(this.ball.y / oldHeight * this.height, 10, this.height - 10);
    if (this.landingFrom) {
      this.landingFrom.x = this.landingFrom.x / oldWidth * this.width;
      this.landingFrom.y = this.landingFrom.y / oldHeight * this.height;
    }
    if (this.phase === "winner") {
      const winner = this.players.find(p => p.id === this.winnerId);
      if (winner) {
        const angle = Math.atan2(this.ball.y - winner.y, this.ball.x - winner.x);
        this.ball.x = winner.x + Math.cos(angle) * (RULES.ringRadius + RULES.ballRadius);
        this.ball.y = winner.y + Math.sin(angle) * (RULES.ringRadius + RULES.ballRadius);
      }
    }
    this.ball.trail = [];
  }

  start(mode: Mode, now: number, demo = false) {
    this.reset();
    this.mode = mode;
    this.demo = demo;
    this.phase = "gathering";
    this.now = now;
    this.previousNow = now;
  }

  reset() {
    this.phase = "idle";
    this.players = [];
    this.winnerId = null;
    this.gatherElapsed = 0;
    this.pickElapsed = 0;
    this.pickDurationMs = RULES.pickMs;
    this.nextId = 1;
    this.lastCountdown = 10;
    this.previousNow = null;
    this.restartPending = false;
    this.landingId = null;
    this.landingFrom = null;
    this.notice = "";
    this.demo = false;
    this.ball.trail = [];
  }

  message(text: string, duration = 2200) {
    this.notice = text;
    this.noticeUntil = this.now + duration;
  }

  join(pointerId: number, x: number, y: number, now = this.now): number | null {
    this.now = now;
    if (this.phase === "idle" || this.phase === "winner") return null;
    if (this.players.some(p => p.active && p.pointerId === pointerId)) return null;
    // Enforce grace deadlines even if the renderer has not advanced yet.
    this.expireMissing();
    const missing = this.players.filter(p => !p.active && p.missingUntil !== null)
      .sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }));
    const returning = missing.find(p => distance(p, { x, y }) <= RULES.reclaimRadius);
    if (returning) {
      returning.pointerId = pointerId;
      returning.active = true;
      returning.missingUntil = null;
      returning.x = clamp(x, 34, this.width - 34);
      returning.y = clamp(y, 34, this.height - 34);
      returning.vx = 0;
      returning.vy = 0;
      returning.movedAt = now;
      this.sound("return", returning.id);
      this.resumeIfReady();
      return returning.id;
    }
    if (this.phase !== "gathering") {
      this.message(this.phase === "paused" ? "Place your finger inside its countdown ring." : "Picking has started. Join the next round.");
      return null;
    }
    if (this.players.some(p => distance(p, { x, y }) < RULES.minSpacing)) {
      this.message("A little more room. Move away from the other rings.");
      return null;
    }
    if (x < 34 || y < 34 || x > this.width - 34 || y > this.height - 34) {
      this.message("Place your finger a little farther from the edge.");
      return null;
    }
    const id = this.nextId++;
    let styleIndex = 0;
    let style = playerStyle(styleIndex);
    while (this.players.some(p => p.color === style.color && p.symbol === style.symbol)) {
      style = playerStyle(++styleIndex);
    }
    this.players.push({ id, pointerId, x, y, vx: 0, vy: 0, movedAt: now, color: style.color, symbol: style.symbol, active: true, missingUntil: null, lastHitAt: -1000 });
    this.sound("join", id);
    return id;
  }

  move(pointerId: number, x: number, y: number, now = this.now) {
    if (this.phase === "winner" || this.phase === "idle") return;
    const player = this.players.find(p => p.active && p.pointerId === pointerId);
    if (!player) return;
    x = clamp(x, 34, this.width - 34);
    y = clamp(y, 34, this.height - 34);
    const dt = Math.max(0.008, (now - player.movedAt) / 1000);
    player.vx = clamp((x - player.x) / dt, -1200, 1200);
    player.vy = clamp((y - player.y) / dt, -1200, 1200);
    player.x = x;
    player.y = y;
    player.movedAt = now;
    if (this.players.some(p => p.id !== player.id && distance(p, player) < RULES.minSpacing)) {
      this.message("Give each finger a little space.", 1000);
    }
  }

  release(pointerId: number, now = this.now) {
    if (this.phase === "idle" || this.phase === "winner") return;
    const player = this.players.find(p => p.active && p.pointerId === pointerId);
    if (!player) return;
    this.now = now;
    player.active = false;
    player.missingUntil = now + RULES.returnMs;
    if (this.phase !== "paused") {
      this.pausedFrom = this.phase;
      this.phase = "paused";
      this.sound("pause", player.id);
    }
    this.previousNow = now;
  }

  private expireMissing() {
    const expired = this.players.filter(p => p.missingUntil !== null && p.missingUntil <= this.now);
    if (!expired.length) return;
    this.players = this.players.filter(p => !expired.includes(p));
    this.restartPending = this.pausedFrom === "picking";
    this.message("A finger left. Starting fresh.");
    this.resumeIfReady();
  }

  private resumeIfReady() {
    if (this.phase !== "paused" || this.players.some(p => !p.active)) return;
    this.previousNow = this.now;
    if (this.players.length === 0 || (this.pausedFrom === "picking" && this.players.length < 2)) {
      this.phase = "gathering";
      this.gatherElapsed = 0;
      this.lastCountdown = 10;
      this.restartPending = false;
      this.winnerId = null;
      this.message("Waiting for at least two fingers.");
    } else if (this.restartPending) {
      this.beginPicking();
      this.sound("restart");
      this.restartPending = false;
    } else {
      this.phase = this.pausedFrom;
    }
  }

  advance(now: number) {
    this.now = now;
    const dtMs = this.previousNow === null ? 0 : Math.max(0, now - this.previousNow);
    this.previousNow = now;
    if (this.notice && now > this.noticeUntil) this.notice = "";
    if (this.phase === "paused") {
      this.expireMissing();
      return;
    }
    if (this.phase === "gathering") {
      this.gatherElapsed += dtMs;
      const seconds = Math.max(0, Math.ceil((RULES.gatherMs - this.gatherElapsed) / 1000));
      if (seconds !== this.lastCountdown) {
        if (seconds <= 3 && seconds > 0) this.sound("tick");
        this.lastCountdown = seconds;
      }
      if (this.gatherElapsed >= RULES.gatherMs && this.players.length >= 2) this.beginPicking();
    } else if (this.phase === "picking") {
      this.pickElapsed += dtMs;
      if (this.pickElapsed >= this.pickDurationMs - RULES.settleMs) {
        this.settle();
      } else if (this.mode === "random") {
        this.randomBounce(Math.min(dtMs / 1000, 0.1));
      } else {
        // Small substeps prevent a fast ball passing through a finger bumper.
        const steps = Math.max(1, Math.ceil(Math.min(dtMs, 120) / 8));
        for (let i = 0; i < steps; i++) this.physicsStep(Math.min(dtMs / 1000, 0.12) / steps);
      }
      this.ball.trail.push({ x: this.ball.x, y: this.ball.y });
      if (this.ball.trail.length > 18) this.ball.trail.shift();
    }
  }

  private beginPicking() {
    this.phase = "picking";
    this.pickElapsed = 0;
    this.pickDurationMs = pickingDuration(this.players.length);
    this.lastHitId = null;
    this.landingId = null;
    this.landingFrom = null;
    this.winnerId = this.mode === "random" ? this.players[this.select(this.players.length)].id : null;
    const angle = this.select(360) / 180 * Math.PI;
    this.ball = { x: this.width / 2, y: this.height / 2, vx: Math.cos(angle) * 700, vy: Math.sin(angle) * 700, color: "#ffffff", targetId: this.players[this.select(this.players.length)].id, trail: [] };
    if (this.mode === "pinball") {
      const target = this.players.find(p => p.id === this.ball.targetId)!;
      const dx = target.x - this.ball.x, dy = target.y - this.ball.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) { this.ball.vx = dx / d * 700; this.ball.vy = dy / d * 700; }
    }
    this.sound("launch");
  }

  private speed() {
    const progress = clamp(this.pickElapsed / (this.pickDurationMs - RULES.settleMs), 0, 1);
    return 880 - 650 * progress * progress;
  }

  private hit(player: Player) {
    player.lastHitAt = this.now;
    this.lastHitId = player.id;
    this.ball.color = player.color;
    if (this.now - this.lastBounceAt > 65) {
      this.sound("bounce", player.id);
      this.lastBounceAt = this.now;
    }
  }

  private randomBounce(dt: number) {
    const target = this.players.find(p => p.id === this.ball.targetId) ?? this.players[0];
    const dx = target.x - this.ball.x;
    const dy = target.y - this.ball.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed() * dt;
    this.ball.vx = dx / Math.max(1, d) * this.speed();
    this.ball.vy = dy / Math.max(1, d) * this.speed();
    if (d <= RULES.ringRadius + RULES.ballRadius + step) {
      const contactDistance = Math.max(0, d - RULES.ringRadius - RULES.ballRadius);
      this.ball.x += dx / Math.max(1, d) * contactDistance;
      this.ball.y += dy / Math.max(1, d) * contactDistance;
      this.hit(target);
      const otherPlayers = this.players.filter(p => p.id !== target.id);
      this.ball.targetId = otherPlayers[this.select(otherPlayers.length)].id;
    } else {
      this.ball.x += dx / d * step;
      this.ball.y += dy / d * step;
    }
  }

  private physicsStep(dt: number) {
    const ball = this.ball;
    const speed = this.speed();
    const currentSpeed = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx = ball.vx / currentSpeed * speed;
    ball.vy = ball.vy / currentSpeed * speed;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const r = RULES.ballRadius + 3;
    if (ball.x < r || ball.x > this.width - r) {
      ball.x = clamp(ball.x, r, this.width - r);
      ball.vx *= -1;
    }
    if (ball.y < r || ball.y > this.height - r) {
      ball.y = clamp(ball.y, r, this.height - r);
      ball.vy *= -1;
    }
    for (const player of this.players) {
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const d = Math.hypot(dx, dy);
      const collisionRadius = RULES.ringRadius + RULES.ballRadius;
      if (d >= collisionRadius) continue;
      const nx = d > 0.001 ? dx / d : 1;
      const ny = d > 0.001 ? dy / d : 0;
      ball.x = player.x + nx * (collisionRadius + 0.8);
      ball.y = player.y + ny * (collisionRadius + 0.8);
      // Only fresh motion adds an impulse; a stationary finger has no velocity.
      const fresh = this.now - player.movedAt < 100;
      const pvx = fresh ? player.vx * 0.28 : 0;
      const pvy = fresh ? player.vy * 0.28 : 0;
      const dot = (ball.vx - pvx) * nx + (ball.vy - pvy) * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
        this.hit(player);
      }
    }
  }

  /** The final target in Pinball follows geometry, never the fair-picker draw. */
  predictLanding(): Player | undefined {
    const b = this.ball;
    const velocity = Math.hypot(b.vx, b.vy) || 1;
    return [...this.players].sort((a, c) => {
      const score = (p: Player) => {
        const d = Math.max(1, distance(p, b));
        const alignment = ((p.x - b.x) * b.vx + (p.y - b.y) * b.vy) / (d * velocity);
        return alignment * 2 - d / Math.max(this.width, this.height) + (p.id === this.lastHitId ? 0.12 : 0);
      };
      return score(c) - score(a);
    })[0];
  }

  private settle() {
    if (this.landingId === null) {
      this.landingId = this.mode === "random" ? this.winnerId : this.predictLanding()?.id ?? null;
      this.landingFrom = { x: this.ball.x, y: this.ball.y };
    }
    const target = this.players.find(p => p.id === this.landingId);
    if (!target || !this.landingFrom) return;
    const t = clamp((this.pickElapsed - (this.pickDurationMs - RULES.settleMs)) / RULES.settleMs, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const from = this.landingFrom;
    const angle = Math.atan2(from.y - target.y, from.x - target.x);
    // Land on the rim so the ball stays visible around the fingertip.
    const x = target.x + Math.cos(angle) * (RULES.ringRadius + RULES.ballRadius);
    const y = target.y + Math.sin(angle) * (RULES.ringRadius + RULES.ballRadius);
    this.ball.x = from.x + (x - from.x) * eased;
    this.ball.y = from.y + (y - from.y) * eased;
    this.ball.color = target.color;
    if (t === 1) {
      this.winnerId = target.id;
      this.phase = "winner";
      this.hit(target);
      this.sound("winner", target.id);
    }
  }

  snapshot(): Snapshot {
    const missing = this.players.filter(p => p.missingUntil !== null);
    return {
      phase: this.phase,
      mode: this.mode,
      players: this.players.map(p => ({ ...p })),
      countdown: Math.max(0, Math.ceil((RULES.gatherMs - this.gatherElapsed) / 1000)),
      winnerId: this.phase === "winner" ? this.winnerId : null,
      pickDurationMs: this.phase === "gathering" || (this.phase === "paused" && this.pausedFrom === "gathering") ? pickingDuration(this.players.length) : this.pickDurationMs,
      notice: this.notice,
      returnSeconds: missing.length ? Math.max(0, Math.ceil((Math.min(...missing.map(p => p.missingUntil!)) - this.now) / 1000)) : 0,
      demo: this.demo,
    };
  }
}
