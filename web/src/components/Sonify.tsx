import { useEffect, useRef, useState } from "react";
import { useFmt } from "../i18n";
import { byYear } from "../lib/series";
import type { RegionDoc } from "../lib/types";

type Mode = "harm" | "stitched";

/**
 * "Listen to the record": every week becomes a short note, louder and higher with more fire.
 * In the stitched raw record (MODIS to 2011, VIIRS after) the 2012 jump is audible; in the
 * harmonised record it is not. Also gives screen-reader users a way to sense 24 years at once.
 */
export function Sonify({ doc }: { doc: RegionDoc }) {
  const { t, year: fy } = useFmt();
  const [playing, setPlaying] = useState<Mode | null>(null);
  const [pos, setPos] = useState<{ y: number; w: number } | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    ctxRef.current?.close();
    ctxRef.current = null;
    setPlaying(null);
    setPos(null);
  };
  useEffect(() => stop, []);

  const play = (mode: Mode) => {
    stop();
    const grid = byYear(doc);
    const seq: { y: number; w: number; v: number }[] = [];
    for (const [y, weeks] of [...grid.entries()].sort((a, b) => a[0] - b[0])) {
      weeks.forEach((wk, i) => {
        if (!wk) return;
        const v = mode === "harm" ? wk.harm : y < 2012 ? (wk.modis ?? 0) : (wk.viirs ?? wk.harm);
        seq.push({ y, w: i + 1, v });
      });
    }
    const max = Math.max(1, ...seq.map((s) => s.v));
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
    let i = 0;
    const stepMs = 18; // 24 years x 52 weeks in about 23 seconds
    setPlaying(mode);
    timer.current = window.setInterval(() => {
      if (i >= seq.length || !ctxRef.current) {
        stop();
        return;
      }
      const s = seq[i++];
      const level = Math.sqrt(s.v / max); // perceptual compression
      if (level > 0.02) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = 160 + 900 * level;
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(level, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        osc.connect(g).connect(master);
        osc.start(now);
        osc.stop(now + 0.07);
      }
      if (s.w === 1 || i % 8 === 0) setPos({ y: s.y, w: s.w });
    }, stepMs);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">{t("sonify.title")}</span>
      <button type="button" className="chip" aria-pressed={playing === "stitched"} onClick={() => (playing === "stitched" ? stop() : play("stitched"))}>
        {playing === "stitched" ? "■" : "▶"} {t("sonify.raw")}
      </button>
      <button type="button" className="chip" aria-pressed={playing === "harm"} onClick={() => (playing === "harm" ? stop() : play("harm"))}>
        {playing === "harm" ? "■" : "▶"} {t("sonify.harm")}
      </button>
      <span className="text-sm text-muted" aria-live="polite">
        {pos ? `${fy(pos.y)}${pos.y === 2012 && playing === "stitched" ? ` · ${t("sonify.jump")}` : ""}` : t("sonify.hint")}
      </span>
    </div>
  );
}
