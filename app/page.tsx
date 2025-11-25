'use client';

import { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import Login from './components/Login';
import Lobby from './components/Lobby';
import ConversationRoom from './components/ConversationRoom';
import AnnotationView from './components/AnnotationView';
import AdminView from './components/AdminView';

// Initialize socket outside component to avoid multiple connections
let socket: Socket;

export default function Home() {
  const [view, setView] = useState<'login' | 'lobby' | 'conversation' | 'annotation' | 'admin'>('login');
  const [userData, setUserData] = useState<{ name: string; nationality: string; interests: string[]; age: number; gender: string } | null>(null);
  const [partnerData, setPartnerData] = useState<{ name: string; nationality: string } | null>(null);
  const [matchStatus, setMatchStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [roomId, setRoomId] = useState<string>('');
  const [recordings, setRecordings] = useState<Blob[]>([]);

  useEffect(() => {
    // Connect to custom server
    socket = io();

    socket.on('connect', () => {
      console.log('Connected to server', socket.id);
    });

    socket.on('match_found', ({ roomId }) => {
      setRoomId(roomId);
      setMatchStatus('matched');
      // Wait for partner info before switching? 
      // Actually partner_info comes separately.
    });

    socket.on('partner_info', (partner) => {
      setPartnerData(partner);
      setView('conversation');
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const handleJoin = (data: { name: string; nationality: string; interests: string[]; age: number; gender: string }) => {
    setUserData(data);
    setView('lobby');
    socket.emit('login', data);
  };

  const handleFindMatch = () => {
    setMatchStatus('searching');
    socket.emit('find_match');
  };

  const handleCreatePrivate = () => {
    // TODO: Emit create_private event
  };

  const handleJoinPrivate = (code: string) => {
    // TODO: Emit join_private event
    console.log('Joining private room:', code);
  };

  const handleConversationEnd = (blobs: Blob[]) => {
    setRecordings(blobs);
    setView('annotation');
  };

  const handleAnnotationComplete = () => {
    setRecordings([]);
    setView('lobby');
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
        />
      )}

      {view === 'conversation' && userData && partnerData && (
        <ConversationRoom
          socket={socket}
          roomId={roomId}
          userData={userData}
          partnerData={partnerData}
          onEnd={handleConversationEnd}
        />
      )}

      {view === 'annotation' && (
        <AnnotationView
          recordings={recordings}
          onComplete={handleAnnotationComplete}
        />
      )}

      {view === 'admin' && (
        <AdminView onBack={() => setView(userData ? 'lobby' : 'login')} />
      )}
    </main>
  );
}
