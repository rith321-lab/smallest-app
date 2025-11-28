/**
 * @jest-environment node
 */
import { POST as saveConversation } from '../app/api/save-conversation/route';
import { GET as listRecordings } from '../app/api/list-recordings/route';
import { POST as deleteRecording } from '../app/api/delete-recording/route';
import { NextRequest } from 'next/server';

// Mock fs and child_process
jest.mock('fs/promises');
jest.mock('child_process', () => ({
    exec: jest.fn((cmd, cb) => cb(null, 'stdout', 'stderr'))
}));

const fs = require('fs/promises');

describe('API Route Handlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock fs.mkdir to resolve
        fs.mkdir.mockResolvedValue(undefined);
        // Mock fs.writeFile to resolve
        fs.writeFile.mockResolvedValue(undefined);
        // Mock fs.unlink to resolve
        fs.unlink.mockResolvedValue(undefined);
    });

    describe('POST /api/save-conversation', () => {
        it('should return 400 if turnCount is 0', async () => {
            const formData = new FormData();
            formData.append('turnCount', '0');

            const req = new NextRequest('http://localhost/api/save-conversation', {
                method: 'POST',
                body: formData
            });

            const res = await saveConversation(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('No recordings provided');
        });

        it('should save conversation successfully', async () => {
            const formData = new FormData();
            formData.append('turnCount', '1');
            formData.append('speakerOrder', '["A"]');
            formData.append('userName', 'User1');
            formData.append('partnerName', 'User2');

            // Mock a blob
            const blob = new Blob(['fake audio'], { type: 'audio/webm' });
            formData.append('recording_0', blob);

            const req = new NextRequest('http://localhost/api/save-conversation', {
                method: 'POST',
                body: formData
            });

            const res = await saveConversation(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.conversationId).toBeDefined();
            expect(fs.writeFile).toHaveBeenCalled();
        });
    });

    describe('GET /api/list-recordings', () => {
        it('should list recordings', async () => {
            // Mock readdir to return some files
            fs.readdir.mockImplementation((path) => {
                if (path.includes('audio')) {
                    return Promise.resolve(['spa_1234_001.wav']);
                }
                if (path.includes('transcripts')) {
                    return Promise.resolve(['spa_1234_001.txt']);
                }
                return Promise.resolve([]);
            });

            // Mock stat
            fs.stat.mockResolvedValue({
                size: 1024,
                birthtime: new Date()
            });

            const res = await listRecordings();
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.recordings).toHaveLength(1);
            expect(data.recordings[0].filename).toBe('spa_1234_001.wav');
            expect(data.recordings[0].hasTranscript).toBe(true);
        });
    });

    describe('POST /api/delete-recording', () => {
        it('should delete recording', async () => {
            const req = new NextRequest('http://localhost/api/delete-recording', {
                method: 'POST',
                body: JSON.stringify({ filename: 'test.wav' })
            });

            const res = await deleteRecording(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(fs.unlink).toHaveBeenCalledTimes(2); // Audio and transcript
        });

        it('should return 400 if filename is missing', async () => {
            const req = new NextRequest('http://localhost/api/delete-recording', {
                method: 'POST',
                body: JSON.stringify({})
            });

            const res = await deleteRecording(req);

            expect(res.status).toBe(400);
        });
    });
});
