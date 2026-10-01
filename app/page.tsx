"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { CircleHelp, Diamond, Hand, Hexagon, Moon, Move, Plus, RotateCcw, Shuffle, Square, Star, Triangle, Volume2, VolumeX, X } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GameAudio } from "@/lib/game/audio";
import { PickerEngine, RULES, type Mode, type Snapshot } from "@/lib/game/engine";
import { drawGame } from "@/lib/game/renderer";
import { registerGameTools } from "@/lib/game/webmcp";
import type { PlayerSymbol } from "@/lib/game/identity";

const INITIAL: Snapshot = { phase: "idle", mode: "random", players: [], countdown: 10, winnerId: null, capacity: 8, notice: "", returnSeconds: 0, demo: false };
const SYMBOL_ICONS = { triangle: Triangle, diamond: Diamond, star: Star, square: Square, plus: Plus, crescent: Moon, hexagon: Hexagon, cross: X };
function FingerSymbol({ name }: { name: PlayerSymbol }) { const Icon = SYMBOL_ICONS[name]; return <Icon size={14} strokeWidth={2.5} aria-hidden="true" />; }

const modes = [
  { id: "random" as Mode, title: "Random Pick", description: "Everyone has an equal chance.", Icon: Shuffle },
  { id: "pinball" as Mode, title: "Pinball Play", description: "Move your finger. Change the bounce.", Icon: Move },
];

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<PickerEngine | null>(null);
  const audio = useRef<GameAudio | null>(null);
  const dragging = useRef<number | null>(null);
  const pointers = useRef(new Set<number>());
  const roundToken = useRef(0);
  const [view, setView] = useState<Snapshot>(INITIAL);
  const [mode, setMode] = useState<Mode>("random");
  const [sound, setSound] = useState(true);
  const [demoFinger, setDemoFinger] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);
  const idle = view.phase === "idle";
  const winner = view.players.find(p => p.id === view.winnerId);
  const publishView = () => { if (engine.current) setView(engine.current.snapshot()); };

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const soundSystem = new GameAudio();
    const game = new PickerEngine({ sound: (event, id) => soundSystem.play(event, id) });
    engine.current = game; audio.current = soundSystem;
    try {
      const saved = localStorage.getItem("fingertip.mode");
      if (saved === "random" || saved === "pinball") setMode(saved);
      const enabled = localStorage.getItem("fingertip.sound") !== "off";
      setSound(enabled); soundSystem.enabled = enabled;
    } catch { /* Storage is optional. */ }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(rect.width * ratio); element.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      game.resize(rect.width, rect.height, game.demo ? 8 : navigator.maxTouchPoints || 8);
      setView(game.snapshot());
    });
    observer.observe(element);
    let frame = 0, lastUI = 0;
    const animate = (now: number) => {
      game.advance(now); drawGame(ctx, game, now, reduced.matches);
      if (now - lastUI >= 80) { setView(game.snapshot()); lastUI = now; }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const visibility = () => {
      if (document.hidden && game.phase !== "winner" && game.phase !== "idle") {
        roundToken.current++; game.reset(); pointers.current.clear(); dragging.current = null; setView(game.snapshot());
      }
    };
    document.addEventListener("visibilitychange", visibility);
    const unregister = registerGameTools(game, () => setView(game.snapshot()));
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); soundSystem.dispose();
      document.removeEventListener("visibilitychange", visibility); unregister();
      engine.current = null; audio.current = null;
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!idle) document.body.style.overflow = "hidden";
    if (theme) theme.content = idle ? "#F7F9FD" : "#111A2C";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [idle]);

  function selectMode(next: Mode) {
    setMode(next); try { localStorage.setItem("fingertip.mode", next); } catch { /* Optional. */ }
  }
  function toggleSound() {
    const enabled = !sound; setSound(enabled);
    if (audio.current) { audio.current.enabled = enabled; if (enabled) void audio.current.unlock(); }
    try { localStorage.setItem("fingertip.sound", enabled ? "on" : "off"); } catch { /* Optional. */ }
  }
  function start(demo = false) {
    void audio.current?.unlock(); pointers.current.clear(); dragging.current = null;
    const game = engine.current;
    if (!game) return;
    const token = ++roundToken.current;
    game.start(mode, performance.now(), demo); setDemoFinger(1); publishView();
    if (demo) requestAnimationFrame(() => {
      if (token !== roundToken.current || game.phase !== "gathering") return;
      const rect = canvas.current?.getBoundingClientRect();
      if (rect) game.resize(rect.width, rect.height, 8);
      const count = Math.min(6, game.capacity);
      const columns = game.width > game.height * 1.2 ? 3 : 2;
      const rows = Math.ceil(count / columns);
      const top = Math.min(190, game.height * .28);
      const bottom = Math.max(top, game.height - (game.width < 650 ? 150 : 110));
      for (let i = 0; i < count; i++) {
        const x = game.width * ((i % columns) + 1) / (columns + 1);
        const row = Math.floor(i / columns);
        const y = rows === 1 ? (top + bottom) / 2 : top + row * (bottom - top) / (rows - 1);
        game.join(-100 - i, x, y, performance.now());
      }
      publishView();
    });
  }
  function reset() { roundToken.current++; engine.current?.reset(); pointers.current.clear(); dragging.current = null; publishView(); }
  function location(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const game = engine.current;
    if (game && (Math.abs(game.width - rect.width) > .5 || Math.abs(game.height - rect.height) > .5)) {
      game.resize(rect.width, rect.height, game.demo ? 8 : navigator.maxTouchPoints || 8);
    }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function down(event: ReactPointerEvent<HTMLCanvasElement>) {
    const game = engine.current;
    if (!game || game.phase === "idle" || game.phase === "winner") return;
    event.preventDefault(); void audio.current?.unlock();
    const point = location(event); pointers.current.add(event.pointerId);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Already canceled. */ }
    if (game.demo) {
      const player = [...game.players].sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
      if (player && Math.hypot(player.x - point.x, player.y - point.y) < RULES.reclaimRadius) {
        if (!player.active) game.join(player.pointerId, point.x, point.y, performance.now());
        dragging.current = player.id; setDemoFinger(player.id);
      }
    } else game.join(event.pointerId, point.x, point.y, performance.now());
    publishView();
  }
  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    const game = engine.current;
    if (!game || !pointers.current.has(event.pointerId)) return;
    const point = location(event);
    if (game.demo) {
      const player = game.players.find(p => p.id === dragging.current);
      if (player) game.move(player.pointerId, point.x, point.y, performance.now());
    } else {
      if (!game.players.some(p => p.active && p.pointerId === event.pointerId)) game.join(event.pointerId, point.x, point.y, performance.now());
      else game.move(event.pointerId, point.x, point.y, performance.now());
    }
  }
  function up(event: ReactPointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (engine.current?.demo) dragging.current = null;
    else engine.current?.release(event.pointerId, performance.now());
    publishView();
  }
  function liftDemo() {
    const player = engine.current?.players.find(p => p.id === demoFinger && p.active);
    if (player) engine.current?.release(player.pointerId, performance.now()); publishView();
  }
  const phaseTitle = view.phase === "gathering" ? (view.countdown ? "Fingers in!" : view.players.length ? "One more finger?" : "Ready for two fingers.") : view.phase === "paused" ? "A little pause." : view.phase === "winner" ? "You’re picked!" : "Hold your fingers";
  const phaseHint = view.phase === "gathering" ? "One finger each. Keep a little space." : view.phase === "paused" ? "Return to your ring to keep playing." : view.phase === "winner" ? `Finger ${String(view.winnerId).padStart(2, "0")}` : mode === "random" ? "Let chance do its thing." : "Move to change the bounce.";

  return <main className={`app-shell ${idle ? "is-idle" : "is-active"}`} style={{ "--winner-color": winner?.color ?? "#FFFFFF" } as CSSProperties}>
    <header className="app-header">
      {idle ? <a href="/" className="brand" aria-label="Fingertip home" onClick={e => { e.preventDefault(); reset(); }}>fingertip<span>.</span></a> : <span className="mode-pill">{mode === "random" ? <Shuffle size={14} /> : <Move size={14} />}{mode === "random" ? "Random Pick" : "Pinball Play"}</span>}
      <div className="header-actions">
        <button className="icon-button" onClick={toggleSound} aria-label={sound ? "Mute sound" : "Enable sound"} aria-pressed={sound}>{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
        {idle ? <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogTrigger asChild><button className="icon-button" aria-label="How to play"><CircleHelp size={19} /></button></DialogTrigger>
          <DialogContent className="help-dialog"><DialogHeader><DialogTitle>How to play</DialogTitle><DialogDescription>One screen. One finger each.</DialogDescription></DialogHeader>
            <ol className="help-steps"><li><span>01</span><div><strong>Choose your way to play.</strong><p>Random Pick gives each finger an equal chance. In Pinball Play, movement changes the bounces.</p></div></li><li><span>02</span><div><strong>Tap Let’s pick! Then fingers down.</strong><p>You have 10 seconds to join. You need at least two players.</p></div></li><li><span>03</span><div><strong>Hold through the bounce.</strong><p>Lift a finger and you have 5 seconds to return to its ring. Miss it and the picker starts fresh with the remaining players.</p></div></li><li><span>04</span><div><strong>One finger gets picked.</strong><p>The ball lands on its ring. Tap Again! for another round.</p></div></li></ol>
            <p className="help-practice">Every ring has a number and a symbol, so color isn’t your only clue. Practice adds up to six fingers: drag a ring, or use Lift to try a pause.</p>
          </DialogContent></Dialog> : <button className="icon-button" onClick={reset} aria-label="End round"><X size={21} /></button>}
      </div>
    </header>

    {idle && <section className="intro"><h1>Who’s up?</h1><p>One screen. One finger each.</p></section>}
    <section className={idle ? "start-preview" : "game-stage"} aria-label={idle ? "Game preview" : "Full-viewport game board"}>
      <canvas ref={canvas} className="game-canvas" aria-label={idle ? "Preview of three colorful rings and a bouncing ball" : "Touch play area. Hold one finger per player. Rings have distinct numbers and symbols."} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {!idle && <>
        <div className={`round-overlay phase-${view.phase}`} aria-live="polite" aria-atomic="true">
          {view.phase === "gathering" && view.countdown > 0 && <div className="big-count">{String(view.countdown).padStart(2, "0")}<span>seconds to join</span></div>}
          <h2>{phaseTitle}</h2><p>{phaseHint}</p>
          {view.phase === "winner" && winner && <span className="winner-symbol"><FingerSymbol name={winner.symbol} /></span>}
        </div>
        {view.notice && <div className="game-notice" role="status">{view.notice}</div>}
      </>}
    </section>

    {idle && <section className="setup-controls" aria-label="Start a round">
      <RadioGroup className="mode-segment" value={mode} onValueChange={v => selectMode(v as Mode)} aria-label="Picker mode">{modes.map(({ id, title }) => <label className={`mode-tab ${mode === id ? "selected" : ""}`} key={id} htmlFor={`mode-${id}`}><RadioGroupItem id={`mode-${id}`} value={id} className="mode-radio" /><span>{title}</span></label>)}</RadioGroup>
      <p className="mode-description">{modes.find(m => m.id === mode)?.description}</p>
      <button className="start-button" onClick={() => start()}><Hand size={24} strokeWidth={1.8} /> Let’s pick!</button>
      <button className="practice-button" onClick={() => start(true)}>Try practice fingers</button>
      <p className="start-footnote">10 seconds to join · 2+ players</p>
    </section>}

    {!idle && view.phase === "winner" ? <div className="winner-actions"><button className="play-again" onClick={() => start(view.demo)}><RotateCcw size={18} /> Again!</button><button className="change-mode-button" onClick={reset}>Change mode</button></div> : !idle && !view.demo && <p className="play-hint">{view.phase === "paused" ? `${view.returnSeconds} seconds to return` : "Hold. Bounce. Pick."}</p>}
    {!idle && view.demo && view.phase !== "winner" && <div className="demo-controls"><span className="practice-hint">Practice · drag a ring</span><div className="practice-toolbar"><div className="demo-fingers">{view.players.map(p => <button key={p.id} className={demoFinger === p.id ? "chosen" : ""} style={{ "--finger-color": p.color } as CSSProperties} aria-label={`Select practice finger ${p.id}, ${p.symbol}`} aria-pressed={demoFinger === p.id} onClick={() => setDemoFinger(p.id)}>{String(p.id).padStart(2, "0")}</button>)}</div><button className="lift-button" onClick={liftDemo} disabled={!view.players.find(p => p.id === demoFinger)?.active}>Lift {String(demoFinger).padStart(2, "0")}</button></div></div>}
  </main>;
}
