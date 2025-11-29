'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface TurnRecording {
    blob: Blob;
    speaker: 'me' | 'partner';
    speakerName: string;
    turnNumber: number;
    url: string;
}

interface ConversationRoomProps {
    socket: Socket;
    roomId: string;
    userData: { name: string; nationality: string };
    partnerData: { name: string; nationality: string };
    onEnd: (recordings: Blob[], metadata: any) => void;
}

export default function ConversationRoom({ socket, roomId, userData, partnerData, onEnd }: ConversationRoomProps) {
    const [status, setStatus] = useState<'connecting' | 'waiting' | 'my_turn' | 'their_turn'>('connecting');
    const [connectionStatus, setConnectionStatus] = useState<string>('initializing'); // new, checking, connected, etc.
    const [timeLeft, setTimeLeft] = useState(30);
    const [recordings, setRecordings] = useState<Blob[]>([]);
    const [turnNumber, setTurnNumber] = useState(1);
    const [totalTurns, setTotalTurns] = useState(20);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [speakerOrder, setSpeakerOrder] = useState<('A' | 'B')[]>([]); // Track who spoke each turn
    const [conversationHistory, setConversationHistory] = useState<TurnRecording[]>([]);
    const [playingIndex, setPlayingIndex] = useState<number | null>(null);
    const [showHistory, setShowHistory] = useState(true);
    const [isSequentialPlayback, setIsSequentialPlayback] = useState(false);

    const historyAudioRef = useRef<HTMLAudioElement | null>(null);

    const localStreamRef = useRef<MediaStream | null>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const remoteRecorderRef = useRef<MediaRecorder | null>(null); // For recording partner's audio
    const currentChunkRef = useRef<Blob[]>([]);
    const remoteChunkRef = useRef<Blob[]>([]); // For partner's audio chunks
    const recordingsRef = useRef<Blob[]>([]); // Track recordings synchronously
    const conversationStartTime = useRef<number>(0);
    const isUserSpeakerA = useRef<boolean>(false); // Track if user is speaker A
    const currentTurnRef = useRef<number>(1);
    const remoteStreamRef = useRef<MediaStream | null>(null); // Store remote stream for recording
    const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]); // Queue ICE candidates
    const makingOfferRef = useRef<boolean>(false); // Track if we're making an offer
    const isReadyToStartRef = useRef<boolean>(false); // Track if we have told server we are ready
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Initialize WebRTC and Socket listeners
        const init = async () => {
            try {
                // Request 24kHz audio
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: 24000,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });
                localStreamRef.current = stream;

                // Create Peer Connection
                const peer = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                peerRef.current = peer;

                // Monitor Connection State
                peer.oniceconnectionstatechange = () => {
                    console.log('ICE Connection State:', peer.iceConnectionState);
                    setConnectionStatus(peer.iceConnectionState);

                    if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
                        // Only signal ready when we have a solid connection
                        if (!isReadyToStartRef.current) {
                            console.log('Audio connected! Signaling ready to start.');
                            if (connectionTimeoutRef.current) {
                                clearTimeout(connectionTimeoutRef.current);
                            }
                            socket.emit('ready_to_start', roomId);
                            isReadyToStartRef.current = true;
                        }
                    } else if (peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'disconnected') {
                        console.warn('ICE Connection failed or disconnected');
                        // Optionally handle reconnection logic here
                    }
                };

                // Timeout: If WebRTC doesn't connect in 10 seconds, proceed anyway
                connectionTimeoutRef.current = setTimeout(() => {
                    if (!isReadyToStartRef.current) {
                        console.warn('WebRTC connection timeout - proceeding anyway');
                        setConnectionStatus('timeout');
                        socket.emit('ready_to_start', roomId);
                        isReadyToStartRef.current = true;
                    }
                }, 10000);

                // Add local tracks
                stream.getTracks().forEach(track => peer.addTrack(track, stream));

                // Handle remote stream
                peer.ontrack = (event) => {
                    console.log('Received remote track');
                    remoteStreamRef.current = event.streams[0];
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = event.streams[0];
                        remoteAudioRef.current.play().catch(e => console.error('Error playing remote audio ontrack:', e));
                    }
                };

                // Handle ICE candidates
                peer.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('signal', { to: roomId, signal: { type: 'candidate', candidate: event.candidate } });
                    }
                };

                // Socket Signal Handling with proper state management
                socket.on('signal', async (data) => {
                    if (data.from === socket.id) return; // Ignore self

                    const { signal } = data;

                    try {
                        if (signal.type === 'offer') {
                            // Handle offer - check if we can accept it
                            const offerCollision = makingOfferRef.current || peer.signalingState !== 'stable';

                            if (offerCollision) {
                                // We're the impolite peer if we have higher socket ID
                                const isPolite = (socket.id || '') < data.from;
                                if (!isPolite) {
                                    // Ignore the offer, we'll keep our own
                                    return;
                                }
                                // We're polite, rollback our offer
                                await peer.setLocalDescription({ type: 'rollback' });
                            }

                            await peer.setRemoteDescription(new RTCSessionDescription(signal));

                            // Process any queued ICE candidates
                            while (pendingCandidatesRef.current.length > 0) {
                                const candidate = pendingCandidatesRef.current.shift();
                                if (candidate) {
                                    await peer.addIceCandidate(candidate).catch(e => console.warn('Error adding queued candidate:', e));
                                }
                            }

                            const answer = await peer.createAnswer();
                            await peer.setLocalDescription(answer);
                            socket.emit('signal', { to: roomId, signal: answer });

                        } else if (signal.type === 'answer') {
                            // Only set answer if we're expecting one
                            if (peer.signalingState === 'have-local-offer') {
                                await peer.setRemoteDescription(new RTCSessionDescription(signal));

                                // Process any queued ICE candidates
                                while (pendingCandidatesRef.current.length > 0) {
                                    const candidate = pendingCandidatesRef.current.shift();
                                    if (candidate) {
                                        await peer.addIceCandidate(candidate).catch(e => console.warn('Error adding queued candidate:', e));
                                    }
                                }
                            }

                        } else if (signal.type === 'candidate' && signal.candidate) {
                            // Queue candidates if remote description not set yet
                            if (!peer.remoteDescription || !peer.remoteDescription.type) {
                                pendingCandidatesRef.current.push(new RTCIceCandidate(signal.candidate));
                            } else {
                                await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
                            }
                        }
                    } catch (err) {
                        console.error('Error handling signal:', err);
                    }
                });

                // Initiate negotiation immediately to establish connection BEFORE starting game
                makingOfferRef.current = true;
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                socket.emit('signal', { to: roomId, signal: offer });
                makingOfferRef.current = false;

            } catch (err) {
                console.error('Error initializing:', err);
                setConnectionStatus('error');
            }
        };

        init();

        // Game Logic Listeners
        socket.on('conversation_start', async ({ firstSpeaker, startTime }) => {
            console.log('Conversation starting! Audio should be ready.');
            conversationStartTime.current = Date.now();
            const iAmFirst = firstSpeaker === socket.id;
            isUserSpeakerA.current = iAmFirst; // First speaker is A
            currentTurnRef.current = 1;

            setStatus(iAmFirst ? 'my_turn' : 'their_turn');
            setTimeLeft(30);
            setTurnNumber(1);
            setSpeakerOrder([iAmFirst ? 'A' : 'B']); // First turn

            if (iAmFirst) {
                unmuteMic();
                startRecording();
            } else {
                muteMic();
                // Start recording partner's audio
                startRemoteRecording();
            }
        });

        socket.on('switch_turn', ({ nextSpeaker, turnNumber: turn, totalTurns: total }) => {
            setTimeLeft(30);
            if (turn) setTurnNumber(turn);
            if (total) setTotalTurns(total);

            const iAmSpeaking = nextSpeaker === socket.id;
            const speaker = isUserSpeakerA.current === iAmSpeaking ? 'A' : 'B';
            setSpeakerOrder(prev => [...prev, speaker]);

            if (iAmSpeaking) {
                // Stop recording partner's audio and save to history
                stopRemoteRecording();

                setStatus('my_turn');
                unmuteMic();
                startRecording();
                currentTurnRef.current = turn || currentTurnRef.current + 1;
            } else {
                // Stop my recording and save to history
                stopRecording();

                setStatus('their_turn');
                muteMic();
                currentTurnRef.current = turn || currentTurnRef.current + 1;

                // Start recording partner's audio
                startRemoteRecording();
            }
        });

        socket.on('conversation_ended', (data) => {
            // Stop both local and remote recorders
            stopRecording();
            stopRemoteRecording();

            // Wait a bit for the last recordings to be processed
            setTimeout(() => {
                cleanup();
                const metadata = {
                    speakerOrder,
                    userIsSpeakerA: isUserSpeakerA.current,
                    userName: userData.name,
                    partnerName: partnerData.name,
                    totalTurns: speakerOrder.length,
                    endReason: data?.reason || 'manual'
                };
                console.log('Ending conversation with recordings:', recordingsRef.current.length);
                onEnd(recordingsRef.current, metadata);
            }, 800); // Increased delay for both recorders to finish
        });

        return () => {
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
            }
            cleanup();
        };
    }, [roomId, socket]);

    // Timer countdown
    useEffect(() => {
        if (status === 'connecting' || status === 'waiting') return;

        const interval = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
            setElapsedTime(Math.floor((Date.now() - conversationStartTime.current) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [status]);

    // Ensure audio plays when it's their turn
    useEffect(() => {
        if (status === 'their_turn' && remoteAudioRef.current) {
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play().catch(e => console.error('Error playing remote audio:', e));
        }
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

        // Ensure previous recorder is stopped
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        try {
            let options: MediaRecorderOptions = {
                audioBitsPerSecond: 128000
            };
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options = { ...options, mimeType: 'audio/webm;codecs=opus' };
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                options = { ...options, mimeType: 'audio/webm' };
            }
            // Safari often supports empty options best, or audio/mp4, but let's stick to webm preference or default

            const turnAtStart = currentTurnRef.current;
            const recorder = new MediaRecorder(localStreamRef.current, options);

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    currentChunkRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(currentChunkRef.current, { type: 'audio/webm' });
                if (blob.size > 0) {
                    recordingsRef.current = [...recordingsRef.current, blob];
                    setRecordings(prev => [...prev, blob]);

                    // Add to conversation history
                    const url = URL.createObjectURL(blob);
                    const historyEntry: TurnRecording = {
                        blob,
                        speaker: 'me',
                        speakerName: userData.name,
                        turnNumber: turnAtStart,
                        url
                    };
                    setConversationHistory(prev => [...prev, historyEntry]);
                }
                currentChunkRef.current = [];
            };

            // Request data every 1 second
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
        } catch (err) {
            console.error('Failed to start recording:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const startRemoteRecording = () => {
        if (!remoteStreamRef.current) {
            console.log('No remote stream available for recording');
            return;
        }

        // Check if stream is active and has tracks
        if (!remoteStreamRef.current.active || remoteStreamRef.current.getAudioTracks().length === 0) {
            console.warn('Remote stream is inactive or has no audio tracks!');
            return;
        }

        // Ensure previous recorder is stopped
        if (remoteRecorderRef.current && remoteRecorderRef.current.state !== 'inactive') {
            remoteRecorderRef.current.stop();
        }

        try {
            let options: MediaRecorderOptions = {
                audioBitsPerSecond: 128000
            };
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options = { ...options, mimeType: 'audio/webm;codecs=opus' };
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                options = { ...options, mimeType: 'audio/webm' };
            }

            const turnAtStart = currentTurnRef.current;
            const recorder = new MediaRecorder(remoteStreamRef.current, options);

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    remoteChunkRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(remoteChunkRef.current, { type: 'audio/webm' });
                if (blob.size > 0) {
                    // Add to recordings for saving (same as local recordings)
                    recordingsRef.current = [...recordingsRef.current, blob];
                    setRecordings(prev => [...prev, blob]);

                    // Add to conversation history for playback
                    const url = URL.createObjectURL(blob);
                    const historyEntry: TurnRecording = {
                        blob,
                        speaker: 'partner',
                        speakerName: partnerData.name,
                        turnNumber: turnAtStart,
                        url
                    };
                    setConversationHistory(prev => [...prev, historyEntry]);
                }
                remoteChunkRef.current = [];
            };

            // Request data every 1 second
            recorder.start(1000);
            remoteRecorderRef.current = recorder;
        } catch (err) {
            console.error('Failed to start remote recording:', err);
        }
    };

    const stopRemoteRecording = () => {
        if (remoteRecorderRef.current && remoteRecorderRef.current.state !== 'inactive') {
            remoteRecorderRef.current.stop();
        }
    };

    const handleEnd = () => {
        socket.emit('end_conversation', roomId);
    };

    const playHistoryRecording = (index: number) => {
        if (historyAudioRef.current && conversationHistory[index]) {
            // Stop any currently playing audio
            historyAudioRef.current.pause();
            historyAudioRef.current.currentTime = 0;

            historyAudioRef.current.src = conversationHistory[index].url;
            historyAudioRef.current.play()
                .then(() => setPlayingIndex(index))
                .catch(e => console.error('Error playing history audio:', e));
        }
    };

    const stopHistoryPlayback = () => {
        if (historyAudioRef.current) {
            historyAudioRef.current.pause();
            historyAudioRef.current.currentTime = 0;
        }
        setPlayingIndex(null);
        setIsSequentialPlayback(false);
    };

    const playAllHistory = () => {
        if (conversationHistory.length > 0) {
            setIsSequentialPlayback(true);
            playHistoryRecording(0);
        }
    };

    // Handle audio ended event - play next in sequence if sequential playback
    useEffect(() => {
        const audio = historyAudioRef.current;
        if (audio) {
            const handleEnded = () => {
                if (isSequentialPlayback && playingIndex !== null) {
                    const nextIndex = playingIndex + 1;
                    if (nextIndex < conversationHistory.length) {
                        playHistoryRecording(nextIndex);
                    } else {
                        // Finished all recordings
                        setPlayingIndex(null);
                        setIsSequentialPlayback(false);
                    }
                } else {
                    setPlayingIndex(null);
                }
            };
            audio.addEventListener('ended', handleEnded);
            return () => audio.removeEventListener('ended', handleEnded);
        }
    }, [isSequentialPlayback, playingIndex, conversationHistory.length]);

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
                        <div className="text-xs text-blue-400 mt-2">
                            Turn {turnNumber}/{totalTurns}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} / 10:00
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
                            {/* Visual indicator that audio is active */}
                            <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-emerald-400/70">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                Audio Active
                            </div>
                        </div>
                    )}

                    {status === 'waiting' && (
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-slate-400">Establishing Audio Connection...</div>
                            <div className={`text-xs px-2 py-1 rounded ${connectionStatus === 'connected' || connectionStatus === 'completed'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : connectionStatus === 'timeout'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : connectionStatus === 'failed'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-slate-700 text-slate-400'
                                }`}>
                                {connectionStatus === 'timeout'
                                    ? 'Connection timeout - Starting anyway'
                                    : `Status: ${connectionStatus}`}
                            </div>
                        </div>
                    )}

                    {status === 'connecting' && (
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-slate-400">Establishing Audio Connection...</div>
                            <div className={`text-xs px-2 py-1 rounded ${connectionStatus === 'connected' || connectionStatus === 'completed'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : connectionStatus === 'timeout'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : connectionStatus === 'failed'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-slate-700 text-slate-400'
                                }`}>
                                {connectionStatus === 'timeout'
                                    ? 'Connection timeout - Starting anyway'
                                    : `Status: ${connectionStatus}`}
                            </div>
                        </div>
                    )}
                </div>

                {/* Conversation History Panel */}
                {conversationHistory.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                <span className={`transform transition-transform ${showHistory ? 'rotate-90' : ''}`}>▶</span>
                                <span>🎧 Conversation History ({conversationHistory.length} turns)</span>
                            </button>
                            {playingIndex !== null && (
                                <div className="flex items-center gap-2">
                                    {isSequentialPlayback && (
                                        <span className="text-xs text-blue-400 animate-pulse">
                                            Playing {playingIndex + 1}/{conversationHistory.length}
                                        </span>
                                    )}
                                    <button
                                        onClick={stopHistoryPlayback}
                                        className="text-xs px-3 py-1 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30 transition-colors"
                                    >
                                        ⏹ Stop
                                    </button>
                                </div>
                            )}
                        </div>

                        {showHistory && (
                            <div className="bg-slate-900/50 rounded-xl border border-slate-700 p-4 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
                                <div className="space-y-2">
                                    {conversationHistory.map((turn, index) => (
                                        <div
                                            key={`${turn.turnNumber}-${turn.speaker}-${index}`}
                                            className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${playingIndex === index
                                                ? 'bg-blue-500/20 border border-blue-500/50 shadow-lg shadow-blue-500/10'
                                                : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                                                }`}
                                            onClick={() => {
                                                if (playingIndex === index) {
                                                    stopHistoryPlayback();
                                                } else {
                                                    setIsSequentialPlayback(false);
                                                    playHistoryRecording(index);
                                                }
                                            }}
                                        >
                                            {/* Speaker Avatar */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${turn.speaker === 'me' ? 'bg-blue-500' : 'bg-emerald-500'
                                                }`}>
                                                {turn.speakerName[0]}
                                            </div>

                                            {/* Turn Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-medium text-slate-300">
                                                        Turn {turn.turnNumber}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${turn.speaker === 'me'
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : 'bg-emerald-500/20 text-emerald-400'
                                                        }`}>
                                                        {turn.speaker === 'me' ? 'You' : turn.speakerName}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Play/Pause Button */}
                                            <button
                                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${playingIndex === index
                                                    ? 'bg-blue-500 text-white animate-pulse'
                                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                                    }`}
                                            >
                                                {playingIndex === index ? '⏸' : '▶'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Controls */}
                <div className="flex justify-center gap-4 flex-wrap">
                    {conversationHistory.length > 0 && (
                        <button
                            onClick={playAllHistory}
                            disabled={playingIndex !== null}
                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all flex items-center gap-2"
                        >
                            🎧 Play All History
                        </button>
                    )}
                    <button
                        onClick={handleEnd}
                        className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg shadow-red-500/20 transition-all"
                    >
                        End Conversation
                    </button>
                </div>

                {/* Hidden Audio Elements */}
                <audio ref={remoteAudioRef} autoPlay playsInline controls={false} />
                <audio ref={historyAudioRef} className="hidden" />
            </div>
        </div>
    );
}
