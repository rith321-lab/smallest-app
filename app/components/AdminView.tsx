'use client';

import { useState, useEffect } from 'react';

interface Recording {
    filename: string;
    speakerId: string;
    sampleId: string;
    size: number;
    createdAt: string;
    hasAudio: boolean;
    hasTranscript: boolean;
}

interface Stats {
    totalFiles: number;
    totalSize: number;
    totalTranscribed: number;
}

interface AdminViewProps {
    onBack: () => void;
}

export default function AdminView({ onBack }: AdminViewProps) {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchRecordings = async () => {
        try {
            const res = await fetch('/api/list-recordings');
            const data = await res.json();
            if (data.success) {
                setRecordings(data.recordings);
                setStats(data.stats);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error('Failed to fetch recordings:', error);
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch and polling every 5 seconds
    useEffect(() => {
        fetchRecordings();
        const interval = setInterval(fetchRecordings, 5000);
        return () => clearInterval(interval);
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleExport = () => {
        window.location.href = '/api/export-dataset';
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                            Dataset Tracker
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Live monitoring of incoming TTS recordings
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={onBack}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
                        >
                            Back to App
                        </button>
                        <button
                            onClick={handleExport}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
                        >
                            <span>📦</span> Download Full Dataset
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-sm font-medium uppercase">Total Recordings</h3>
                            <p className="text-3xl font-bold mt-2">{stats.totalFiles}</p>
                        </div>
                        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-sm font-medium uppercase">Total Size</h3>
                            <p className="text-3xl font-bold mt-2">{formatBytes(stats.totalSize)}</p>
                        </div>
                        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-sm font-medium uppercase">Completion Rate</h3>
                            <p className="text-3xl font-bold mt-2 text-emerald-400">
                                {stats.totalFiles > 0
                                    ? Math.round((stats.totalTranscribed / stats.totalFiles) * 100)
                                    : 0}%
                            </p>
                        </div>
                    </div>
                )}

                {/* Recordings Table */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                        <h2 className="font-semibold">Recent Recordings</h2>
                        <span className="text-xs text-slate-500">
                            Last updated: {lastUpdated.toLocaleTimeString()}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-400 text-sm">
                                <tr>
                                    <th className="p-4">Filename</th>
                                    <th className="p-4">Speaker ID</th>
                                    <th className="p-4">Sample ID</th>
                                    <th className="p-4">Size</th>
                                    <th className="p-4 text-center">Audio (WAV)</th>
                                    <th className="p-4 text-center">Transcript</th>
                                    <th className="p-4 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {loading && recordings.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-500">
                                            Loading recordings...
                                        </td>
                                    </tr>
                                ) : recordings.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-500">
                                            No recordings found yet. Start a conversation!
                                        </td>
                                    </tr>
                                ) : (
                                    recordings.map((rec) => (
                                        <tr key={rec.filename} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="p-4 font-mono text-sm text-blue-300">
                                                {rec.filename}
                                            </td>
                                            <td className="p-4">{rec.speakerId}</td>
                                            <td className="p-4">{rec.sampleId}</td>
                                            <td className="p-4 text-slate-400 text-sm">
                                                {formatBytes(rec.size)}
                                            </td>
                                            <td className="p-4 text-center">
                                                {rec.hasAudio ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900 text-emerald-200">
                                                        ✅ Saved
                                                    </span>
                                                ) : (
                                                    <span className="text-red-400">❌ Missing</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {rec.hasTranscript ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900 text-emerald-200">
                                                        ✅ Saved
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-900 text-amber-200">
                                                        ⚠️ Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right text-slate-400 text-sm">
                                                {new Date(rec.createdAt).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
