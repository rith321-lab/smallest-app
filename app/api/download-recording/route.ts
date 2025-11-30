import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { STORAGE_CONFIG } from '@/app/lib/storage-config';

const { AUDIO_DIR, TRANSCRIPT_DIR } = STORAGE_CONFIG;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('filename');
        const type = searchParams.get('type') || 'audio';

        if (!filename) {
            return NextResponse.json(
                { error: 'Filename is required' },
                { status: 400 }
            );
        }

        const sanitizedFilename = path.basename(filename);
        
        let filePath: string;
        let contentType: string;
        let downloadFilename: string;

        if (type === 'transcript') {
            const transcriptFilename = sanitizedFilename.replace('.wav', '.txt');
            filePath = path.join(TRANSCRIPT_DIR, transcriptFilename);
            contentType = 'text/plain';
            downloadFilename = transcriptFilename;
        } else {
            filePath = path.join(AUDIO_DIR, sanitizedFilename);
            contentType = 'audio/wav';
            downloadFilename = sanitizedFilename;
        }

        try {
            await fs.access(filePath);
        } catch {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        const fileBuffer = await fs.readFile(filePath);
        const uint8Array = new Uint8Array(fileBuffer);
        const blob = new Blob([uint8Array], { type: contentType });

        return new NextResponse(blob, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${downloadFilename}"`,
            },
        });
    } catch (error: unknown) {
        console.error('Download error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to download file';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
