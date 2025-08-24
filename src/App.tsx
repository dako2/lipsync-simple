import { useRef, useState } from "react";
import { interpolate } from "flubber";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";

/**
 * ---- SVG viseme shapes (edit to your style) ----
 * Keep one <path> and morph its "d" using flubber.
 */
const PATHS = {
  X: "M 50 60 Q 50 65 50 70 Q 50 65 50 60", // rest
  A: "M 45 55 Q 50 75 55 55",                // open
  E: "M 47 58 Q 50 68 53 58",                // spread
  I: "M 48 60 Q 50 65 52 60",                // small
  O: "M 45 60 Q 50 75 55 60 Q 50 65 45 60",  // rounded
  U: "M 47 62 Q 50 70 53 62",
  M: "M 48 62 L 52 62",                      // closed (m/b/p)
  F: "M 48 65 L 52 60",                      // teeth-on-lip (f/v)
  S: "M 48 61 Q 50 63 52 61",                // sibilants
  D: "M 46 60 Q 50 66 54 60"                 // neutral-consonants
};
type VisemeKey = keyof typeof PATHS;

type Cue = { t: number; v: VisemeKey };

/**
 * Azure Speech SDK uses an MPEG-4 style numeric viseme set.
 * We'll remap them to our simpler set. This is an APPROX mapping
 * (good enough for a demo; tweak as desired).
 *
 * Common MPEG-4-ish buckets → our small set:
 * - 0/1/2 (silence/pp/b)   → M
 * - f/v                     → F
 * - th/dh                   → S (sibilant-ish)
 * - s/z/sh/zh/ch/jh         → S
 * - t/d/k/g/n/l/r           → D
 * - i/ee                    → E or I
 * - e/ae                    → E/A
 * - a/aa                    → A
 * - o/oo/u                  → O/U
 */
function mapAzureVisemeId(id: number): VisemeKey {
  if ([0].includes(id)) return "X";            // silence
  if ([1, 2].includes(id)) return "M";         // p/b/m closed
  if ([3].includes(id)) return "F";            // f/v
  if ([4, 5].includes(id)) return "S";         // th/dh
  if ([6, 7, 8, 9, 10, 11].includes(id)) return "S"; // s/z/sh/zh/ch/jh
  if ([12, 13, 14, 15, 16, 17].includes(id)) return "D"; // t/d/k/g/n/l/r
  if ([18].includes(id)) return "I";           // i
  if ([19].includes(id)) return "E";           // ee
  if ([20].includes(id)) return "E";           // e
  if ([21].includes(id)) return "A";           // a
  if ([22].includes(id)) return "O";           // o
  if ([23].includes(id)) return "O";           // oo
  if ([24].includes(id)) return "U";           // u
  return "D";
}

/**
 * Simple viseme compressor: keep only changes and ensure rest at end.
 */
function compressVisemes(points: Cue[], totalSec: number): Cue[] {
  const out: Cue[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.v !== p.v) out.push(p);
  }
  if (!out.length || out[out.length - 1].v !== "X") {
    out.push({ t: totalSec, v: "X" });
  }
  return out;
}

export default function App() {
  const [region, setRegion] = useState("eastus");
  const [key, setKey] = useState("<YOUR_AZURE_SPEECH_KEY>");

  const [voice, setVoice] = useState("en-US-JennyNeural");
  const [text, setText] = useState(
    "Hello! This demo uses Azure Speech viseme events for accurate timing, and flubber to morph the mouth smoothly."
  );
  const [status, setStatus] = useState("idle");
  const pathRef = useRef<SVGPathElement>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const morphFnRef = useRef<ReturnType<typeof interpolate> | null>(null);
  const lastVRef = useRef<VisemeKey>("X");
  const morphStartRef = useRef<number>(0);
  const morphMs = 110;

  const rafRef = useRef<number | null>(null);
  const cuesRef = useRef<Cue[]>([]);

  function cancelLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function animateLoop() {
    cancelLoop();
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const a = audioRef.current;
      if (!a) return;
      const t = a.currentTime || 0;

      const cues = cuesRef.current;
      if (!cues.length) return;
      let current: Cue = cues[0];
      for (const c of cues) {
        if (c.t <= t) current = c; else break;
      }

      if (current.v !== lastVRef.current) {
        const from = PATHS[lastVRef.current];
        const to = PATHS[current.v] || PATHS.X;
        morphFnRef.current = interpolate(from, to, { maxSegmentLength: 2 });
        morphStartRef.current = performance.now();
        lastVRef.current = current.v;
      }

      const f = morphFnRef.current;
      const p = pathRef.current;
      if (f && p) {
        const tt = Math.min(1, (performance.now() - morphStartRef.current) / morphMs);
        p.setAttribute("d", f(tt));
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function speak() {
    if (!text.trim()) return;
    if (!key || key.startsWith("<")) {
      alert("Add your Azure Speech key first.");
      return;
    }

    setStatus("initializing…");

    const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();


    const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechSynthesisVoiceName = voice;

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    const visemePoints: Cue[] = [];
    let totalAudioSec = 0;

    synthesizer.wordBoundary = (_s, _e) => {
      // const wordStartSec = e.audioOffset / 10_000_000;
    };

    synthesizer.visemeReceived = (_s, e) => {
      const sec = e.audioOffset / 10_000_000; // 100-ns to seconds
      const v = mapAzureVisemeId(e.visemeId);
      visemePoints.push({ t: sec, v });
    };

    synthesizer.synthesisStarted = () => {
      setStatus("synth started…");
    };
    synthesizer.synthesisCompleted = (_s, e) => {
      try {
        const ticks = (e as any)?.result?.audioDuration;
        if (typeof ticks === "number") {
          totalAudioSec = ticks / 10_000_000;
        }
      } catch {}
      setStatus("playback…");
    };

    await new Promise<sdk.SpeechSynthesisResult>((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        r => resolve(r),
        err => reject(err)
      );
    });

    synthesizer.close();

    if (!totalAudioSec) {
      const lastT = visemePoints.length ? visemePoints[visemePoints.length - 1].t : 0;
      totalAudioSec = Math.max(0.25, lastT + 0.2);
    }

    // Build final cue list (compressed), and start a timer driving our animation.
    const cues = compressVisemes(visemePoints.length ? visemePoints : [{ t: 0, v: "X" }], totalAudioSec);
    cuesRef.current = cues;

    const a = audioRef.current!;
    const t0 = performance.now();
    a.currentTime = 0;
    (function clock() {
      const now = performance.now();
      const sec = (now - t0) / 1000;
      a.currentTime = Math.min(totalAudioSec, sec);
      if (sec < totalAudioSec) requestAnimationFrame(clock);
    })();

    lastVRef.current = "X";
    pathRef.current?.setAttribute("d", PATHS.X);
    animateLoop();
  }

  return (
    <div style={{fontFamily:"system-ui, sans-serif", background:"#0b1020", color:"#e9efff", minHeight:"100vh", padding:"24px"}}>
      <h1 style={{margin:"0 0 8px"}}>Azure Speech (visemes) + Flubber Morph</h1>
      <p style={{opacity:.85, marginTop:0}}>
        Real viseme/word timing from Azure Speech SDK. No backend. Paste your key/region and click Speak.
      </p>

      <div style={{display:"grid", gridTemplateColumns:"1fr 360px", gap:16}}>
        <section style={{background:"#111831", border:"1px solid #1f2a4a", borderRadius:12, padding:14}}>
          <div style={{display:"grid", gap:10, gridTemplateColumns:"repeat(2, minmax(220px,1fr))"}}>
            <label>Azure Region
              <input value={region} onChange={e=>setRegion(e.target.value)}
                style={{display:"block", width:"100%", marginTop:6, borderRadius:10, padding:"8px 10px", border:"1px solid #26325c", background:"#182243", color:"#fff"}} />
            </label>
            <label>Azure Speech Key
              <input value={key} onChange={e=>setKey(e.target.value)}
                style={{display:"block", width:"100%", marginTop:6, borderRadius:10, padding:"8px 10px", border:"1px solid #26325c", background:"#182243", color:"#fff"}} />
            </label>
          </div>

          <div style={{display:"grid", gap:10, gridTemplateColumns:"repeat(2, minmax(220px,1fr))", marginTop:10}}>
            <label>Voice
              <input value={voice} onChange={e=>setVoice(e.target.value)} placeholder="en-US-JennyNeural"
                style={{display:"block", width:"100%", marginTop:6, borderRadius:10, padding:"8px 10px", border:"1px solid #26325c", background:"#182243", color:"#fff"}} />
            </label>
          </div>

          <label style={{display:"block", marginTop:10}}>Text</label>
          <textarea
            rows={5}
            value={text}
            onChange={e=>setText(e.target.value)}
            style={{width:"100%", borderRadius:10, padding:10, border:"1px solid #26325c", background:"#182243", color:"#fff"}}
          />

          <div style={{display:"flex", gap:10, marginTop:12}}>
            <button onClick={speak}
              style={{background:"#2c4cff", border:"1px solid #3e58d9", color:"#fff", padding:"10px 14px", borderRadius:10, cursor:"pointer"}}>
              ▶︎ Speak (with visemes)
            </button>
            <span style={{opacity:.8, alignSelf:"center"}}>{status}</span>
          </div>

          <audio ref={audioRef} style={{display:"none"}} />
        </section>

        <section style={{background:"#111831", border:"1px solid #1f2a4a", borderRadius:12, padding:14, display:"flex", alignItems:"center", justifyContent:"center"}}>
          <svg viewBox="0 0 100 100" width="320" height="320"
               style={{border:"2px solid #1f2a4a", borderRadius:"50%", background:"linear-gradient(#ffd6e0,#ffc8d4)"}}>
            <circle cx="30" cy="35" r="3" fill="#333" />
            <circle cx="70" cy="35" r="3" fill="#333" />
            <ellipse cx="50" cy="45" rx="1" ry="2" fill="#333" />
            <path
              ref={pathRef}
              d={PATHS.X}
              fill="none"
              stroke="#d97706"
              strokeWidth={3}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </section>
      </div>
    </div>
  );
}
