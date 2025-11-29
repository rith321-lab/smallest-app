'use client';

import { useState, useRef } from 'react';

interface AnnotationViewProps {
    recordings: Blob[];
    metadata?: any;
    onComplete: () => void;
}

export default function AnnotationView({ recordings, metadata, onComplete }: AnnotationViewProps) {
    const [transcript, setTranscript] = useState('');
    const [saving, setSaving] = useState(false);
    const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

    // Get speaker labels from metadata
    const getSpeakerLabel = (index: number) => {
        if (!metadata?.speakerOrder || !metadata.speakerOrder[index]) {
            return `Turn ${index + 1}`;
        }
        const speaker = metadata.speakerOrder[index];
        const speakerName = speaker === 'A'
            ? (metadata.userIsSpeakerA ? metadata.userName : metadata.partnerName)
            : (metadata.userIsSpeakerA ? metadata.partnerName : metadata.userName);
        return `Turn ${index + 1} - Speaker ${speaker} (${speakerName})`;
    };

    const insertTag = (tag: string) => {
        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = transcript;
        const newText = text.substring(0, start) + tag + text.substring(end);

        setTranscript(newText);

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(start + tag.length, start + tag.length);
            }
        }, 0);
    };


    const handlePlayTurn = (index: number) => {
        // Stop all other audio
        audioRefs.current.forEach((audio, i) => {
            if (audio && i !== index) {
                audio.pause();
                audio.currentTime = 0;
            }
        });

        const audio = audioRefs.current[index];
        if (audio) {
            if (currentPlayingIndex === index) {
                audio.pause();
                setCurrentPlayingIndex(null);
            } else {
                audio.play();
                setCurrentPlayingIndex(index);
            }
        }
    };

    const handleSubmit = async () => {
        if (!transcript.trim()) {
            alert('Please add a transcript before submitting.');
            return;
        }

        setSaving(true);

        try {
            // Save conversation as unified file
            const formData = new FormData();

            // Add all recording blobs
            recordings.forEach((blob, index) => {
                formData.append(`recording_${index}`, blob, `turn_${index}.webm`);
            });

            // Add metadata
            formData.append('speakerOrder', JSON.stringify(metadata?.speakerOrder || []));
            formData.append('userName', metadata?.userName || 'User1');
            formData.append('partnerName', metadata?.partnerName || 'User2');
            formData.append('userIsSpeakerA', String(metadata?.userIsSpeakerA || false));
            formData.append('turnCount', String(recordings.length));
            formData.append('transcript', transcript);

            const response = await fetch('/api/save-conversation', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to save conversation');
            }

            const data = await response.json();
            console.log('Conversation saved:', data);

            alert('Conversation saved successfully!');
            onComplete();
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save conversation. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-slate-900 text-white p-4">
            <div className="w-full max-w-6xl bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700 my-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                        Annotate Conversation
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Review all {recordings.length} turns and add a combined transcript
                    </p>
                </div>

                {/* Audio Recordings List */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Recordings ({recordings.length} turns)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recordings.map((blob, index) => (
                            <div
                                key={index}
                                className="bg-slate-700 p-4 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm flex items-center gap-2">
                                        {getSpeakerLabel(index)}
                                        {blob.size === 0 && (
                                            <span className="text-xs text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20" title="Empty recording">
                                                ⚠️ Silent
                                            </span>
                                        )}
                                    </span>
                                    <button
                                        onClick={() => handlePlayTurn(index)}
                                        className={`px-3 py-1 rounded ${currentPlayingIndex === index
                                            ? 'bg-red-600 hover:bg-red-500'
                                            : 'bg-blue-600 hover:bg-blue-500'
                                            } transition-colors text-sm`}
                                    >
                                        {currentPlayingIndex === index ? '⏸ Pause' : '▶ Play'}
                                    </button>
                                </div>
                                <audio
                                    ref={(el) => { audioRefs.current[index] = el; }}
                                    src={URL.createObjectURL(blob)}
                                    onEnded={() => setCurrentPlayingIndex(null)}
                                    className="hidden"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sound Event Buttons */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Quick Insert Tags</label>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => insertTag('[Laugh]')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">
                            [Laugh]
                        </button>
                        <button onClick={() => insertTag('[Cough]')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">
                            [Cough]
                        </button>
                        <button onClick={() => insertTag('[Sigh]')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">
                            [Sigh]
                        </button>
                        <button onClick={() => insertTag('[Noise]')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">
                            [Noise]
                        </button>
                    </div>
                </div>

                {/* Transcript Textarea */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium">Full Conversation Transcript</label>
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        className="w-full h-96 p-4 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none font-mono text-sm"
                        placeholder="Type or auto-transcribe the conversation here. Each turn will be labeled with [Turn X - Speaker A/B (Name)]..."
                    />
                    <p className="text-xs text-slate-500 mt-2">
                        Tip: Use the buttons above to insert sound event tags like [Laugh], [Cough], etc.
                    </p>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !transcript.trim()}
                        className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg shadow-lg transition-all"
                    >
                        {saving ? 'Saving Conversation...' : '💾 Save Conversation'}
                    </button>
                </div>

                {saving && (
                    <div className="mt-4 text-center text-sm text-slate-400">
                        Concatenating audio and saving conversation...
                    </div>
                )}
            </div>
        </div>
    );
}
