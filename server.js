const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();
    const httpServer = http.createServer(server);
    const io = new Server(httpServer);

    // Store connected users and queue
    const users = new Map(); // socket.id -> { name, nationality, interests }
    const queue = []; // Array of socket.id

    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('login', (userData) => {
            users.set(socket.id, userData);
            console.log('User logged in:', userData.name);
        });

        socket.on('find_match', () => {
            const user = users.get(socket.id);
            if (!user) return;

            // Check if already in queue
            if (queue.includes(socket.id)) return;

            // Simple matchmaking: if queue has someone, pair them
            if (queue.length > 0) {
                const partnerId = queue.shift();
                const partner = users.get(partnerId);

                // Create a unique room ID
                const roomId = `room_${socket.id}_${partnerId}`;

                // Join both to room
                socket.join(roomId);
                const partnerSocket = io.sockets.sockets.get(partnerId);
                if (partnerSocket) {
                    partnerSocket.join(roomId);

                    // Notify both
                    io.to(roomId).emit('match_found', { roomId });

                    // Send partner info to each
                    socket.emit('partner_info', partner);
                    partnerSocket.emit('partner_info', user);

                    console.log(`Matched ${user.name} with ${partner.name} in ${roomId}`);
                } else {
                    // Partner disconnected? Put back in queue or handle error
                    queue.push(socket.id);
                }
            } else {
                // No one waiting, add to queue
                queue.push(socket.id);
                console.log(`${user.name} added to queue`);
            }
        });

        // WebRTC Signaling
        socket.on('signal', (data) => {
            const { to, signal } = data;
            io.to(to).emit('signal', { from: socket.id, signal });
        });

        // Turn Management
        socket.on('ready_to_start', (roomId) => {
            const room = io.sockets.adapter.rooms.get(roomId);
            if (room && room.size === 2) {
                // Start the conversation
                // Decide who goes first randomly
                const clients = Array.from(room);
                const firstSpeaker = clients[Math.floor(Math.random() * clients.length)];

                io.to(roomId).emit('conversation_start', {
                    firstSpeaker,
                    startTime: Date.now()
                });

                // Start turn timer
                startTurnTimer(roomId, firstSpeaker);
            }
        });

        socket.on('end_conversation', (roomId) => {
            io.to(roomId).emit('conversation_ended');
            // Clean up timers if any
            if (roomTimers[roomId]) {
                clearTimeout(roomTimers[roomId]);
                delete roomTimers[roomId];
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            users.delete(socket.id);
            // Remove from queue if present
            const index = queue.indexOf(socket.id);
            if (index > -1) {
                queue.splice(index, 1);
            }
            // Notify partners in rooms? (Simplified for now)
        });
    });

    const roomTimers = {};

    function startTurnTimer(roomId, currentSpeakerId) {
        // 30 seconds per turn
        const DURATION = 30000;

        if (roomTimers[roomId]) clearTimeout(roomTimers[roomId]);

        roomTimers[roomId] = setTimeout(() => {
            const room = io.sockets.adapter.rooms.get(roomId);
            if (!room || room.size < 2) return;

            const clients = Array.from(room);
            const nextSpeaker = clients.find(id => id !== currentSpeakerId);

            io.to(roomId).emit('switch_turn', {
                nextSpeaker,
                timestamp: Date.now()
            });

            startTurnTimer(roomId, nextSpeaker);
        }, DURATION);
    }
    server.all(/.*/, (req, res) => {
        return handle(req, res);
    });

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${PORT}`);
    });
});
