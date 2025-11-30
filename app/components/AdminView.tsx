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
    totalDurationHours?: number;
    uniqueSpeakers?: number;
}

interface AdminViewProps {
    onBack: () => void;
}

export default function AdminView({ onBack }: AdminViewProps) {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [editingFilename, setEditingFilename] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ speakerId: '', sampleId: '' });
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending' | 'complete'>('all');
    const [searchQuery, setSearchQuery] = useState('');

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

    // Filter recordings based on filter and search query
    const filteredRecordings = recordings.filter(rec => {
        // Apply status filter
        if (filter === 'pending' && rec.hasTranscript) return false;
        if (filter === 'complete' && !rec.hasTranscript) return false;
        
        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return rec.filename.toLowerCase().includes(query) ||
                   rec.speakerId.toLowerCase().includes(query);
        }
        return true;
    });

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Calculate estimated hours (assuming 30 seconds per recording)
    const estimatedHours = stats ? (stats.totalFiles * 30 / 3600).toFixed(1) : '0';
    
    // Calculate unique speakers
    const uniqueSpeakers = new Set(recordings.map(r => r.speakerId)).size;

    const handleExport = () => {
        window.location.href = '/api/export-dataset';
    };

    const handleEdit = (rec: Recording) => {
        setEditingFilename(rec.filename);
        setEditForm({ speakerId: rec.speakerId, sampleId: rec.sampleId });
    };

    const handleCancelEdit = () => {
        setEditingFilename(null);
        setEditForm({ speakerId: '', sampleId: '' });
    };

    const handleSave = async (originalFilename: string) => {
        setSaving(true);
        try {
            const res = await fetch('/api/update-recording', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalFilename,
                    newSpeakerId: editForm.speakerId,
                    newSampleId: editForm.sampleId
                })
            });

            const data = await res.json();
            if (data.success) {
                setEditingFilename(null);
                await fetchRecordings();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error('Update error:', error);
            alert('Failed to update recording');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}? This cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch('/api/delete-recording', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });

            const data = await res.json();
            if (data.success) {
                await fetchRecordings();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete recording');
        }
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-xs font-medium uppercase">Total Recordings</h3>
                            <p className="text-2xl font-bold mt-1">{stats.totalFiles}</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-xs font-medium uppercase">Est. Hours</h3>
                            <p className="text-2xl font-bold mt-1">{estimatedHours}h</p>
                            <p className="text-xs text-slate-500">of 5000h goal</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-xs font-medium uppercase">Unique Speakers</h3>
                            <p className="text-2xl font-bold mt-1">{uniqueSpeakers}</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-xs font-medium uppercase">Total Size</h3>
                            <p className="text-2xl font-bold mt-1">{formatBytes(stats.totalSize)}</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-slate-400 text-xs font-medium uppercase">Transcribed</h3>
                            <p className="text-2xl font-bold mt-1 text-emerald-400">
                                {stats.totalFiles > 0
                                    ? Math.round((stats.totalTranscribed / stats.totalFiles) * 100)
                                    : 0}%
                            </p>
                            <p className="text-xs text-slate-500">{stats.totalTranscribed} / {stats.totalFiles}</p>
                        </div>
                    </div>
                )}

                {/* Progress Bar */}
                {stats && stats.totalFiles > 0 && (
                    <div className="mb-8">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Dataset Progress</span>
                            <span className="text-emerald-400">{estimatedHours}h / 5000h ({((parseFloat(estimatedHours) / 5000) * 100).toFixed(2)}%)</span>
                        </div>
                        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                                style={{ width: `${Math.min((parseFloat(estimatedHours) / 5000) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Filter Controls */}
                <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            All ({recordings.length})
                        </button>
                        <button
                            onClick={() => setFilter('pending')}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            Pending ({recordings.filter(r => !r.hasTranscript).length})
                        </button>
                        <button
                            onClick={() => setFilter('complete')}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === 'complete' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            Complete ({recordings.filter(r => r.hasTranscript).length})
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="Search by filename or speaker ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 min-w-[200px] px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                </div>

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
                                    <th className="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {loading && recordings.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-500">
                                            Loading recordings...
                                        </td>
                                    </tr>
                                ) : filteredRecordings.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-500">
                                            {recordings.length === 0 ? 'No recordings found yet. Start a conversation!' : 'No recordings match your filter.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecordings.map((rec) => {
                                        const isEditing = editingFilename === rec.filename;
                                        return (
                                            <tr key={rec.filename} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="p-4 font-mono text-sm text-blue-300">
                                                    {rec.filename}
                                                </td>
                                                <td className="p-4">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editForm.speakerId}
                                                            onChange={(e) => setEditForm({ ...editForm, speakerId: e.target.value })}
                                                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
                                                            placeholder="0000"
                                                            maxLength={4}
                                                        />
                                                    ) : (
                                                        rec.speakerId
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editForm.sampleId}
                                                            onChange={(e) => setEditForm({ ...editForm, sampleId: e.target.value })}
                                                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
                                                            placeholder="001"
                                                            maxLength={3}
                                                        />
                                                    ) : (
                                                        rec.sampleId
                                                    )}
                                                </td>
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
                                                <td className="p-4">
                                                    <div className="flex gap-2 justify-center">
                                                        {isEditing ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleSave(rec.filename)}
                                                                    disabled={saving}
                                                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded text-xs transition-colors"
                                                                    title="Save"
                                                                >
                                                                    💾
                                                                </button>
                                                                <button
                                                                    onClick={handleCancelEdit}
                                                                    disabled={saving}
                                                                    className="px-2 py-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 rounded text-xs transition-colors"
                                                                    title="Cancel"
                                                                >
                                                                    ❌
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handleEdit(rec)}
                                                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(rec.filename)}
                                                                    className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
