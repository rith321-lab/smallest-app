import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'recordings', 'spa');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const TRANSCRIPT_DIR = path.join(DATA_DIR, 'transcripts');

export async function POST(request: NextRequest) {
    try {
        const { originalFilename, newSpeakerId, newSampleId } = await request.json();

        // Validate inputs
        if (!originalFilename || !newSpeakerId || !newSampleId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate ID formats
        if (!/^\d{4}$/.test(newSpeakerId)) {
            return NextResponse.json(
                { error: 'Speaker ID must be 4 digits' },
                { status: 400 }
            );
        }

        if (!/^\d{3}$/.test(newSampleId)) {
            return NextResponse.json(
                { error: 'Sample ID must be 3 digits' },
                { status: 400 }
            );
        }

        // Construct new filename
        const newFilename = `spa_${newSpeakerId}_${newSampleId}.wav`;

        // Check if original file exists
        const originalAudioPath = path.join(AUDIO_DIR, originalFilename);
        try {
            await fs.access(originalAudioPath);
        } catch {
            return NextResponse.json(
                { error: 'Original file not found' },
                { status: 404 }
            );
        }

        // Check if new filename would cause collision (unless it's the same)
        if (originalFilename !== newFilename) {
            const newAudioPath = path.join(AUDIO_DIR, newFilename);
            try {
                await fs.access(newAudioPath);
                return NextResponse.json(
                    { error: 'A file with this Speaker ID and Sample ID already exists' },
                    { status: 409 }
                );
            } catch {
                // File doesn't exist, good to proceed
            }

            // Rename audio file
            await fs.rename(originalAudioPath, newAudioPath);

            // Rename transcript file if it exists
            const originalTranscriptPath = path.join(TRANSCRIPT_DIR, originalFilename.replace('.wav', '.txt'));
            const newTranscriptPath = path.join(TRANSCRIPT_DIR, newFilename.replace('.wav', '.txt'));
            try {
                await fs.access(originalTranscriptPath);
                await fs.rename(originalTranscriptPath, newTranscriptPath);
            } catch {
                // Transcript doesn't exist, skip
            }
        }

        return NextResponse.json({
            success: true,
            newFilename
        });

    } catch (error: any) {
        console.error('Update recording error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update recording' },
            { status: 500 }
        );
    }
}
