'use client';

import { useState, useRef, useEffect } from 'react';

interface AnnotationViewProps {
    recordings: Blob[];
    onComplete: () => void;
}

export default function AnnotationView({ recordings, onComplete }: AnnotationViewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [annotations, setAnnotations] = useState<string[]>(new Array(recordings.length).fill(''));
    const [transcribing, setTranscribing] = useState<boolean[]>(new Array(recordings.length).fill(false));
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const currentBlob = recordings[currentIndex];
    const audioUrl = currentBlob ? URL.createObjectURL(currentBlob) : '';

    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const handleAnnotationChange = (text: string) => {
        const newAnnotations = [...annotations];
        newAnnotations[currentIndex] = text;
        setAnnotations(newAnnotations);
    };

    const insertTag = (tag: string) => {
        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = annotations[currentIndex];
        const newText = text.substring(0, start) + tag + text.substring(end);

        const newAnnotations = [...annotations];
        newAnnotations[currentIndex] = newText;
        setAnnotations(newAnnotations);

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(start + tag.length, start + tag.length);
            }
        }, 0);
    };

    const handleTranscribe = async () => {
        const newTranscribing = [...transcribing];
        newTranscribing[currentIndex] = true;
        setTranscribing(newTranscribing);

        try {
            const formData = new FormData();
            formData.append('audio', currentBlob, 'audio.webm');

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Transcription failed');
            }

            const data = await response.json();
            const newAnnotations = [...annotations];
            newAnnotations[currentIndex] = data.text;
            setAnnotations(newAnnotations);
        } catch (error) {
            console.error('Transcription error:', error);
            alert('Failed to transcribe audio. Please try again.');
        } finally {
            const newTranscribing = [...transcribing];
            newTranscribing[currentIndex] = false;
            setTranscribing(newTranscribing);
        }
    };

    const handleNext = () => {
        if (currentIndex < recordings.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleSubmit = () => {
        // In a real app, upload blobs and text to server
        console.log('Submitting annotations:', annotations);
        // Download JSON for verification
        const data = {
            annotations: annotations.map((text, i) => ({
                segment: i + 1,
                text,
                // blob size for verification
                size: recordings[i].size
            }))
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'annotations.json';
        a.click();

        onComplete();
    };

    if (recordings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
                <h2 className="text-2xl font-bold mb-4">No recordings found.</h2>
                <button onClick={onComplete} className="text-blue-400 hover:underline">Return to Lobby</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <div className="w-full max-w-3xl bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
                <h2 className="text-2xl font-bold mb-6 text-center">Annotation Phase</h2>

                <div className="flex justify-between items-center mb-4 text-slate-400 text-sm">
                    <span>Segment {currentIndex + 1} of {recordings.length}</span>
                    <span>{Math.round(currentBlob.size / 1024)} KB</span>
                </div>

                {/* Audio Player */}
                <div className="bg-slate-900 p-6 rounded-xl mb-4 flex flex-col items-center gap-4">
                    <audio
                        ref={audioRef}
                        src={audioUrl}
                        controls
                        className="w-full"
                        key={currentIndex} // Force reload on change
                    />
                    <button
                        onClick={handleTranscribe}
                        disabled={transcribing[currentIndex]}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
                    >
                        {transcribing[currentIndex] ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Transcribing...
                            </>
                        ) : (
                            <>🎙️ Auto-Transcribe</>
                        )}
                    </button>
                </div>

                {/* Text Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Transcribe and annotate your speech:
                    </label>

                    <div className="flex gap-2 mb-2">
                        {['[Laugh]', '[Cough]', '[Sigh]', '[Noise]'].map(tag => (
                            <button
                                key={tag}
                                onClick={() => insertTag(tag)}
                                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs rounded-full border border-slate-600 transition-colors"
                            >
                                {tag}
                            </button>
                        ))}
                    </div>

                    <textarea
                        ref={textareaRef}
                        value={annotations[currentIndex]}
                        onChange={(e) => handleAnnotationChange(e.target.value)}
                        className="w-full h-40 p-4 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        placeholder="Type here..."
                    />
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center">
                    <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="px-4 py-2 bg-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-600 transition-all"
                    >
                        Previous
                    </button>

                    {currentIndex === recordings.length - 1 ? (
                        <button
                            onClick={handleSubmit}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all"
                        >
                            Submit All
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all"
                        >
                            Next Segment
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
