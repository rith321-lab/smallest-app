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

        app.get('/api/test', (req, res) => {
            res.status(200).json({ message: 'Hello World' });
        });

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

    test('should respond to HTTP GET request', async () => {
        const response = await request(app).get('/api/test');
        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('Hello World');
    });

    test('should work with Socket.IO', (done) => {
        clientSocket.on('hello', (arg) => {
            expect(arg).toBe('world');
            done();
        });
        serverSocket.emit('hello', 'world');
    });
});
