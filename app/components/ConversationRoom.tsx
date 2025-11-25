'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface ConversationRoomProps {
    socket: Socket;
    roomId: string;
    userData: { name: string; nationality: string };
    partnerData: { name: string; nationality: string };
    onEnd: (recordings: Blob[]) => void;
}

export default function ConversationRoom({ socket, roomId, userData, partnerData, onEnd }: ConversationRoomProps) {
    const [status, setStatus] = useState<'connecting' | 'waiting' | 'my_turn' | 'their_turn'>('connecting');
    const [timeLeft, setTimeLeft] = useState(30);
    const [recordings, setRecordings] = useState<Blob[]>([]);

    const localStreamRef = useRef<MediaStream | null>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const currentChunkRef = useRef<Blob[]>([]);
    const recordingsRef = useRef<Blob[]>([]); // Track recordings synchronously

    useEffect(() => {
        // Initialize WebRTC and Socket listeners
        const init = async () => {
            try {
                // Request 24kHz audio
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: 24000,
                        channelCount: 1,
                        echoCancellation: true
                    },
                    video: false
                });
                localStreamRef.current = stream;

                // Create Peer Connection
                const peer = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                peerRef.current = peer;

                // Add local tracks
                stream.getTracks().forEach(track => peer.addTrack(track, stream));

                // Handle remote stream
                peer.ontrack = (event) => {
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = event.streams[0];
                    }
                };

                // Handle ICE candidates
                peer.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('signal', { to: roomId, signal: { type: 'candidate', candidate: event.candidate } });
                    }
                };

                // Socket Signal Handling
                socket.on('signal', async (data) => {
                    if (data.from === socket.id) return; // Ignore self (shouldn't happen with logic but safety)

                    const { signal } = data;
                    if (signal.type === 'offer') {
                        await peer.setRemoteDescription(new RTCSessionDescription(signal));
                        const answer = await peer.createAnswer();
                        await peer.setLocalDescription(answer);
                        socket.emit('signal', { to: roomId, signal: answer });
                    } else if (signal.type === 'answer') {
                        await peer.setRemoteDescription(new RTCSessionDescription(signal));
                    } else if (signal.type === 'candidate') {
                        await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    }
                });

                // Start Call Logic (Initiator creates offer)
                // We need a way to know who is initiator. 
                // For simplicity, let's say the one who joined first (or alphabetically) offers?
                // Actually, 'conversation_start' event tells us who starts speaking, but signaling needs to happen before or during.
                // Let's make both ready, then one offers.
                // Better: Just have both emit 'ready_to_start' and let server decide.
                // But for WebRTC, one must offer.
                // Let's use the 'match_found' (which we missed handling in this component, it happened in Lobby)
                // to trigger negotiation.
                // We'll rely on a "polite peer" or just have the one with lower ID offer.
                // For now, let's wait for 'conversation_start' to ensure we are connected? No, need audio first.

                // Let's just say: If I am the one who created the room (or some deterministic check), I offer.
                // Or simpler: Just have a "negotiate" event.

                // Let's assume the server sends 'partner_info' to both.
                // We can use that.

                socket.emit('ready_to_start', roomId);

            } catch (err) {
                console.error('Error initializing:', err);
            }
        };

        init();

        // Game Logic Listeners
        socket.on('conversation_start', ({ firstSpeaker, startTime }) => {
            setStatus(firstSpeaker === socket.id ? 'my_turn' : 'their_turn');
            setTimeLeft(30);
            if (firstSpeaker === socket.id) {
                startRecording();
                unmuteMic();
            } else {
                muteMic();
            }
        });

        socket.on('switch_turn', ({ nextSpeaker }) => {
            setTimeLeft(30);
            if (nextSpeaker === socket.id) {
                setStatus('my_turn');
                startRecording();
                unmuteMic();
            } else {
                setStatus('their_turn');
                stopRecording();
                muteMic();
            }
        });

        socket.on('conversation_ended', () => {
            stopRecording(); // Ensure last chunk is saved
            // Wait a bit for the last recording to be processed
            setTimeout(() => {
                cleanup();
                onEnd(recordingsRef.current); // Use ref to get all recordings
            }, 100);
        });

        return () => {
            cleanup();
        };
    }, [roomId, socket]);

    // Timer countdown
    useEffect(() => {
        if (status === 'connecting' || status === 'waiting') return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 0) return 0;
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [status]);

    const cleanup = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (peerRef.current) {
            peerRef.current.close();
        }
        socket.off('signal');
        socket.off('conversation_start');
        socket.off('switch_turn');
        socket.off('conversation_ended');
    };

    const muteMic = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
        }
    };

    const unmuteMic = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
        }
    };

    const startRecording = () => {
        if (!localStreamRef.current) return;

        const recorder = new MediaRecorder(localStreamRef.current, {
            mimeType: 'audio/webm;codecs=opus'
            // Note: bitsPerSecond can be set here, but sampleRate is usually fixed by context
        });

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                currentChunkRef.current.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(currentChunkRef.current, { type: 'audio/webm' });
            recordingsRef.current = [...recordingsRef.current, blob]; // Update ref synchronously
            setRecordings(prev => [...prev, blob]);
            currentChunkRef.current = [];
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const handleEnd = () => {
        socket.emit('end_conversation', roomId);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <div className="w-full max-w-4xl bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-xl font-bold">
                            {userData.name[0]}
                        </div>
                        <div>
                            <h3 className="font-bold">{userData.name}</h3>
                            <p className="text-sm text-slate-400">{userData.nationality}</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        <div className={`text-4xl font-mono font-bold ${timeLeft < 10 ? 'text-red-500' : 'text-white'}`}>
                            00:{timeLeft.toString().padStart(2, '0')}
                        </div>
                        <div className="text-xs uppercase tracking-widest text-slate-500 mt-1">
                            {status === 'my_turn' ? 'Your Turn' : status === 'their_turn' ? 'Listening' : 'Waiting'}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                        <div>
                            <h3 className="font-bold">{partnerData.name}</h3>
                            <p className="text-sm text-slate-400">{partnerData.nationality}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-xl font-bold">
                            {partnerData.name[0]}
                        </div>
                    </div>
                </div>

                {/* Visualizer / Status Area */}
                <div className="relative h-64 bg-slate-900 rounded-xl mb-8 flex items-center justify-center overflow-hidden border border-slate-700">
                    {status === 'my_turn' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-32 h-32 bg-blue-500/20 rounded-full animate-ping"></div>
                            <div className="w-24 h-24 bg-blue-500/40 rounded-full animate-pulse absolute"></div>
                            <div className="z-10 text-blue-400 font-bold text-xl">Speaking...</div>
                        </div>
                    )}

                    {status === 'their_turn' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex gap-2 items-center">
                                <div className="w-2 h-8 bg-emerald-500 animate-[bounce_1s_infinite]"></div>
                                <div className="w-2 h-12 bg-emerald-500 animate-[bounce_1.2s_infinite]"></div>
                                <div className="w-2 h-6 bg-emerald-500 animate-[bounce_0.8s_infinite]"></div>
                            </div>
                            <div className="z-10 text-emerald-400 font-bold text-xl ml-4">Listening...</div>
                        </div>
                    )}

                    {status === 'waiting' && (
                        <div className="text-slate-500">Connecting to partner...</div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex justify-center">
                    <button
                        onClick={handleEnd}
                        className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg shadow-red-500/20 transition-all"
                    >
                        End Conversation
                    </button>
                </div>

                {/* Hidden Audio Element for Remote Stream */}
                <audio ref={remoteAudioRef} autoPlay />
            </div>
        </div>
    );
}
