import { useRef, useState, useEffect } from "react";
import { interpolate } from "flubber";

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
  const [text, setText] = useState(
    "Hello! This demo uses browser-native Web Speech API with smooth lip sync animation. No API keys required!"
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPhoneme, setCurrentPhoneme] = useState<VisemeKey>("X");
  const pathRef = useRef<SVGPathElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
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

  const updateMouthShape = (phoneme: VisemeKey) => {
    setCurrentPhoneme(phoneme);
    
    if (phoneme !== lastVRef.current) {
      const from = PATHS[lastVRef.current];
      const to = PATHS[phoneme];
      morphFnRef.current = interpolate(from, to, { maxSegmentLength: 2 });
      morphStartRef.current = performance.now();
      lastVRef.current = phoneme;
    }
    
    const animateFrame = () => {
      const f = morphFnRef.current;
      const p = pathRef.current;
      if (f && p) {
        const tt = Math.min(1, (performance.now() - morphStartRef.current) / morphMs);
        p.setAttribute("d", f(tt));
        
        if (tt < 1) {
          requestAnimationFrame(animateFrame);
        }
      }
    };
    
    requestAnimationFrame(animateFrame);
  };

  const animateLipSync = (textToSpeak: string) => {
    const words = textToSpeak.split(' ');
    let wordIndex = 0;
    let charIndex = 0;
    
    const animate = () => {
      if (wordIndex >= words.length) {
        updateMouthShape("X");
        return;
      }
      
      const currentWord = words[wordIndex];
      if (charIndex >= currentWord.length) {
        wordIndex++;
        charIndex = 0;
        updateMouthShape("X");
        animationRef.current = requestAnimationFrame(() => {
          setTimeout(animate, 200);
        });
        return;
      }
      
      const currentChar = currentWord[charIndex];
      const phoneme = getPhonemeForChar(currentChar);
      updateMouthShape(phoneme);
      
      charIndex++;
      animationRef.current = requestAnimationFrame(() => {
        setTimeout(animate, 120);
      });
    };
    
    animate();
  };

  const handleSpeak = () => {
    if (!text.trim()) return;
    
    if (isPlaying) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      updateMouthShape("X");
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onstart = () => {
      setIsPlaying(true);
      animateLipSync(text);
    };
    
    utterance.onend = () => {
      setIsPlaying(false);
      updateMouthShape("X");
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    
    utterance.onerror = () => {
      setIsPlaying(false);
      updateMouthShape("X");
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    
    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      speechSynthesis.cancel();
    };
  }, []);

  return (
    <div style={{fontFamily:"system-ui, sans-serif", background:"#0b1020", color:"#e9efff", minHeight:"100vh", padding:"24px"}}>
      <h1 style={{margin:"0 0 8px"}}>Web Speech API Lip Sync (No API Required)</h1>
      <p style={{opacity:.85, marginTop:0}}>
        Browser-native text-to-speech with real-time lip sync animation. Works immediately without any setup or API keys!
      </p>

      <div style={{display:"grid", gridTemplateColumns:"1fr 360px", gap:16}}>
        <section style={{background:"#111831", border:"1px solid #1f2a4a", borderRadius:12, padding:14}}>
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
              {isPlaying ? "⏹ Stop" : "▶︎ Speak"}
            </button>
            <span style={{opacity:.8, alignSelf:"center"}}>{isPlaying ? "Speaking..." : "Ready"}</span>
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
