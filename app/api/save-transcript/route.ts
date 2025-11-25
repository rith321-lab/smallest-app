import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data', 'recordings', 'spa');
const TRANSCRIPT_DIR = path.join(DATA_DIR, 'transcripts');

async function ensureDirectories() {
    await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
    try {
        await ensureDirectories();

        const { speakerId, sampleId, transcript, soundEvents } = await request.json();

        if (!speakerId || !sampleId || !transcript) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Generate filename: spa_0001_001.txt
        const filename = `spa_${speakerId.padStart(4, '0')}_${sampleId.padStart(3, '0')}.txt`;
        const outputPath = path.join(TRANSCRIPT_DIR, filename);

        // Format transcript with SSML-style tags
        let formattedTranscript = `<speech>\n${transcript}`;

        // Add sound event tags if present
        if (soundEvents && soundEvents.length > 0) {
            formattedTranscript += `\n${soundEvents.map((event: string) => `<${event.toLowerCase()}/>`).join(' ')}`;
        }

        formattedTranscript += '\n</speech>';

        // Save transcript
        await fs.writeFile(outputPath, formattedTranscript, 'utf-8');

        return NextResponse.json({
            success: true,
            filename,
            path: outputPath
        });
    } catch (error: any) {
        console.error('Transcript save error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to save transcript' },
            { status: 500 }
        );
    }
}
