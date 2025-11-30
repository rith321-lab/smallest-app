import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { STORAGE_CONFIG } from '@/app/lib/storage-config';

const { DATA_DIR, AUDIO_DIR, TRANSCRIPT_DIR } = STORAGE_CONFIG;

export const dynamic = 'force-dynamic'; // Ensure not cached

function generateSummary(transcript: string): string {
    if (!transcript || transcript.trim().length === 0) {
        return 'No transcript';
    }
    
    const cleanText = transcript
        .replace(/<[^>]*>/g, '')
        .replace(/\n/g, ' ')
        .trim();
    
    if (cleanText.length <= 50) {
        return cleanText || 'No transcript';
    }
    
    return cleanText.substring(0, 47) + '...';
}

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

                let speakerId = 'Unknown';
                let sampleId = 'Unknown';
                let participants = '';
                let summary = '';

                const metadataFilename = file.replace('.wav', '_metadata.json');
                const metadataPath = path.join(DATA_DIR, metadataFilename);
                
                try {
                    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                    const metadata = JSON.parse(metadataContent);
                    
                    if (metadata.speakers) {
                        const speakerA = metadata.speakers.A || 'Unknown';
                        const speakerB = metadata.speakers.B || 'Unknown';
                        participants = `${speakerA} & ${speakerB}`;
                    }
                    
                    if (metadata.transcript) {
                        summary = generateSummary(metadata.transcript);
                    }
                    
                    speakerId = participants || 'Unknown';
                    sampleId = summary || 'Unknown';
                } catch {
                    const match = file.match(/spa_(\d{4})_(\d{3})\.wav/);
                    speakerId = match ? match[1] : 'Unknown';
                    sampleId = match ? match[2] : 'Unknown';
                }

                // Check for matching transcript
                const transcriptName = file.replace('.wav', '.txt');
                const hasTranscript = transcriptFiles.includes(transcriptName);
                
                if (hasTranscript && !summary) {
                    try {
                        const transcriptPath = path.join(TRANSCRIPT_DIR, transcriptName);
                        const transcriptContent = await fs.readFile(transcriptPath, 'utf-8');
                        summary = generateSummary(transcriptContent);
                        if (summary && sampleId === 'Unknown') {
                            sampleId = summary;
                        }
                    } catch {
                        // Ignore transcript read errors
                    }
                }

                return {
                    filename: file,
                    speakerId,
                    sampleId,
                    participants,
                    summary,
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
