const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const https = require('https');
const mqtt = require('mqtt');
const { Server } = require('socket.io'); // Import Socket.io for real-time web UI updates

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'sys-data.json');

// --- 1. MQTT BROKER CONFIGURATION ---
// Use mqtts:// for TLS/SSL connections, matching your custom port 2248
const MQTT_BROKER_URL = 'mqtts://localhost:2248'; 

const mqttOptions = {
    username: 'amt', 
    password: 'amt123456',
    // Read the CA certificate file for the secure connection
    ca: fs.readFileSync('/etc/mosquitto/certs/ca.crt'),
    // If you are using a self-signed certificate and get authorization errors, 
    // you might need to temporarily set this to false, but true is safer.
    rejectUnauthorized: true 
};

let latestSysData = { factories: [] };

if (fs.existsSync(DATA_FILE)) {
    try {
        latestSysData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        console.error("Error reading initial sys-data.json:", err);
    }
}

const mqttClient = mqtt.connect(MQTT_BROKER_URL, mqttOptions);

mqttClient.on('connect', () => {
    console.log(`✅ Connected to secure Mosquitto broker at ${MQTT_BROKER_URL}`);
    
    // Subscribe to all topics using the # wildcard (matching your -t "#" command)
    mqttClient.subscribe('#', (err) => {
        if (!err) {
            console.log('✅ Subscribed to all topics pattern: #');
        } else {
            console.error('❌ Failed to subscribe to topics:', err);
        }
    });
});

// Listen for incoming messages from machines
mqttClient.on('message', (topic, message) => {
    // Expecting topic format: factoryId/storageId/machineId
    const topicParts = topic.split('/');
    
    if (topicParts.length === 3) {
        const [factoryId, storageId, machineId] = topicParts;
        const rawMessage = message.toString(); // Get the raw string message for logging
        try {
            // Assume the machine publishes an array of its components' status
            const updatedComponents = JSON.parse(message.toString());
            console.log(`✅ Received data from ${machineId} on topic ${topic}`);

            let dataUpdated = false;

            // Traverse the tree to find the specific machine and update its components
            for (let factory of latestSysData.factories) {
                if (factory.id === factoryId && factory.storageUnits) {
                    for (let storage of factory.storageUnits) {
                        if (storage.id === storageId && storage.machineUnits) {
                            for (let machine of storage.machineUnits) {
                                if (machine.id === machineId) {
                                    // Update the components array for this specific machine
                                    machine.components = updatedComponents;
                                    dataUpdated = true;
                                    break;
                                }
                            }
                        }
                        if (dataUpdated) break;
                    }
                }
                if (dataUpdated) break;
            }

            if (dataUpdated) {
                // Save to local file
                fs.writeFile(DATA_FILE, JSON.stringify(latestSysData, null, 4), 'utf8', (err) => {
                    if (err) console.error("Lỗi khi ghi file backup:", err);
                });
                
                // Broadcast the newly updated state to the web interface
                if (io) {
                    io.emit('system-data-updated', latestSysData);
                }
            } else {
                console.log(`⚠️ Received data for unknown machine path: ${topic}`);
            }

        } catch (parseError) {
            console.error(`❌ Invalid JSON received from MQTT on topic ${topic}`);
            console.log(`⚠️ RAW TEXT RECEIVED WAS:`, rawMessage); // <--- ADD THIS LINE TO DEBUG
        }
    }
});

mqttClient.on('error', (err) => {
    console.error('❌ MQTT Connection Error:', err);
});

// --- 2. EXPRESS HTTPS SERVER & SOCKET.IO CONFIGURATION ---
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

app.use(cors()); 
app.use(express.json()); 
app.use(express.static(__dirname));

app.get('/api/load-data', (req, res) => {
    res.json(latestSysData);
});

app.post('/api/save-data', (req, res) => {
    const newData = req.body;
    latestSysData = newData;

    // Optional: If you need to publish config changes back to the machines from the UI, 
    // you would iterate and publish to specific topics here instead of a global 'sys-data' topic.

    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 4), 'utf8', (err) => {
        if (err) {
            console.error("Lỗi khi ghi file:", err);
            return res.status(500).json({ success: false, message: 'Lưu dữ liệu thất bại' });
        }
        
        // Notify other web clients that the admin/operator made a change
        io.emit('system-data-updated', latestSysData);
        res.json({ success: true, message: 'Đã lưu dữ liệu' });
    });
});

// Start HTTPS Server with Socket.io attached
const server = https.createServer(sslOptions, app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
    console.log(`💻 Web client connected: ${socket.id}`);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Backend server (HTTPS) đang chạy tại: https://localhost:${PORT}`);
});