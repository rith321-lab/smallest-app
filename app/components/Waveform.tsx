'use client';

import { useEffect, useRef, useState } from 'react';

interface WaveformProps {
    audioUrl: string;
    isPlaying: boolean;
    onSeek?: (time: number) => void;
    currentTime?: number;
    duration?: number;
}

export default function Waveform({ audioUrl, isPlaying, onSeek, currentTime = 0, duration = 0 }: WaveformProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [waveformData, setWaveformData] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Analyze audio and generate waveform data
    useEffect(() => {
        if (!audioUrl) return;

        const analyzeAudio = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(audioUrl);
                const arrayBuffer = await response.arrayBuffer();

                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Get audio data from the first channel
                const rawData = audioBuffer.getChannelData(0);
                const samples = 100; // Number of bars in the waveform
                const blockSize = Math.floor(rawData.length / samples);
                const filteredData: number[] = [];

                for (let i = 0; i < samples; i++) {
                    let sum = 0;
                    for (let j = 0; j < blockSize; j++) {
                        sum += Math.abs(rawData[i * blockSize + j]);
                    }
                    filteredData.push(sum / blockSize);
                }

                // Normalize the data
                const maxVal = Math.max(...filteredData);
                const normalizedData = filteredData.map(val => val / maxVal);

                setWaveformData(normalizedData);
                audioContext.close();
            } catch (err) {
                console.error('Error analyzing audio:', err);
                setError('Could not analyze audio');
            } finally {
                setIsLoading(false);
            }
        };

        analyzeAudio();
    }, [audioUrl]);

    // Draw waveform on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || waveformData.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const barWidth = width / waveformData.length;
        const barGap = 1;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Calculate progress position
        const progress = duration > 0 ? currentTime / duration : 0;
        const progressX = progress * width;

        // Draw waveform bars
        waveformData.forEach((value, index) => {
            const x = index * barWidth;
            const barHeight = value * (height - 4);
            const y = (height - barHeight) / 2;

            // Color based on playback progress
            if (x < progressX) {
                ctx.fillStyle = isPlaying ? '#10b981' : '#3b82f6'; // emerald when playing, blue when paused
            } else {
                ctx.fillStyle = '#475569'; // slate-600
            }

            ctx.fillRect(x + barGap / 2, y, barWidth - barGap, barHeight);
        });

        // Draw playhead
        if (duration > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(progressX - 1, 0, 2, height);
        }
    }, [waveformData, currentTime, duration, isPlaying]);

    // Handle click to seek
    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!onSeek || duration === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const progress = x / rect.width;
        const seekTime = progress * duration;

        onSeek(seekTime);
    };

    if (isLoading) {
        return (
            <div className="h-12 bg-slate-800 rounded flex items-center justify-center">
                <span className="text-xs text-slate-500">Loading waveform...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-12 bg-slate-800 rounded flex items-center justify-center">
                <span className="text-xs text-slate-500">{error}</span>
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            onClick={handleClick}
            className="w-full h-12 cursor-pointer rounded bg-slate-800"
            style={{ display: 'block' }}
        />
    );
}
