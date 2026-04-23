const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const mqtt = require('mqtt');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;

// Read SSL Certificates
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// Create HTTPS Server and attach Socket.io
const server = https.createServer(sslOptions, app);
const io = new Server(server);

// ==========================================
// MQTT BROKER SETUP
// ==========================================
const MQTT_BROKER = 'mqtt://localhost:1883'; // Đổi thành IP broker của bạn nếu khác
const MQTT_TOPIC = 'factory/system_data';    // Đổi thành topic bạn đang dùng

const mqttClient = mqtt.connect(MQTT_BROKER);
let latestSystemData = { factories: [] }; // Lưu tạm dữ liệu mới nhất

mqttClient.on('connect', () => {
    console.log(`📡 Đã kết nối với Mosquitto Broker tại ${MQTT_BROKER}`);
    mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (!err) console.log(`✅ Đang lắng nghe topic: ${MQTT_TOPIC}`);
    });
});

// Khi có dữ liệu mới từ máy móc đẩy lên broker
mqttClient.on('message', (topic, message) => {
    try {
        latestSystemData = JSON.parse(message.toString());
        // Bắn ngay dữ liệu mới tới toàn bộ trình duyệt đang mở
        io.emit('update-data', latestSystemData); 
    } catch (err) {
        console.error("Lỗi parse JSON từ MQTT:", err.message);
    }
});

// ==========================================
// WEBSOCKET (SOCKET.IO) SETUP
// ==========================================
io.on('connection', (socket) => {
    console.log('💻 Một người dùng Web vừa kết nối');
    // Gửi ngay dữ liệu mới nhất cho họ khi vừa load trang
    socket.emit('update-data', latestSystemData);
});

// Admin lưu cấu hình (Bắn ngược lại MQTT để broker cập nhật)
app.post('/api/save-data', (req, res) => {
    const newData = req.body;
    latestSystemData = newData; // Cập nhật local
    
    // Publish dữ liệu mới lên Broker để đồng bộ các thiết bị khác
    mqttClient.publish(MQTT_TOPIC, JSON.stringify(newData), { retain: true });
    
    res.json({ success: true, message: 'Đã lưu và đồng bộ qua MQTT' });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Web Server (HTTPS) đang chạy tại: https://localhost:${PORT}`);
});