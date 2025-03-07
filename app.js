const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const randomstring = require('randomstring');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const randomStringgenerator = async () => {
    try {
        return randomstring.generate(20);
    } catch (error) {
        console.log(error.message);
    }
}

// Serve static files if needed
app.use(express.static('public'));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store connected players
let rooms = {};

// Socket.IO connection
io.on('connection', async (socket) => {
    let botInterval; // Declare botInterval inside the connection handler

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
        let roomName = await randomStringgenerator();
        roomId = `room_${roomName}`;
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
        io.to(roomId).emit('updateRope', direction);
    });

    socket.on('restartGame', () => {
        rooms[roomId] = [];
        io.to(roomId).emit('restart');
    });

    // Check if only one player is in the room
    if (rooms[roomId].length === 1) {
        setTimeout(async () => {
            // If no second player has joined, assign a bot
            if (rooms[roomId].length === 1) {
                const botid = await randomStringgenerator();
                const botId = 'bot' + botid; // Identifier for the bot
                rooms[roomId].push(botId);
                socket.join(roomId);
                io.to(roomId).emit('playerConnected', rooms[roomId]);
                io.to(roomId).emit('botAssigned', botId); // Notify players that a bot has joined

                // Simulate bot pressing space bar at faster random intervals
                botInterval = setInterval(() => {
                    io.to(roomId).emit('botPressSpace', botId);
                }, (Math.random() * 500) + 300);
            }
        }, 15000);
    }

    socket.on('disconnect', () => {
        rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
        // Disconnect any bots in the room if a user disconnects
        clearInterval(botInterval); // Clear the bot's interval
        rooms[roomId] = rooms[roomId].filter(id => !id.startsWith('bot'));
        io.to(roomId).emit('botDisconnected'); // Notify players that the bot has been disconnected
    });
});

// Start the server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Build Completed`);
});
