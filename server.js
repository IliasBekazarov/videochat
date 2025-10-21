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
    socket.on('join-room', (data) => {
        const { room, username } = data;
        socket.join(room);
        socket.room = room;
        socket.username = username;
        
        // Бөлмөгө колдонуучуну кошуу
        if (!rooms[room]) {
            rooms[room] = [];
        }
        rooms[room].push({
            id: socket.id,
            username: username
        });
        
        console.log(`${username} ${room} бөлмөсүнө кошулду`);
        
        // Өзүнө ырастоо
        socket.emit('joined-room', { 
            room, 
            username,
            message: `${room} бөлмөсүнө кош келдиңиз!`
        });
        
        // Бөлмөдөгү колдонуучулардын тизмесин жөнөтүү
        socket.emit('room-users', {
            users: rooms[room].filter(user => user.id !== socket.id)
        });
        
        // Башка колдонуучуларга билдирүү
        socket.to(room).emit('user-joined', { 
            userId: socket.id, 
            username: username 
        });
    });
    
    // Текст билдирүү
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
        console.log('Колдонуучу чыкты:', socket.id);
        
        if (socket.room && rooms[socket.room]) {
            // Бөлмөдөн алып салуу
            rooms[socket.room] = rooms[socket.room].filter(user => user.id !== socket.id);
            
            // Эгер бөлмө бош болсо, аны өчүрүү
            if (rooms[socket.room].length === 0) {
                delete rooms[socket.room];
            }
            
            // Башкаларга билдирүү
            socket.to(socket.room).emit('user-left', {
                userId: socket.id,
                username: socket.username
            });
        }
    });
});

// Серверди баштоо
server.listen(PORT, () => {
    console.log(`Сервер иштеп жатат: http://localhost:${PORT}`);
});