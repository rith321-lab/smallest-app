import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { STORAGE_CONFIG } from '@/app/lib/storage-config';

const { TRANSCRIPT_DIR } = STORAGE_CONFIG;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('filename');

        if (!filename) {
            return NextResponse.json(
                { error: 'Filename is required' },
                { status: 400 }
            );
        }

        const sanitizedFilename = path.basename(filename);
        const transcriptFilename = sanitizedFilename.replace('.wav', '.txt');
        const filePath = path.join(TRANSCRIPT_DIR, transcriptFilename);

        try {
            await fs.access(filePath);
        } catch {
            return NextResponse.json(
                { success: true, content: null, exists: false },
                { status: 200 }
            );
        }

        const content = await fs.readFile(filePath, 'utf-8');

        return NextResponse.json({
            success: true,
            content,
            exists: true,
            filename: transcriptFilename
        });
    } catch (error: unknown) {
        console.error('Get transcript error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get transcript';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
