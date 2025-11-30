'use client';

import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import Login from './components/Login';
import Lobby from './components/Lobby';
import ConversationRoom from './components/ConversationRoom';
import AnnotationView from './components/AnnotationView';
import AdminView from './components/AdminView';

// Initialize socket outside component to avoid multiple connections
// let socket: Socket;

export default function Home() {
  const [view, setView] = useState<'login' | 'lobby' | 'conversation' | 'annotation' | 'admin'>('login');
  const [userData, setUserData] = useState<{ name: string; nationality: string; interests: string[]; age: number; gender: string; dialect: string; recordingDevice: string } | null>(null);
  const [partnerData, setPartnerData] = useState<{ name: string; nationality: string } | null>(null);
  const [matchStatus, setMatchStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [roomId, setRoomId] = useState<string>('');
  const [privateRoomCode, setPrivateRoomCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Blob[]>([]);
  const [conversationMetadata, setConversationMetadata] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to custom server
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server', socket.id);
    });

    socket.on('match_found', ({ roomId }) => {
      setRoomId(roomId);
      setMatchStatus('matched');
      setError(null);
    });

    socket.on('private_room_created', ({ roomCode }) => {
      setPrivateRoomCode(roomCode);
      setError(null);
    });

    socket.on('join_error', ({ message }) => {
      setError(message);
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    });

    socket.on('partner_info', (partner) => {
      setPartnerData(partner);
      setView('conversation');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleJoin = (data: { name: string; nationality: string; interests: string[]; age: number; gender: string; dialect: string; recordingDevice: string }) => {
    setUserData(data);
    setView('lobby');
    socketRef.current?.emit('login', data);
  };

  const handleFindMatch = () => {
    setMatchStatus('searching');
    setError(null);
    socketRef.current?.emit('find_match');
  };

  const handleCreatePrivate = () => {
    setError(null);
    socketRef.current?.emit('create_private');
  };

  const handleJoinPrivate = (code: string) => {
    setError(null);
    socketRef.current?.emit('join_private', code);
  };

  const handleConversationEnd = (blobs: Blob[], metadata: any) => {
    setRecordings(blobs);
    setConversationMetadata(metadata);
    setView('annotation');
  };

  const handleAnnotationComplete = () => {
    setRecordings([]);
    setView('lobby');
    setPrivateRoomCode(''); // Reset private room code
    setMatchStatus('idle');
    setError(null);
  };

  return (
    <main className="min-h-screen bg-background">
      {view === 'login' && (
        <Login
          onJoin={handleJoin}
          onAdmin={() => setView('admin')}
        />
      )}

      {view === 'lobby' && userData && (
        <Lobby
          userData={userData}
          onFindMatch={handleFindMatch}
          onCreatePrivate={handleCreatePrivate}
          onJoinPrivate={handleJoinPrivate}
          matchStatus={matchStatus}
          onAdmin={() => setView('admin')}
          privateRoomCode={privateRoomCode}
          error={error}
        />
      )}

      {view === 'conversation' && userData && partnerData && socketRef.current && (
        <ConversationRoom
          socket={socketRef.current}
          roomId={roomId}
          userData={userData}
          partnerData={partnerData}
          onEnd={handleConversationEnd}
          onAdmin={() => setView('admin')}
        />
      )}

      {view === 'annotation' && (
        <AnnotationView
          recordings={recordings}
          metadata={conversationMetadata}
          onComplete={handleAnnotationComplete}
          onAdmin={() => setView('admin')}
        />
      )}

      {view === 'admin' && (
        <AdminView onBack={() => setView(userData ? 'lobby' : 'login')} />
      )}
    </main>
  );
}
