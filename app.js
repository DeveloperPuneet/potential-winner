const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files if needed
app.use(express.static('public'));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store connected players
let rooms = {};

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Check for existing rooms
    const roomKeys = Object.keys(rooms);
    let roomId = null;

    for (const key of roomKeys) {
        if (rooms[key].length < 2) {
            roomId = key;
            break;
        }
    }

    // If no room is available, create a new one
    if (!roomId) {
        roomId = `room_${roomKeys.length + 1}`;
        rooms[roomId] = [];
    }

    // Add player to the room
    rooms[roomId].push(socket.id);
    socket.join(roomId);

    // Notify players in the room
    if (rooms[roomId].length === 2) {
        io.to(roomId).emit('playerConnected', rooms[roomId]);
    }

    socket.on('moveRope', (playerId) => {
        const direction = rooms[roomId][0] === playerId ? 'left' : 'right';
        const playerIndex = rooms[roomId].indexOf(playerId);
        const playerOffset = playerIndex === 0 ? -20 : 20; // Move left for player 1, right for player 2
        io.to(roomId).emit('updateRope', direction);
        io.to(roomId).emit('movePlayer', { playerId, offset: playerOffset });
    });

    socket.on('restartGame', () => {
        rooms[roomId] = [];
        io.to(roomId).emit('restart');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
