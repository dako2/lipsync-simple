import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Play, Square, Volume2 } from 'lucide-react'
import './App.css'

function App() {
  const [text, setText] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPhoneme, setCurrentPhoneme] = useState<keyof typeof phonemeShapes>('neutral')
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const animationRef = useRef<NodeJS.Timeout | null>(null)

  const phonemeShapes = {
    neutral: 'M 50 60 Q 50 65 50 70 Q 50 65 50 60',
    A: 'M 45 55 Q 50 75 55 55',
    E: 'M 47 58 Q 50 68 53 58', 
    I: 'M 48 60 Q 50 65 52 60',
    O: 'M 45 60 Q 50 75 55 60 Q 50 65 45 60',
    U: 'M 47 62 Q 50 70 53 62',
    M: 'M 48 62 L 52 62',
    F: 'M 48 65 L 52 60',
    S: 'M 48 61 Q 50 63 52 61'
  }

  const getPhonemeForChar = (char: string): keyof typeof phonemeShapes => {
    const vowels: Record<string, keyof typeof phonemeShapes> = {
      'a': 'A', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U'
    }
    const consonants: Record<string, keyof typeof phonemeShapes> = {
      'm': 'M', 'p': 'M', 'b': 'M',
      'f': 'F', 'v': 'F',
      's': 'S', 'z': 'S', 'sh': 'S'
    }
    
    const lowerChar = char.toLowerCase()
    return vowels[lowerChar] || consonants[lowerChar] || 'neutral'
  }

  const animateLipSync = (textToSpeak: string) => {
    const words = textToSpeak.split(' ')
    let wordIndex = 0
    let charIndex = 0
    
    const animate = () => {
      if (wordIndex >= words.length) {
        setCurrentPhoneme('neutral')
        return
      }
      
      const currentWord = words[wordIndex]
      if (charIndex >= currentWord.length) {
        wordIndex++
        charIndex = 0
        setCurrentPhoneme('neutral')
        animationRef.current = setTimeout(animate, 200)
        return
      }
      
      const currentChar = currentWord[charIndex]
      const phoneme = getPhonemeForChar(currentChar)
      setCurrentPhoneme(phoneme)
      
      charIndex++
      animationRef.current = setTimeout(animate, 150)
    }
    
    animate()
  }

  const handleSpeak = () => {
    if (!text.trim()) return
    
    if (isPlaying) {
      speechSynthesis.cancel()
      setIsPlaying(false)
      setCurrentPhoneme('neutral')
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.8
    utterance.pitch = 1
    utterance.volume = 1
    
    utterance.onstart = () => {
      setIsPlaying(true)
      animateLipSync(text)
    }
    
    utterance.onend = () => {
      setIsPlaying(false)
      setCurrentPhoneme('neutral')
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
    
    utterance.onerror = () => {
      setIsPlaying(false)
      setCurrentPhoneme('neutral')
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
    
    utteranceRef.current = utterance
    speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
      speechSynthesis.cancel()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Lip Sync TTS</h1>
          <p className="text-gray-600">Type any text and watch it come to life with synchronized lip movements</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                Text Input
              </CardTitle>
              <CardDescription>
                Enter the text you want to hear spoken with lip sync animation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Type your text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-32 resize-none"
              />
              <Button 
                onClick={handleSpeak}
                className="w-full"
                disabled={!text.trim()}
              >
                {isPlaying ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Stop Speaking
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Speaking
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lip Sync Animation</CardTitle>
              <CardDescription>
                Watch the mouth movements sync with the speech
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center items-center h-64">
                <div className="relative">
                  <svg width="200" height="200" viewBox="0 0 100 100" className="border-2 border-gray-200 rounded-full bg-gradient-to-b from-pink-100 to-pink-200">
                    <circle cx="30" cy="35" r="3" fill="#333" />
                    <circle cx="70" cy="35" r="3" fill="#333" />
                    <ellipse cx="50" cy="45" rx="1" ry="2" fill="#333" />
                    <path 
                      d={phonemeShapes[currentPhoneme]} 
                      fill="none" 
                      stroke="#d97706" 
                      strokeWidth="3" 
                      strokeLinecap="round"
                      className="transition-all duration-150"
                    />
                  </svg>
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {currentPhoneme}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-center mt-4">
                <p className="text-sm text-gray-500">
                  {isPlaying ? 'Speaking...' : 'Ready to speak'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-8 text-center">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">How it works:</h3>
              <p className="text-sm text-gray-600">
                This app uses the Web Speech API for text-to-speech conversion and creates 
                synchronized lip movements based on phoneme analysis of your text. 
                Different mouth shapes correspond to different sounds for realistic lip sync animation.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App
