import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { STORAGE_CONFIG } from '@/app/lib/storage-config';

const { AUDIO_DIR, TRANSCRIPT_DIR } = STORAGE_CONFIG;

export async function POST(request: NextRequest) {
    try {
        const { filename } = await request.json();

        if (!filename) {
            return NextResponse.json(
                { error: 'Filename is required' },
                { status: 400 }
            );
        }

        // Delete audio file
        const audioPath = path.join(AUDIO_DIR, filename);
        try {
            await fs.unlink(audioPath);
        } catch (error) {
            console.error('Error deleting audio file:', error);
            return NextResponse.json(
                { error: 'Audio file not found' },
                { status: 404 }
            );
        }

        // Delete transcript file if it exists
        const transcriptPath = path.join(TRANSCRIPT_DIR, filename.replace('.wav', '.txt'));
        try {
            await fs.unlink(transcriptPath);
        } catch {
            // Transcript doesn't exist, that's okay
        }

        return NextResponse.json({
            success: true,
            message: 'Recording deleted successfully'
        });

    } catch (error: any) {
        console.error('Delete recording error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete recording' },
            { status: 500 }
        );
    }
}
