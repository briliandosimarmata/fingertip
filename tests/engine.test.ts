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
function largeRound(mode: Mode, count: number, random = (length: number) => length - 1) {
  const game = new PickerEngine({ random });
  game.resize(1200, 1200); game.start(mode, 0);
  for (let i = 0; i < count; i++) {
    assert.equal(game.join(i + 10, 100 + (i % 10) * 100, 100 + Math.floor(i / 10) * 100), i + 1);
  }
  return game;
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

test("spacing and edges reject crowded contacts without imposing a player cap", () => {
  const game = round("random", 1);
  assert.equal(game.join(11, 135, 130), null);
  assert.equal(game.join(12, 520, 120), 2);
  assert.equal(game.join(13, 120, 360), 3);
  assert.equal(game.join(14, 10, 200), null);
});

test("a small screen accepts every spaced contact beyond the former area and eight-player caps", () => {
  const game = new PickerEngine(); game.resize(380, 260); game.start("random", 0);
  for (let i = 0; i < 12; i++) {
    assert.equal(game.join(i + 10, 40 + (i % 4) * 100, 40 + Math.floor(i / 4) * 90), i + 1);
  }
  assert.equal(game.players.length, 12);
  assert.equal(game.snapshot().pickDurationMs, 17_000);
  game.resize(350, 240);
  assert.equal(game.players.length, 12);
});

for (const mode of ["random", "pinball"] as const) {
  for (const [count, duration] of [[2, 7_000], [4, 9_000], [12, 17_000]]) {
    test(`${mode} with ${count} players bounces for ${duration / 1000} seconds and visibly lands`, () => {
      const game = largeRound(mode, count);
      assert.equal(game.snapshot().pickDurationMs, duration);
      game.advance(10_000);
      assert.equal(game.pickDurationMs, duration);
      runTo(game, 10_000 + duration - 1);
      assert.equal(game.phase, "picking");
      assert.equal(game.snapshot().winnerId, null);
      game.advance(10_000 + duration);
      assert.equal(game.phase, "winner");
      const winner = game.players.find(p => p.id === game.winnerId)!;
      assert.ok(Number.isFinite(game.ball.x) && Number.isFinite(game.ball.y));
      assert.ok(Math.abs(Math.hypot(winner.x - game.ball.x, winner.y - game.ball.y) - (RULES.ringRadius + RULES.ballRadius)) < .001);
    });
  }

  test(`${mode} keeps bouncing past seven seconds with a larger group`, () => {
    const game = largeRound(mode, 12);
    game.advance(10_000); runTo(game, 17_000);
    assert.equal(game.phase, "picking");
    const position = { x: game.ball.x, y: game.ball.y };
    runTo(game, 17_100);
    assert.ok(Math.hypot(position.x - game.ball.x, position.y - game.ball.y) > 0);
  });

  test(`${mode} preserves its longer duration and landing target through a final-approach return`, () => {
    const game = largeRound(mode, 12);
    game.advance(10_000);
    runTo(game, 25_799);
    const targetId = mode === "random" ? game.winnerId : game.predictLanding()!.id;
    game.advance(25_800); game.advance(25_900);
    const target = game.players.find(p => p.id === targetId)!;
    const elapsed = game.pickElapsed;
    game.release(target.pointerId, 25_900); game.advance(26_900);
    assert.equal(game.phase, "paused"); assert.equal(game.pickElapsed, elapsed);
    assert.equal(game.pickDurationMs, 17_000);
    assert.equal(game.join(999, target.x, target.y, 26_900), targetId);
    game.move(999, target.x + 10, target.y + 10, 26_900);
    runTo(game, 28_000);
    assert.equal(game.phase, "winner"); assert.equal(game.winnerId, targetId);
    assert.ok(Math.abs(Math.hypot(target.x - game.ball.x, target.y - game.ball.y) - (RULES.ringRadius + RULES.ballRadius)) < .001);
  });

  test(`${mode} recalculates a longer run for survivors after expiry`, () => {
    const game = largeRound(mode, 12);
    game.advance(10_000); runTo(game, 11_000);
    game.release(10, 11_000); game.advance(16_000);
    assert.equal(game.players.length, 11);
    assert.equal(game.pickDurationMs, 16_000); assert.equal(game.pickElapsed, 0);
    runTo(game, 31_999); assert.equal(game.phase, "picking");
    game.advance(32_000); assert.equal(game.phase, "winner");
    assert.ok(game.players.some(p => p.id === game.winnerId));
  });
}

test("returning within grace keeps identity, elapsed time, and random winner", () => {
  const game = round();
  game.advance(10_000); game.advance(10_500);
  const winner = game.winnerId;
  const before = game.pickElapsed;
  const duration = game.pickDurationMs;
  const color = game.players[0].color;
  const symbol = game.players[0].symbol;
  game.release(10, 10_500); game.advance(12_000);
  assert.equal(game.phase, "paused"); assert.equal(game.pickElapsed, before);
  assert.equal(game.pickDurationMs, duration);
  assert.equal(game.join(99, 125, 125, 12_000), 1);
  assert.equal(game.phase, "picking"); assert.equal(game.winnerId, winner);
  assert.equal(game.players[0].color, color);
  assert.equal(game.players[0].symbol, symbol);
  assert.equal(game.players[0].pointerId, 99);
  game.advance(12_500); assert.equal(game.pickElapsed, before + 500);
  assert.equal(game.pickDurationMs, duration);
  runTo(game, 12_500 + duration - game.pickElapsed);
  assert.equal(game.phase, "winner"); assert.equal(game.winnerId, winner);
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
  assert.equal(game.pickDurationMs, 8_000);
  runTo(game, 24_000);
  assert.equal(game.phase, "winner");
});

test("multiple missing fingers must all return; an expiry still forces restart", () => {
  const game = round(); game.advance(10_000); game.advance(10_500);
  game.release(10, 10_500); game.release(11, 11_000);
  game.advance(15_500);
  assert.equal(game.phase, "paused"); assert.equal(game.players.length, 3);
  assert.equal(game.pickDurationMs, 9_000);
  assert.equal(game.join(101, 520, 120, 15_700), 2);
  assert.equal(game.phase, "picking"); assert.equal(game.pickElapsed, 0);
  assert.equal(game.pickDurationMs, 8_000);
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
  const game = round(); game.advance(10_000); runTo(game, 10_000 + game.pickDurationMs);
  assert.equal(game.phase, "winner"); assert.equal(game.winnerId, 4);
  game.release(13, game.now + 100); assert.equal(game.phase, "winner");
  game.start("pinball", game.now + 1000);
  assert.equal(game.phase, "gathering"); assert.equal(game.players.length, 0); assert.equal(game.winnerId, null);
});

test("moving fingers does not change the uniform-mode winner", () => {
  const still = round(), moving = round();
  still.advance(10_000); moving.advance(10_000);
  moving.move(13, 440, 250, 10_500);
  runTo(still, 10_000 + still.pickDurationMs); runTo(moving, 10_000 + moving.pickDurationMs);
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
  game.advance(10_000); runTo(game, 10_000 + game.pickDurationMs);
  assert.ok(events.includes("bounce")); assert.equal(game.phase, "winner");
  assert.ok(Number.isFinite(game.ball.x) && Number.isFinite(game.ball.y));
  assert.ok(game.players.some(p => p.id === game.winnerId));
});

test("an unrevealed winner is never present in the public snapshot", () => {
  const game = round(); game.advance(10_000);
  assert.equal(game.snapshot().winnerId, null);
  game.release(10, 10_100); assert.equal(game.snapshot().winnerId, null);
});

test("expanding to the viewport preserves participant coordinates and identity", () => {
  const game = new PickerEngine();
  game.resize(350, 200); game.start("random", 0);
  game.join(10, 100, 80); game.join(11, 250, 120);
  const color = game.players[0].color, symbol = game.players[0].symbol;
  game.resize(390, 844);
  assert.equal(game.players[0].color, color); assert.equal(game.players[0].symbol, symbol);
  assert.ok(Math.abs(game.players[0].x - 100 / 350 * 390) < .001);
  assert.ok(Math.abs(game.players[0].y - 80 / 200 * 844) < .001);
});

test("each live participant has a unique color and symbol, including replacement contacts", () => {
  const game = new PickerEngine(); game.resize(800, 700); game.start("random", 0);
  [[120, 120], [300, 120], [500, 120], [680, 120], [120, 480], [300, 480], [500, 480], [680, 480]].forEach(([x, y], i) => game.join(i + 10, x, y));
  assert.equal(game.players.length, 8);
  assert.equal(new Set(game.players.map(p => p.color)).size, 8);
  assert.equal(new Set(game.players.map(p => p.symbol)).size, 8);
  game.release(10, 100); game.advance(5100);
  assert.equal(game.join(99, 120, 120, 5100), 9);
  assert.equal(new Set(game.players.map(p => p.color)).size, 8);
  assert.equal(new Set(game.players.map(p => p.symbol)).size, 8);
});

test("100 participants have unique color/symbol pairs, including after an expiration and return", () => {
  const game = largeRound("random", 100);
  const styles = () => new Set(game.players.map(p => `${p.color}:${p.symbol}`));
  assert.equal(styles().size, 100);
  assert.equal(new Set(game.players.map(p => p.id)).size, 100);
  assert.ok(game.players.every(p => /^#[0-9A-F]{6}$/.test(p.color)));
  const original = { ...game.players[99] };
  game.release(original.pointerId, 100);
  assert.equal(game.join(999, original.x, original.y, 200), original.id);
  assert.equal(game.players[99].color, original.color);
  assert.equal(game.players[99].symbol, original.symbol);
  game.release(10, 300); game.advance(5300);
  assert.equal(game.join(1000, 100, 100, 5300), 101);
  assert.equal(game.players.length, 100); assert.equal(styles().size, 100);
});

test("every participant beyond the old cap remains eligible for Random Pick", () => {
  for (let selection = 0; selection < 12; selection++) {
    const game = largeRound("random", 12, length => Math.min(selection, length - 1));
    game.advance(10_000);
    assert.equal(game.winnerId, selection + 1);
    assert.equal(game.snapshot().winnerId, null);
    runTo(game, 10_000 + game.pickDurationMs);
    assert.equal(game.phase, "winner"); assert.equal(game.winnerId, selection + 1);
  }
});

test("resizing a revealed result keeps the selected ball on the ring rim", () => {
  const game = round(); game.advance(10_000); runTo(game, 10_000 + game.pickDurationMs);
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
