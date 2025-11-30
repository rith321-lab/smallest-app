'use client';

import { useState, useEffect, useRef } from 'react';

interface LiveCaptionsProps {
    isActive: boolean;
    isSpeaking: boolean;
    speakerName: string;
    language?: string;
}

interface CaptionEntry {
    text: string;
    speaker: string;
    timestamp: number;
    isFinal: boolean;
}

export default function LiveCaptions({ isActive, isSpeaking, speakerName, language = 'es-ES' }: LiveCaptionsProps) {
    const [captions, setCaptions] = useState<CaptionEntry[]>([]);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const captionsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Check if Web Speech API is supported
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onend = () => {
            setIsListening(false);
            // Restart if still active and speaking
            if (isActive && isSpeaking && recognitionRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    console.log('Recognition restart failed:', e);
                }
            }
        };

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                setCaptions(prev => [...prev, {
                    text: finalTranscript,
                    speaker: speakerName,
                    timestamp: Date.now(),
                    isFinal: true
                }]);
                setCurrentTranscript('');
            } else {
                setCurrentTranscript(interimTranscript);
            }
        };

        recognition.onerror = (event: any) => {
            console.log('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                setIsSupported(false);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore errors on cleanup
                }
            }
        };
    }, [language]);

    // Start/stop recognition based on active state and speaking turn
    useEffect(() => {
        if (!recognitionRef.current || !isSupported) return;

        if (isActive && isSpeaking) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                // Already started
            }
        } else {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Already stopped
            }
        }
    }, [isActive, isSpeaking, isSupported]);

    // Auto-scroll to bottom when new captions arrive
    useEffect(() => {
        if (captionsContainerRef.current) {
            captionsContainerRef.current.scrollTop = captionsContainerRef.current.scrollHeight;
        }
    }, [captions, currentTranscript]);

    if (!isSupported) {
        return (
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">Live captions not supported in this browser</p>
            </div>
        );
    }

    if (!isActive) {
        return null;
    }

    return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="px-3 py-2 bg-slate-700/50 border-b border-slate-600 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Live Captions</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isListening ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-400'}`}>
                    {isListening ? 'Listening...' : 'Paused'}
                </span>
            </div>
            <div 
                ref={captionsContainerRef}
                className="p-3 h-32 overflow-y-auto text-sm space-y-2"
            >
                {captions.length === 0 && !currentTranscript && (
                    <p className="text-slate-500 text-center text-xs">
                        Captions will appear here as you speak...
                    </p>
                )}
                {captions.map((caption, index) => (
                    <div key={index} className="text-slate-300">
                        <span className="text-blue-400 font-medium">{caption.speaker}: </span>
                        {caption.text}
                    </div>
                ))}
                {currentTranscript && (
                    <div className="text-slate-400 italic">
                        <span className="text-blue-400/70 font-medium">{speakerName}: </span>
                        {currentTranscript}
                    </div>
                )}
            </div>
        </div>
    );
}
