import { useState, useCallback, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

export interface VoiceCommand {
  action: 'ON' | 'OFF'
  motor?: 'motor1' | 'motor2' | 'motor'
}

interface VoiceCommandState {
  isListening: boolean
  transcript: string
  error: string | null
  startListening: () => void
  stopListening: () => void
  clearTranscript: () => void
}

export const useVoiceCommand = (
  onCommand: (command: VoiceCommand) => void,
  language: string = 'uz'
): VoiceCommandState => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recognition, setRecognition] = useState<any>(null)
  const onCommandRef = useRef(onCommand)

  // Keep onCommand ref updated
  useEffect(() => {
    onCommandRef.current = onCommand
  }, [onCommand])

  useEffect(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionClass) {
      setError('Voice recognition is not supported in your browser')
      return
    }

    const recognitionInstance = new SpeechRecognitionClass()
    recognitionInstance.continuous = false
    recognitionInstance.interimResults = false
    
    // Set language based on current language
    const langMap: Record<string, string> = {
      'uz': 'uz-UZ',
      'ru': 'ru-RU',
      'en': 'en-US'
    }
    recognitionInstance.lang = langMap[language] || 'uz-UZ'

    recognitionInstance.onstart = () => {
      setIsListening(true)
      setError(null)
    }

    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript.trim()
      setTranscript(transcript)
      parseCommand(transcript)
    }

    recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setError(`Voice recognition error: ${event.error}`)
      setIsListening(false)
    }

    recognitionInstance.onend = () => {
      setIsListening(false)
    }

    const parseCommand = (text: string) => {
      const upperText = text.toUpperCase().trim()
      
      // Faqat 2 ta buyruq: Motor ON va Motor OFF
      // Barcha tillarda: "motor on", "motor off", "motor yoq", "motor o'chir", "насос включить", "насос выключить"
      
      // Motor ON buyruqlari (barcha tillarda - soddalashtirilgan)
      const motorOnKeywords = [
        'MOTOR ON',
        'MOTOR YOQ',
        'MOTOR OCH',
        'NASOS YOQ',
        'NASOS OCH',
        'НАСОС ВКЛЮЧИТЬ',
        'НАСОС ВКЛЮЧИ',
        'МОТОР ВКЛЮЧИТЬ',
        'МОТОР ВКЛЮЧИ',
        'ON', // Qisqa variant
        'YOQ', // Qisqa variant
        'OCH', // Qisqa variant
      ]
      
      // Motor OFF buyruqlari (barcha tillarda - soddalashtirilgan)
      const motorOffKeywords = [
        'MOTOR OFF',
        'MOTOR OCHIR',
        'MOTOR YOP',
        'MOTOR STOP',
        'MOTOR TOXTAT',
        'NASOS OCHIR',
        'NASOS YOP',
        'NASOS STOP',
        'НАСОС ВЫКЛЮЧИТЬ',
        'НАСОС ВЫКЛЮЧИ',
        'МОТОР ВЫКЛЮЧИТЬ',
        'МОТОР ВЫКЛЮЧИ',
        'OFF', // Qisqa variant
        'OCHIR', // Qisqa variant
        'YOP', // Qisqa variant
        'STOP', // Qisqa variant
        'TOXTAT', // Qisqa variant
      ]

      // Faqat to'liq so'zlar yoki asosiy kalit so'zlar bilan tekshirish
      const isMotorOn = motorOnKeywords.some(keyword => {
        // To'liq so'z yoki jumla boshi/oxiri
        return upperText === keyword || 
               upperText.startsWith(keyword + ' ') ||
               upperText.endsWith(' ' + keyword) ||
               upperText.includes(' ' + keyword + ' ')
      })
      
      const isMotorOff = motorOffKeywords.some(keyword => {
        // To'liq so'z yoki jumla boshi/oxiri
        return upperText === keyword || 
               upperText.startsWith(keyword + ' ') ||
               upperText.endsWith(' ' + keyword) ||
               upperText.includes(' ' + keyword + ' ')
      })

      if (isMotorOn) {
        onCommandRef.current({ action: 'ON' })
      } else if (isMotorOff) {
        onCommandRef.current({ action: 'OFF' })
      }
    }

    setRecognition(recognitionInstance)

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const startListening = useCallback(async () => {
    if (recognition && !isListening) {
      try {
        // Check and request microphone permission on Android
        if (Capacitor.isNativePlatform()) {
          try {
            // Request microphone permission using getUserMedia
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            // Stop the stream immediately, we just needed permission
            stream.getTracks().forEach(track => track.stop())
          } catch (permErr: any) {
            console.error('Microphone permission error:', permErr)
            if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
              setError('Microphone permission is required for voice control. Please enable it in app settings.')
              return
            } else if (permErr.name === 'NotFoundError' || permErr.name === 'DevicesNotFoundError') {
              setError('No microphone found on this device')
              return
            } else {
              setError('Failed to access microphone. Please check permissions.')
              return
            }
          }
        }
        
        recognition.start()
      } catch (err: any) {
        console.error('Failed to start recognition:', err)
        if (err.name === 'not-allowed' || err.name === 'NotAllowedError') {
          setError('Microphone permission denied. Please enable it in app settings.')
        } else if (err.name === 'no-speech') {
          setError('No speech detected. Please try again.')
        } else {
          setError('Failed to start voice recognition')
        }
      }
    }
  }, [recognition, isListening])

  const stopListening = useCallback(() => {
    if (recognition && isListening) {
      recognition.stop()
    }
  }, [recognition, isListening])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    setError(null)
  }, [])

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    clearTranscript,
  }
}

// Type declarations for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}


interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
