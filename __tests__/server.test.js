/**
 * @jest-environment node
 */
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const express = require('express');

describe('Backend Socket Tests', () => {
    let io, serverSocket, clientSocket1, clientSocket2, httpServer, app;

    beforeAll((done) => {
        app = express();
        httpServer = createServer(app);
        io = new Server(httpServer);

        // Use the real socket handler
        const setupSocketIO = require('../socketHandler');
        setupSocketIO(io);

        httpServer.listen(() => {
            const port = httpServer.address().port;
            const url = `http://localhost:${port}`;

            clientSocket1 = new Client(url);
            clientSocket2 = new Client(url);

            let connectedCount = 0;
            const onConnect = () => {
                connectedCount++;
                if (connectedCount === 2) done();
            };

            clientSocket1.on('connect', onConnect);
            clientSocket2.on('connect', onConnect);
        });
    });

    afterAll(() => {
        io.close();
        clientSocket1.close();
        clientSocket2.close();
        httpServer.close();
    });

    beforeEach(() => {
        // Clear any previous listeners to avoid side effects
        clientSocket1.removeAllListeners();
        clientSocket2.removeAllListeners();
    });

    test('should handle login', (done) => {
        const userData = { name: 'User 1', nationality: 'Testland', interests: [] };
        // We can't verify server state directly, but we can verify no errors
        clientSocket1.emit('login', userData);
        setTimeout(done, 50);
    });

    test('should match two users in queue', (done) => {
        clientSocket1.emit('login', { name: 'User 1', interests: ['Tech'] });
        clientSocket2.emit('login', { name: 'User 2', interests: ['Art'] });

        let matchCount = 0;
        const onMatch = (data) => {
            expect(data.roomId).toBeDefined();
            matchCount++;
            if (matchCount === 2) done();
        };

        clientSocket1.on('match_found', onMatch);
        clientSocket2.on('match_found', onMatch);

        clientSocket1.emit('find_match');
        setTimeout(() => {
            clientSocket2.emit('find_match');
        }, 50);
    });

    test('should create and join private room', (done) => {
        clientSocket1.emit('login', { name: 'User 1', interests: [] });
        clientSocket2.emit('login', { name: 'User 2', interests: [] });

        clientSocket1.on('private_room_created', ({ roomCode }) => {
            expect(roomCode).toBeDefined();

            // User 2 joins
            clientSocket2.emit('join_private', roomCode);
        });

        clientSocket2.on('match_found', (data) => {
            expect(data.roomId).toBeDefined();
            done();
        });

        clientSocket1.emit('create_private');
    });

    test('should relay signaling data', (done) => {
        const signalData = { type: 'offer', sdp: '...' };

        // Setup listeners first
        clientSocket2.on('signal', (data) => {
            expect(data.signal).toEqual(signalData);
            expect(data.from).toBe(clientSocket1.id);
            done();
        });

        // We need them to be in a room or just know each other's ID
        // The server implementation relies on `to` field
        clientSocket1.emit('signal', {
            to: clientSocket2.id,
            signal: signalData
        });
    });
});
