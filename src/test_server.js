const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const https = require('https');
const mqtt = require('mqtt');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'sys-data.json');

// --- 1. MQTT CONFIGURATION (Username/Password Only) ---
// Thay đổi localhost thành IP Broker của bạn nếu cần
const MQTT_BROKER_URL = 'mqtt://42.113.31.84:2248'; 

const mqttOptions = {
    username: 'amt', //
    password: 'amt123456', //
    reconnectPeriod: 5000
};

let latestSysData = { factories: [] };

// Tải dữ liệu ban đầu từ file
if (fs.existsSync(DATA_FILE)) {
    try {
        latestSysData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        console.error("Lỗi đọc file sys-data.json:", err);
    }
}

const mqttClient = mqtt.connect(MQTT_BROKER_URL, mqttOptions);

mqttClient.on('connect', () => {
    console.log(`✅ Connected to MQTT Broker tại ${MQTT_BROKER_URL}`);
    // Subscribe theo cấu trúc: Factory/Storage/Machine/#
    mqttClient.subscribe('#', (err) => {
        if (!err) console.log('✅ Subscribed to all topics (#)');
    });
});

// --- 2. LOGIC XỬ LÝ MESSAGE THEO CẤU TRÚC MỚI ---
mqttClient.on('message', (topic, message) => {
    const topicParts = topic.split('/');
    
    // Cấu trúc mong đợi: Factory_id/Storage_id/Machine_id/Category/Component_id
    if (topicParts.length >= 4) {
        const [fId, sId, mId, category, compId] = topicParts;
        let payload;
        
        try {
            payload = JSON.parse(message.toString());
        } catch (e) {
            // Nếu message là giá trị đơn (uint), bọc lại thành object
            payload = { status: parseInt(message.toString()) || 0 };
        }

        let dataUpdated = false;

        // Duyệt cây dữ liệu để cập nhật
        latestSysData.factories.forEach(factory => {
            if (factory.id === fId) {
                factory.storageUnits.forEach(storage => {
                    if (storage.id === sId) {
                        storage.machineUnits.forEach(machine => {
                            if (machine.id === mId) {
                                if (!machine.components) machine.components = [];

                                // Tạo ID duy nhất cho linh kiện trong máy
                                const fullCompId = compId ? `${category}_${compId}` : category;
                                
                                const existingCompIdx = machine.components.findIndex(c => c.id === fullCompId);
                                
                                const componentData = {
                                    id: fullCompId,
                                    name: compId || category,
                                    category: category, // Digital INPUT, Digital OUTPUT, System_monitor
                                    ...payload,
                                    lastUpdate: new Date().toISOString()
                                };

                                if (existingCompIdx > -1) {
                                    machine.components[existingCompIdx] = { 
                                        ...machine.components[existingCompIdx], 
                                        ...componentData 
                                    };
                                } else {
                                    machine.components.push(componentData);
                                }
                                dataUpdated = true;
                            }
                        });
                    }
                });
            }
        });

        if (dataUpdated) {
            // Broadcast tới Web UI qua Socket.io
            if (global.io) {
                global.io.emit('system-data-updated', latestSysData);
            }
            // Lưu file local (Async để không chặn event loop)
            fs.writeFile(DATA_FILE, JSON.stringify(latestSysData, null, 4), () => {});
        }
    }
});

mqttClient.on('error', (err) => console.error('❌ MQTT Error:', err));

// --- 3. SERVER HTTPS & SOCKET.IO ---
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/load-data', (req, res) => res.json(latestSysData));

app.post('/api/save-data', (req, res) => {
    latestSysData = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(latestSysData, null, 4), (err) => {
        if (err) return res.status(500).json({ success: false });
        global.io.emit('system-data-updated', latestSysData);
        res.json({ success: true });
    });
});

const server = https.createServer(sslOptions, app);
global.io = new Server(server, { cors: { origin: "*" } });

global.io.on('connection', (socket) => {
    console.log(`💻 Web client connected: ${socket.id}`);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server chạy tại: https://localhost:${PORT}`);
});