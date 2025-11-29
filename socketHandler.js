const { Server } = require('socket.io');

// Store connected users and queue
const users = new Map(); // socket.id -> { name, nationality, interests }
const queue = []; // Array of socket.id
const privateRooms = new Map(); // roomCode -> roomId
const conversationData = new Map(); // roomId -> { turnCount, startTime, totalDuration }
const roomTimers = {};

function setupSocketIO(io) {
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('login', (userData) => {
            users.set(socket.id, userData);
            console.log('User logged in:', userData.name);
        });

        socket.on('create_private', () => {
            const user = users.get(socket.id);
            if (!user) return;

            // Generate a 6-digit room code
            const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
            const roomId = `private_${socket.id}_${roomCode}`;
            privateRooms.set(roomCode, roomId);

            socket.join(roomId);
            socket.emit('private_room_created', { roomCode, roomId });
            console.log(`${user.name} created private room with code: ${roomCode}`);
        });

        socket.on('join_private', (roomCode) => {
            const user = users.get(socket.id);
            if (!user) return;

            const roomId = privateRooms.get(roomCode);
            if (!roomId) {
                socket.emit('join_error', { message: 'Invalid room code' });
                return;
            }

            const room = io.sockets.adapter.rooms.get(roomId);
            if (!room || room.size === 0) {
                socket.emit('join_error', { message: 'Room not found' });
                return;
            }

            if (room.size >= 2) {
                socket.emit('join_error', { message: 'Room is full' });
                return;
            }

            socket.join(roomId);
            const partnerId = Array.from(room).find(id => id !== socket.id);
            const partner = users.get(partnerId);

            // Notify both
            io.to(roomId).emit('match_found', { roomId });
            socket.emit('partner_info', partner);
            io.to(partnerId).emit('partner_info', user);

            console.log(`${user.name} joined private room ${roomCode}`);
        });

        socket.on('find_match', () => {
            const user = users.get(socket.id);
            if (!user) return;

            // Check if already in queue
            if (queue.includes(socket.id)) return;

            // Matchmaking Logic
            if (queue.length > 0) {
                let partnerId = null;
                let partnerIndex = -1;

                // 1. Try to find a match with shared interests
                for (let i = 0; i < queue.length; i++) {
                    const potentialPartnerId = queue[i];
                    const potentialPartner = users.get(potentialPartnerId);

                    if (potentialPartner) {
                        const sharedInterests = user.interests.filter(interest =>
                            potentialPartner.interests.includes(interest)
                        );

                        if (sharedInterests.length > 0) {
                            partnerId = potentialPartnerId;
                            partnerIndex = i;
                            console.log(`Match found based on shared interests: ${sharedInterests.join(', ')}`);
                            break;
                        }
                    }
                }

                // 2. Fallback: If no interest match, take the first person (FIFO)
                if (!partnerId) {
                    partnerId = queue[0];
                    partnerIndex = 0;
                    console.log('No interest match found, using fallback (FIFO)');
                }

                // Remove partner from queue
                queue.splice(partnerIndex, 1);

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

        const roomReadiness = new Map(); // roomId -> Set(socketId)

        socket.on('ready_to_start', (roomId) => {
            const room = io.sockets.adapter.rooms.get(roomId);
            if (room && room.size === 2) {
                // Track readiness
                if (!roomReadiness.has(roomId)) {
                    roomReadiness.set(roomId, new Set());
                }
                roomReadiness.get(roomId).add(socket.id);

                // Only start if both are ready
                if (roomReadiness.get(roomId).size === 2) {
                    // Initialize conversation data
                    conversationData.set(roomId, {
                        turnCount: 0,
                        startTime: Date.now(),
                        totalDuration: 10 * 60 * 1000, // 10 minutes
                        maxTurns: 20
                    });

                    // Start the conversation
                    // Decide who goes first randomly
                    const clients = Array.from(room);
                    const firstSpeaker = clients[Math.floor(Math.random() * clients.length)];

                    io.to(roomId).emit('conversation_start', {
                        firstSpeaker,
                        startTime: Date.now()
                    });

                    // Start turn timer
                    startTurnTimer(io, roomId, firstSpeaker);

                    // Start total conversation timer (10 minutes)
                    setTimeout(() => {
                        if (conversationData.has(roomId)) {
                            io.to(roomId).emit('conversation_ended', { reason: 'time_limit' });
                            cleanupRoom(roomId);
                        }
                    }, 10 * 60 * 1000);

                    // Cleanup readiness map
                    roomReadiness.delete(roomId);
                }
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
}

function startTurnTimer(io, roomId, currentSpeakerId) {
    // 30 seconds per turn
    const DURATION = 30000;

    if (roomTimers[roomId]) clearTimeout(roomTimers[roomId]);

    console.log(`Starting turn timer for room ${roomId}, current speaker: ${currentSpeakerId}`);

    roomTimers[roomId] = setTimeout(() => {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (!room || room.size < 2) {
            console.log(`Room ${roomId} invalid or empty, stopping timer`);
            return;
        }

        const convData = conversationData.get(roomId);
        if (!convData) {
            console.log(`No conversation data for ${roomId}`);
            return;
        }

        // Increment turn count
        convData.turnCount++;
        console.log(`Turn switched in ${roomId}. New count: ${convData.turnCount}`);

        // Check if we reached max turns (20)
        if (convData.turnCount >= convData.maxTurns) {
            console.log(`Max turns reached in ${roomId}`);
            io.to(roomId).emit('conversation_ended', { reason: 'max_turns' });
            cleanupRoom(roomId);
            return;
        }

        const clients = Array.from(room);
        const nextSpeaker = clients.find(id => id !== currentSpeakerId);

        io.to(roomId).emit('switch_turn', {
            nextSpeaker,
            timestamp: Date.now(),
            turnNumber: convData.turnCount + 1,
            totalTurns: convData.maxTurns
        });

        startTurnTimer(io, roomId, nextSpeaker);
    }, DURATION);
}

function cleanupRoom(roomId) {
    if (roomTimers[roomId]) {
        clearTimeout(roomTimers[roomId]);
        delete roomTimers[roomId];
    }
    conversationData.delete(roomId);
    // Remove from privateRooms if it exists
    for (const [code, id] of privateRooms.entries()) {
        if (id === roomId) {
            privateRooms.delete(code);
            break;
        }
    }
}

module.exports = setupSocketIO;
