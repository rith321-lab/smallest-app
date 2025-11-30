import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { STORAGE_CONFIG } from '@/app/lib/storage-config';

const { TRANSCRIPT_DIR } = STORAGE_CONFIG;

export async function POST(request: NextRequest) {
    try {
        const { filename, content } = await request.json();

        if (!filename) {
            return NextResponse.json(
                { error: 'Filename is required' },
                { status: 400 }
            );
        }

        if (content === undefined) {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            );
        }

        const sanitizedFilename = path.basename(filename);
        const transcriptFilename = sanitizedFilename.replace('.wav', '.txt');
        const filePath = path.join(TRANSCRIPT_DIR, transcriptFilename);

        await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');

        return NextResponse.json({
            success: true,
            filename: transcriptFilename
        });
    } catch (error: unknown) {
        console.error('Update transcript error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update transcript';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
