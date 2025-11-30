'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

interface AnnotationViewProps {
    recordings: Blob[];
    metadata?: any;
    onComplete: () => void;
}

const TURN_DURATION_SECONDS = 30;

const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const getTurnTimeRange = (index: number) => {
    const startSec = index * TURN_DURATION_SECONDS;
    const endSec = (index + 1) * TURN_DURATION_SECONDS;
    return `${formatTime(startSec)}-${formatTime(endSec)}`;
};

export default function AnnotationView({ recordings, metadata, onComplete }: AnnotationViewProps) {
    const [transcript, setTranscript] = useState('');
    const [saving, setSaving] = useState(false);
    const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [autoTranscribing, setAutoTranscribing] = useState(false);
    const [autoTranscribeError, setAutoTranscribeError] = useState<string | null>(null);
    const [autoTranscribeProgress, setAutoTranscribeProgress] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

    // Create stable object URLs for recordings to avoid recreating them on every render
    const audioUrls = useMemo(() => {
        console.log('Creating audio URLs for', recordings.length, 'recordings');
        return recordings.map((blob, index) => {
            const url = URL.createObjectURL(blob);
            console.log(`Recording ${index}: size=${blob.size}, type=${blob.type}, url=${url}`);
            return url;
        });
    }, [recordings]);

    // Clean up object URLs when component unmounts or recordings change
    useEffect(() => {
        return () => {
            audioUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [audioUrls]);

    // Get speaker labels from metadata with timing info
    const getSpeakerLabel = (index: number) => {
        const timeRange = getTurnTimeRange(index);
        if (!metadata?.speakerOrder || !metadata.speakerOrder[index]) {
            return `Turn ${index + 1} (${timeRange})`;
        }
        const speaker = metadata.speakerOrder[index];
        const speakerName = speaker === 'A'
            ? (metadata.userIsSpeakerA ? metadata.userName : metadata.partnerName)
            : (metadata.userIsSpeakerA ? metadata.partnerName : metadata.userName);
        return `Turn ${index + 1} - Speaker ${speaker} (${speakerName}) [${timeRange}]`;
    };

    // Build formatted transcript with labels, timing, and SSML tags
    const buildFormattedTranscript = (texts: string[]) => {
        const lines: string[] = [];
        lines.push('<speak>');
        for (let i = 0; i < texts.length; i++) {
            const label = getSpeakerLabel(i);
            const text = texts[i] || '[No audio captured]';
            // Convert annotation tags to SSML format
            const ssmlText = text
                .replace(/\[Laugh\]/gi, '<laugh/>')
                .replace(/\[Cough\]/gi, '<cough/>')
                .replace(/\[Sigh\]/gi, '<sigh/>')
                .replace(/\[Noise\]/gi, '<noise/>');
            lines.push(`<!-- ${label} -->`);
            lines.push(`<p>${ssmlText}</p>`);
            lines.push('');
        }
        lines.push('</speak>');
        return lines.join('\n');
    };

    // Auto-transcribe all turns using OpenAI Whisper
    const handleAutoTranscribe = async () => {
        setAutoTranscribing(true);
        setAutoTranscribeError(null);
        setAutoTranscribeProgress(null);

        try {
            const results: string[] = [];

            for (let i = 0; i < recordings.length; i++) {
                const blob = recordings[i];

                // Skip empty/silent recordings
                if (blob.size === 0) {
                    results.push('[No audio captured]');
                    continue;
                }

                setAutoTranscribeProgress(`Transcribing turn ${i + 1} of ${recordings.length}...`);

                const formData = new FormData();
                const file = new File(
                    [blob],
                    `turn_${i + 1}.webm`,
                    { type: blob.type || 'audio/webm' }
                );
                formData.append('audio', file);

                const res = await fetch('/api/transcribe', {
                    method: 'POST',
                    body: formData,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Failed to transcribe turn ${i + 1}`);
                }

                const data = await res.json();
                results.push(typeof data.text === 'string' ? data.text : String(data.text));
            }

            // Build formatted transcript with labels and timing
            const formatted = buildFormattedTranscript(results);
            setTranscript(formatted);
        } catch (e: any) {
            console.error('Auto-transcribe error:', e);
            setAutoTranscribeError(e.message || 'Auto-transcription failed. Please try again.');
        } finally {
            setAutoTranscribing(false);
            setAutoTranscribeProgress(null);
        }
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
        // Clear any previous error
        setPlaybackError(null);
        
        // Stop all other audio
        audioRefs.current.forEach((audio, i) => {
            if (audio && i !== index) {
                audio.pause();
                audio.currentTime = 0;
            }
        });

        const audio = audioRefs.current[index];
        const blob = recordings[index];
        
        console.log('Play click', { index, audio, blobSize: blob?.size, blobType: blob?.type });
        
        if (audio) {
            if (currentPlayingIndex === index) {
                audio.pause();
                setCurrentPlayingIndex(null);
            } else {
                audio.play()
                    .then(() => {
                        console.log('Audio playback started for turn', index);
                        setCurrentPlayingIndex(index);
                    })
                    .catch(err => {
                        console.error('Error playing annotation audio:', err);
                        const errorMsg = `Playback error for Turn ${index + 1}: ${err.message || 'Unknown error'}. Audio format: ${blob?.type || 'unknown'}`;
                        setPlaybackError(errorMsg);
                        
                        // Check if the browser can play this format
                        if (blob?.type && audio.canPlayType) {
                            const canPlay = audio.canPlayType(blob.type);
                            console.log(`Browser canPlayType('${blob.type}'): ${canPlay || 'empty string (cannot play)'}`);
                            if (!canPlay) {
                                setPlaybackError(`Your browser cannot play ${blob.type} audio format. Please try using Chrome or Firefox.`);
                            }
                        }
                    });
            }
        }
    };

    const handleSubmit = async () => {
        if (!transcript.trim()) {
            alert('Please add a transcript before submitting.');
            return;
        }

        // Validate recordings
        const silentCount = recordings.filter(blob => blob.size === 0).length;
        const totalRecordings = recordings.length;

        if (totalRecordings === 0) {
            alert('No recordings found. Cannot save conversation.');
            return;
        }

        if (silentCount === totalRecordings) {
            const confirmSave = confirm('⚠️ Warning: All recordings are silent (0 bytes). This likely means audio was not captured. Do you still want to save?');
            if (!confirmSave) return;
        } else if (silentCount > 0) {
            const confirmSave = confirm(`⚠️ Warning: ${silentCount} out of ${totalRecordings} recordings are silent. This may indicate audio issues. Continue saving?`);
            if (!confirmSave) return;
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
            
            // Add new metadata fields for TTS requirements
            formData.append('userAge', String(metadata?.userAge || ''));
            formData.append('userGender', metadata?.userGender || '');
            formData.append('userDialect', metadata?.userDialect || '');
            formData.append('userRecordingDevice', metadata?.userRecordingDevice || '');
            formData.append('userNationality', metadata?.userNationality || '');

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

                {/* Playback Error Display */}
                {playbackError && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        <strong>Audio Playback Error:</strong> {playbackError}
                    </div>
                )}

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
                                    src={audioUrls[index]}
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
                        <button
                            onClick={handleAutoTranscribe}
                            disabled={autoTranscribing || recordings.length === 0}
                            className="px-4 py-2 text-sm rounded bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                            {autoTranscribing
                                ? (autoTranscribeProgress || 'Transcribing...')
                                : 'Auto-transcribe all turns'}
                        </button>
                    </div>
                    {autoTranscribeError && (
                        <div className="mb-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {autoTranscribeError}
                        </div>
                    )}
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
