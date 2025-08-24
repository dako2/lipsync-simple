import { useRef, useState, useEffect } from "react";
import { interpolate } from "flubber";
import { TTSPlayer } from '@duyquangnvx/edge-tts-browser';

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

export default function App() {
  const [voice, setVoice] = useState("en-US-JennyNeural");
  const [text, setText] = useState(
    "Hello! This demo uses Microsoft Edge TTS without API keys and provides smooth lip sync animation."
  );
  const [status, setStatus] = useState("idle");
  const [currentPhoneme, setCurrentPhoneme] = useState<VisemeKey>("X");
  const pathRef = useRef<SVGPathElement>(null);
  const playerRef = useRef<TTSPlayer | null>(null);
  const animationRef = useRef<number | null>(null);

  const morphFnRef = useRef<ReturnType<typeof interpolate> | null>(null);
  const lastVRef = useRef<VisemeKey>("X");
  const morphStartRef = useRef<number>(0);
  const morphMs = 110;

  const getPhonemeForChar = (char: string): VisemeKey => {
    const vowels: Record<string, VisemeKey> = {
      'a': 'A', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U'
    };
    const consonants: Record<string, VisemeKey> = {
      'm': 'M', 'p': 'M', 'b': 'M',
      'f': 'F', 'v': 'F',
      's': 'S', 'z': 'S', 'sh': 'S'
    };
    
    const lowerChar = char.toLowerCase();
    return vowels[lowerChar] || consonants[lowerChar] || 'D';
  };

  const updateLipSyncFromTime = (currentTime: number) => {
    if (!text) return;
    
    const wordsPerSecond = 2.5;
    const words = text.split(' ');
    const totalDuration = words.length / wordsPerSecond;
    
    if (currentTime >= totalDuration) {
      setCurrentPhoneme("X");
      return;
    }
    
    const currentWordIndex = Math.floor((currentTime / totalDuration) * words.length);
    const currentWord = words[currentWordIndex] || "";
    
    const wordDuration = 1 / wordsPerSecond;
    const timeInWord = currentTime % wordDuration;
    const charIndex = Math.floor((timeInWord / wordDuration) * currentWord.length);
    const currentChar = currentWord[charIndex] || "";
    
    const phoneme = getPhonemeForChar(currentChar);
    setCurrentPhoneme(phoneme);
    
    if (phoneme !== lastVRef.current) {
      const from = PATHS[lastVRef.current];
      const to = PATHS[phoneme] || PATHS.X;
      morphFnRef.current = interpolate(from, to, { maxSegmentLength: 2 });
      morphStartRef.current = performance.now();
      lastVRef.current = phoneme;
    }
    
    const f = morphFnRef.current;
    const p = pathRef.current;
    if (f && p) {
      const tt = Math.min(1, (performance.now() - morphStartRef.current) / morphMs);
      p.setAttribute("d", f(tt));
    }
  };

  useEffect(() => {
    const player = new TTSPlayer({
      engine: 'auto',
      autoPlay: false,
      onPlay: () => setStatus("playing"),
      onPause: () => setStatus("paused"), 
      onStop: () => setStatus("stopped"),
      onEnded: () => {
        setStatus("idle");
        setCurrentPhoneme("X");
        if (animationRef.current) {
          clearTimeout(animationRef.current);
        }
      },
      onTimeUpdate: (currentTime) => {
        updateLipSyncFromTime(currentTime);
      },
      onError: (error) => {
        console.error('TTS Player Error:', error);
        setStatus("error");
      }
    });
    
    playerRef.current = player;
    
    return () => {
      player.destroy();
    };
  }, []);

  const handleSpeak = async () => {
    if (!text.trim()) return;
    
    const player = playerRef.current;
    if (!player) return;
    
    const playerState = player.getState();
    
    if (playerState.isPlaying) {
      player.stop();
      setStatus("stopped");
      setCurrentPhoneme("X");
      return;
    }
    
    try {
      setStatus("initializing");
      
      const ttsConfig = {
        voice: voice,
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3' as const,
        rate: '+0%',
        pitch: '+0Hz',
        volume: '+0%'
      };
      
      lastVRef.current = "X";
      pathRef.current?.setAttribute("d", PATHS.X);
      
      await player.playStream(text, ttsConfig, {
        autoStart: true,
        bufferThreshold: 0.3,
        onStreamStart: () => setStatus("streaming"),
        onStreamEnd: () => setStatus("playing")
      });
      
    } catch (error) {
      console.error('Edge TTS Error:', error);
      setStatus("error");
      setCurrentPhoneme("X");
    }
  };


  return (
    <div style={{fontFamily:"system-ui, sans-serif", background:"#0b1020", color:"#e9efff", minHeight:"100vh", padding:"24px"}}>
      <h1 style={{margin:"0 0 8px"}}>Edge TTS Lip Sync (No API Required)</h1>
      <p style={{opacity:.85, marginTop:0}}>
        Browser-compatible Microsoft Edge TTS with real-time lip sync animation. No API keys or authentication required!
      </p>

      <div style={{display:"grid", gridTemplateColumns:"1fr 360px", gap:16}}>
        <section style={{background:"#111831", border:"1px solid #1f2a4a", borderRadius:12, padding:14}}>
          <div style={{display:"grid", gap:10, gridTemplateColumns:"1fr", marginTop:10}}>
            <label>Voice
              <select value={voice} onChange={e=>setVoice(e.target.value)}
                style={{display:"block", width:"100%", marginTop:6, borderRadius:10, padding:"8px 10px", border:"1px solid #26325c", background:"#182243", color:"#fff"}}>
                <option value="en-US-AriaNeural">Aria (US English)</option>
                <option value="en-US-JennyNeural">Jenny (US English)</option>
                <option value="en-US-GuyNeural">Guy (US English)</option>
                <option value="en-US-DavisNeural">Davis (US English)</option>
                <option value="en-GB-SoniaNeural">Sonia (UK English)</option>
                <option value="en-GB-RyanNeural">Ryan (UK English)</option>
                <option value="es-ES-ElviraNeural">Elvira (Spanish)</option>
                <option value="fr-FR-DeniseNeural">Denise (French)</option>
                <option value="de-DE-KatjaNeural">Katja (German)</option>
                <option value="ja-JP-NanamiNeural">Nanami (Japanese)</option>
              </select>
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
            <button onClick={handleSpeak}
              style={{background:"#2c4cff", border:"1px solid #3e58d9", color:"#fff", padding:"10px 14px", borderRadius:10, cursor:"pointer"}}>
              {status === "playing" ? "⏹ Stop" : "▶︎ Speak"}
            </button>
            <span style={{opacity:.8, alignSelf:"center"}}>{status}</span>
          </div>
        </section>

        <section style={{background:"#111831", border:"1px solid #1f2a4a", borderRadius:12, padding:14, display:"flex", alignItems:"center", justifyContent:"center"}}>
          <svg viewBox="0 0 100 100" width="320" height="320"
               style={{border:"2px solid #1f2a4a", borderRadius:"50%", background:"linear-gradient(#ffd6e0,#ffc8d4)"}}>
            <circle cx="30" cy="35" r="3" fill="#333" />
            <circle cx="70" cy="35" r="3" fill="#333" />
            <ellipse cx="50" cy="45" rx="1" ry="2" fill="#333" />
            <path
              ref={pathRef}
              d={PATHS[currentPhoneme]}
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
