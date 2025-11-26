/**
 * @jest-environment node
 */
const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const express = require('express');

describe('Backend Tests', () => {
    let io, serverSocket, clientSocket, httpServer, app;

    beforeAll((done) => {
        app = express();
        httpServer = createServer(app);
        io = new Server(httpServer);

        // Use the real socket handler
        const setupSocketIO = require('../socketHandler');
        setupSocketIO(io);

        httpServer.listen(() => {
            const port = httpServer.address().port;
            clientSocket = new Client(`http://localhost:${port}`);
            io.on('connection', (socket) => {
                serverSocket = socket;
            });
            clientSocket.on('connect', done);
        });
    });

    afterAll(() => {
        io.close();
        clientSocket.close();
        httpServer.close();
    });

    test('should handle login event', (done) => {
        const userData = { name: 'Test User', nationality: 'Testland', interests: [] };
        // We can't easily verify the server state without exposing it, 
        // but we can verify we don't crash and maybe check logs if we could spy on console.
        // For now, just emit and ensure no error.
        clientSocket.emit('login', userData);
        // Give it a moment to process
        setTimeout(() => {
            done();
        }, 100);
    });

    test('should create private room', (done) => {
        clientSocket.emit('login', { name: 'Test User' });

        clientSocket.on('private_room_created', (data) => {
            expect(data.roomCode).toBeDefined();
            expect(data.roomId).toBeDefined();
            done();
        });

        clientSocket.emit('create_private');
    });
});
