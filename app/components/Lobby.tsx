'use client';

import { useState } from 'react';

interface LobbyProps {
    userData: { name: string; nationality: string; interests: string[] };
    onFindMatch: () => void;
    onCreatePrivate: () => void;
    onJoinPrivate: (code: string) => void;
    matchStatus: 'idle' | 'searching' | 'matched';
    onAdmin: () => void;
    privateRoomCode?: string;
    error?: string | null;
}

export default function Lobby({ userData, onFindMatch, onCreatePrivate, onJoinPrivate, matchStatus, onAdmin, privateRoomCode, error }: LobbyProps) {
    const [joinCode, setJoinCode] = useState('');

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
            <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
                <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Welcome, {userData.name}</h2>
                        <p className="text-slate-400 text-sm flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                            {userData.nationality}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        {userData.interests.map(i => (
                            <span key={i} className="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-300">
                                {i}
                            </span>
                        ))}
                        <button
                            onClick={onAdmin}
                            className="ml-2 text-xs px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 transition-colors flex items-center gap-2"
                            title="View Dataset Tracker"
                        >
                            <span>📊</span>
                            <span className="font-medium">Data Set Visualization</span>
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center animate-pulse">
                        ⚠️ {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Random Match */}
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all group">
                        <h3 className="text-xl font-semibold mb-2 text-blue-400">Random Match</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Pair with another annotator based on your interests.
                        </p>
                        <button
                            onClick={onFindMatch}
                            disabled={matchStatus === 'searching'}
                            className={`w-full py-3 px-4 rounded-lg font-bold transition-all ${matchStatus === 'searching'
                                ? 'bg-slate-600 cursor-not-allowed animate-pulse'
                                : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                                }`}
                        >
                            {matchStatus === 'searching' ? 'Looking for partner...' : 'Find Match'}
                        </button>
                    </div>

                    {/* Private Room */}
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-all">
                        <h3 className="text-xl font-semibold mb-2 text-emerald-400">Private Room</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Create a room or join a friend.
                        </p>
                        <div className="space-y-3">
                            {privateRoomCode ? (
                                <div className="text-center p-4 bg-emerald-900/50 rounded-lg border border-emerald-500/30">
                                    <p className="text-sm text-emerald-300 mb-1">Room Code:</p>
                                    <div className="text-3xl font-mono font-bold text-white tracking-widest mb-2">
                                        {privateRoomCode}
                                    </div>
                                    <p className="text-xs text-slate-400 animate-pulse">Waiting for partner to join...</p>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={onCreatePrivate}
                                        className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20"
                                    >
                                        Create Room
                                    </button>
                                    <div className="relative my-3">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-slate-600"></div>
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-slate-800 px-2 text-slate-500">Or join</span>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    placeholder="Enter Code"
                                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                                <button
                                    onClick={() => onJoinPrivate(joinCode)}
                                    disabled={!joinCode}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                                >
                                    Join
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
