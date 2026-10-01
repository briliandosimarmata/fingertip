import test from "node:test";
import assert from "node:assert/strict";
import { PickerEngine, RULES, type Mode } from "../lib/game/engine.js";
import { randomIndex } from "../lib/game/random.js";
import { registerGameTools } from "../lib/game/webmcp.js";

function round(mode: Mode = "random", count = 4) {
  const game = new PickerEngine({ random: length => length - 1 });
  game.resize(640, 480);
  game.start(mode, 0);
  [[120, 120], [520, 120], [120, 360], [520, 360]].slice(0, count).forEach(([x, y], i) => game.join(i + 10, x, y, 0));
  return game;
}
function runTo(game: PickerEngine, until: number, from = game.now) {
  for (let t = from + 16; t < until; t += 16) game.advance(t);
  game.advance(until);
}

test("gathering requires two players and locks late admissions", () => {
  const game = round("random", 1);
  game.advance(10_000);
  assert.equal(game.phase, "gathering");
  assert.equal(game.snapshot().countdown, 0);
  game.join(22, 520, 120, 10_000);
  game.advance(10_016);
  assert.equal(game.phase, "picking");
  assert.equal(game.join(33, 320, 360, 10_020), null);
  assert.equal(game.players.length, 2);
});

test("spacing and capacity reject crowded contacts", () => {
  const game = round("random", 1);
  assert.equal(game.join(11, 135, 130), null);
  game.capacity = 2;
  assert.equal(game.join(12, 520, 120), 2);
  assert.equal(game.join(13, 120, 360), null);
});

test("returning within grace keeps identity, elapsed time, and random winner", () => {
  const game = round();
  game.advance(10_000); game.advance(10_500);
  const winner = game.winnerId;
  const before = game.pickElapsed;
  const color = game.players[0].color;
  const symbol = game.players[0].symbol;
  game.release(10, 10_500); game.advance(12_000);
  assert.equal(game.phase, "paused"); assert.equal(game.pickElapsed, before);
  assert.equal(game.join(99, 125, 125, 12_000), 1);
  assert.equal(game.phase, "picking"); assert.equal(game.winnerId, winner);
  assert.equal(game.players[0].color, color);
  assert.equal(game.players[0].symbol, symbol);
  assert.equal(game.players[0].pointerId, 99);
  game.advance(12_500); assert.equal(game.pickElapsed, before + 500);
});

test("gathering pauses and resumes its original countdown with one player", () => {
  const game = round("random", 1);
  game.advance(3000); game.release(10, 3000); game.advance(4000);
  assert.equal(game.gatherElapsed, 3000);
  game.join(88, 120, 120, 4000);
  assert.equal(game.phase, "gathering"); assert.equal(game.gatherElapsed, 3000);
});

test("an expired return removes the participant and restarts the bounce", () => {
  const game = round(); game.advance(10_000); game.advance(11_000);
  game.release(10, 11_000); game.advance(16_000);
  assert.equal(game.phase, "picking"); assert.equal(game.players.length, 3);
  assert.equal(game.pickElapsed, 0); assert.equal(game.players.some(p => p.id === 1), false);
  assert.equal(game.ball.trail.length, 0);
});

test("multiple missing fingers must all return; an expiry still forces restart", () => {
  const game = round(); game.advance(10_000); game.advance(10_500);
  game.release(10, 10_500); game.release(11, 11_000);
  game.advance(15_500);
  assert.equal(game.phase, "paused"); assert.equal(game.players.length, 3);
  assert.equal(game.join(101, 520, 120, 15_700), 2);
  assert.equal(game.phase, "picking"); assert.equal(game.pickElapsed, 0);
});

test("a contact after the deadline cannot reclaim an expired picking slot", () => {
  const game = round(); game.advance(10_000); game.release(10, 10_000);
  assert.equal(game.join(100, 120, 120, 15_001), null);
  assert.equal(game.players.length, 3); assert.equal(game.phase, "picking");
});

test("fewer than two survivors reopen gathering", () => {
  const game = round("random", 2); game.advance(10_000); game.release(10, 10_000); game.advance(15_000);
  assert.equal(game.phase, "gathering"); assert.equal(game.players.length, 1);
  assert.equal(game.gatherElapsed, 0);
  assert.equal(game.join(77, 120, 360, 15_001), 3);
});

test("a completed result remains after fingers lift and resets cleanly", () => {
  const game = round(); game.advance(10_000); runTo(game, 17_000);
  assert.equal(game.phase, "winner"); assert.equal(game.winnerId, 4);
  game.release(13, 17_100); assert.equal(game.phase, "winner");
  game.start("pinball", 18_000);
  assert.equal(game.phase, "gathering"); assert.equal(game.players.length, 0); assert.equal(game.winnerId, null);
});

test("moving fingers does not change the uniform-mode winner", () => {
  const still = round(), moving = round();
  still.advance(10_000); moving.advance(10_000);
  moving.move(13, 440, 250, 10_500);
  runTo(still, 17_000); runTo(moving, 17_000);
  assert.equal(still.winnerId, moving.winnerId);
  const winner = moving.players.find(p => p.id === moving.winnerId)!;
  assert.ok(Math.abs(Math.hypot(winner.x - moving.ball.x, winner.y - moving.ball.y) - (RULES.ringRadius + RULES.ballRadius)) < 0.001);
});

test("pinball landing depends on positions relative to the live trajectory", () => {
  const game = round("pinball"); game.advance(10_000);
  game.ball.x = 320; game.ball.y = 240; game.ball.vx = 700; game.ball.vy = 0;
  game.players[1].x = 520; game.players[1].y = 240;
  game.players[3].x = 120; game.players[3].y = 400;
  const before = game.predictLanding()!.id;
  game.move(11, 60, 200, 10_100);
  assert.notEqual(game.predictLanding()!.id, before);
});

test("pinball collides with a finger and finishes on a finite ring position", () => {
  const events: string[] = [];
  const game = new PickerEngine({ random: n => n - 1, sound: event => events.push(event) });
  game.resize(640, 480); game.start("pinball", 0);
  [[120, 120], [520, 120], [120, 360], [520, 360]].forEach(([x, y], i) => game.join(i + 10, x, y));
  game.advance(10_000); runTo(game, 17_000);
  assert.ok(events.includes("bounce")); assert.equal(game.phase, "winner");
  assert.ok(Number.isFinite(game.ball.x) && Number.isFinite(game.ball.y));
  assert.ok(game.players.some(p => p.id === game.winnerId));
});

test("an unrevealed winner is never present in the public snapshot", () => {
  const game = round(); game.advance(10_000);
  assert.equal(game.snapshot().winnerId, null);
  game.release(10, 10_100); assert.equal(game.snapshot().winnerId, null);
});

test("expanding to the viewport increases capacity and preserves participant identity", () => {
  const game = new PickerEngine();
  game.resize(350, 200, 8); game.start("random", 0);
  game.join(10, 100, 80); game.join(11, 250, 120);
  const oldCapacity = game.capacity;
  const color = game.players[0].color, symbol = game.players[0].symbol;
  game.resize(390, 844, 8);
  assert.ok(game.capacity > oldCapacity);
  assert.equal(game.players[0].color, color); assert.equal(game.players[0].symbol, symbol);
  assert.ok(Math.abs(game.players[0].x - 100 / 350 * 390) < .001);
  assert.ok(Math.abs(game.players[0].y - 80 / 200 * 844) < .001);
  game.resize(390, 844, 5); assert.equal(game.capacity, 5);
});

test("each live participant has a unique color and symbol, including replacement contacts", () => {
  const game = new PickerEngine(); game.resize(800, 700, 8); game.start("random", 0);
  [[120, 120], [300, 120], [500, 120], [680, 120], [120, 480], [300, 480], [500, 480], [680, 480]].forEach(([x, y], i) => game.join(i + 10, x, y));
  assert.equal(game.players.length, 8);
  assert.equal(new Set(game.players.map(p => p.color)).size, 8);
  assert.equal(new Set(game.players.map(p => p.symbol)).size, 8);
  game.release(10, 100); game.advance(5100);
  assert.equal(game.join(99, 120, 120, 5100), 9);
  assert.equal(new Set(game.players.map(p => p.color)).size, 8);
  assert.equal(new Set(game.players.map(p => p.symbol)).size, 8);
});

test("resizing a revealed result keeps the selected ball on the ring rim", () => {
  const game = round(); game.advance(10_000); runTo(game, 17_000);
  const selected = game.winnerId;
  game.resize(390, 844);
  const winner = game.players.find(p => p.id === selected)!;
  assert.equal(game.phase, "winner"); assert.equal(game.winnerId, selected);
  assert.ok(Math.abs(Math.hypot(winner.x - game.ball.x, winner.y - game.ball.y) - (RULES.ringRadius + RULES.ballRadius)) < .001);
});

test("uniform selection validates arguments and produces an in-range index", () => {
  assert.throws(() => randomIndex(0), RangeError);
  assert.throws(() => randomIndex(2.5), RangeError);
  for (let i = 0; i < 100; i++) assert.ok(randomIndex(4) >= 0 && randomIndex(4) < 4);
});

test("optional agent tools register, validate input, share state, and clean up", () => {
  const game = round(); game.advance(10_000);
  const registered: { tool: { name: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute(input: unknown): unknown }; signal: AbortSignal }[] = [];
  let updates = 0;
  const fakeDocument = { modelContext: { registerTool: (tool: (typeof registered)[number]["tool"], options: { signal: AbortSignal }) => { registered.push({ tool, signal: options.signal }); } } };
  const cleanup = registerGameTools(game, () => { updates++; }, fakeDocument as unknown as Parameters<typeof registerGameTools>[2]);
  assert.deepEqual(registered.map(r => r.tool.name), ["read_picker_state", "reset_picker_round"]);
  assert.equal(registered[0].tool.annotations.readOnlyHint, true);
  assert.equal((registered[0].tool.execute({}) as { winnerId: number | null }).winnerId, null);
  assert.throws(() => registered[1].tool.execute({ unexpected: true }), /empty object/);
  assert.equal(game.phase, "picking");
  assert.deepEqual(registered[1].tool.execute({}), { phase: "idle" });
  assert.equal(updates, 1); assert.equal(game.phase, "idle");
  cleanup(); assert.equal(registered[0].signal.aborted, true);
});
