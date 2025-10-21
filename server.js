const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Express аппты түзүү
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Порт номери
const PORT = 7007;

// Статик файлдарды кызмат көрсөтүү
app.use(express.static(path.join(__dirname, 'public')));

// Негизги бет
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Бөлмөлөрдү сактоо
const rooms = {};

// Socket.IO байланыштары
io.on('connection', (socket) => {
    console.log('Жаңы колдонуучу кошулду:', socket.id);
    
    // Echo функциясы - келген билдирүүнү кайра жөнөтүү
    socket.on('test-message', (data) => {
        console.log('Билдирүү алынды:', data);
        socket.emit('echo-response', data);
    });
    
    // Бөлмөгө кошулуу
  socket.on('join-room', (roomId, username) => {
    console.log(`User ${username} joined room ${roomId}`);
    
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    
    rooms[roomId].push({ id: socket.id, username: username });
    socket.roomId = roomId;
    socket.username = username;
    
    socket.join(roomId);
    
    // Send current users list to the new user
    socket.emit('users-in-room', rooms[roomId]);
    
    // Notify others in the room about new user
    socket.to(roomId).emit('user-joined', { userId: socket.id, username: username });
    
    // Send updated users list to all users in room
    io.to(roomId).emit('users-in-room', rooms[roomId]);
    
    console.log(`Room ${roomId} now has ${rooms[roomId].length} users`);
  });    // Текст билдирүү
    socket.on('chat-message', (data) => {
        if (socket.room) {
            // Бөлмөдөгү башкаларга жөнөтүү
            socket.to(socket.room).emit('chat-message', {
                username: socket.username,
                message: data.message,
                timestamp: new Date().toLocaleTimeString()
            });
        }
    });
    
    // WebRTC сигналдары
    socket.on('offer', (data) => {
        socket.to(data.target).emit('offer', {
            offer: data.offer,
            sender: socket.id,
            senderName: socket.username
        });
    });
    
    socket.on('answer', (data) => {
        socket.to(data.target).emit('answer', {
            answer: data.answer,
            sender: socket.id,
            senderName: socket.username
        });
    });
    
    socket.on('ice-candidate', (data) => {
        socket.to(data.target).emit('ice-candidate', {
            candidate: data.candidate,
            sender: socket.id
        });
    });
    
    // Ажыратуу
      socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId && rooms[socket.roomId]) {
      // Remove user from room
      rooms[socket.roomId] = rooms[socket.roomId].filter(user => user.id !== socket.id);
      
      if (rooms[socket.roomId].length === 0) {
        delete rooms[socket.roomId];
        console.log(`Room ${socket.roomId} deleted (no users left)`);
      } else {
        // Notify others about user leaving
        socket.to(socket.roomId).emit('user-left', { userId: socket.id, username: socket.username });
        // Send updated users list to remaining users
        io.to(socket.roomId).emit('users-in-room', rooms[socket.roomId]);
        console.log(`User ${socket.username} left room ${socket.roomId}. ${rooms[socket.roomId].length} users remaining`);
      }
    }
  });
});

// Серверди баштоо
server.listen(PORT, () => {
    console.log(`Сервер иштеп жатат: http://localhost:${PORT}`);
});