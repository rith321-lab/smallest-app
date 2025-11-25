import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'recordings', 'spa');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const TRANSCRIPT_DIR = path.join(DATA_DIR, 'transcripts');

export const dynamic = 'force-dynamic'; // Ensure not cached

export async function GET() {
    try {
        // Ensure directories exist
        await fs.mkdir(AUDIO_DIR, { recursive: true });
        await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });

        const audioFiles = await fs.readdir(AUDIO_DIR);
        const transcriptFiles = await fs.readdir(TRANSCRIPT_DIR);

        const recordings = await Promise.all(audioFiles
            .filter(f => f.endsWith('.wav'))
            .map(async (file) => {
                const filePath = path.join(AUDIO_DIR, file);
                const stats = await fs.stat(filePath);

                // Extract IDs from filename: spa_XXXX_YYY.wav
                const match = file.match(/spa_(\d{4})_(\d{3})\.wav/);
                const speakerId = match ? match[1] : 'Unknown';
                const sampleId = match ? match[2] : 'Unknown';

                // Check for matching transcript
                const transcriptName = file.replace('.wav', '.txt');
                const hasTranscript = transcriptFiles.includes(transcriptName);

                return {
                    filename: file,
                    speakerId,
                    sampleId,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    hasAudio: true,
                    hasTranscript,
                    path: `/data/recordings/spa/audio/${file}` // Logical path
                };
            }));

        // Sort by newest first
        recordings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({
            success: true,
            recordings,
            stats: {
                totalFiles: recordings.length,
                totalSize: recordings.reduce((acc, curr) => acc + curr.size, 0),
                totalTranscribed: recordings.filter(r => r.hasTranscript).length
            }
        });

    } catch (error: any) {
        console.error('List recordings error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to list recordings' },
            { status: 500 }
        );
    }
}
