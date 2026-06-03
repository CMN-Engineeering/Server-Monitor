const express = require('express');

const fs = require('fs');

const path = require('path');

const https = require('https');

const http = require('http');

const mqtt = require('mqtt');



const app = express();



// Middleware

app.use(express.json());

app.use(express.static(path.join(__dirname, '.')));



const DATA_FILE = path.join(__dirname, 'sys-data.json');

let messageCount = 0;



// ==========================================

// UTILITIES: READ/WRITE DATA

// ==========================================

const readData = () => {

    try {

        if (!fs.existsSync(DATA_FILE)) return { factories: [] };

        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    } catch (err) {

        console.error('Error reading sys-data.json:', err);

        return { factories: [] };

    }

};



const writeData = (data) => {

    try {

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');

    } catch (err) {

        console.error('Error writing to sys-data.json:', err);

    }

};



// ==========================================

// MQTT SETUP & DATA BROADCASTING LOGIC

// ==========================================

const mqttClient = mqtt.connect('mqtt://localhost:2248', {

    username: 'amt',

    password: 'amt123456'

});



mqttClient.on('connect', () => {

    console.log('✅ Connected to MQTT Broker');

    mqttClient.subscribe('+/+/+/+/motor/status', (err) => {

        if (err) console.error('MQTT Subscription Error:', err);

    });

});



mqttClient.on('message', (topic, message) => {

    try {

        const payload = JSON.parse(message.toString());

        console.log(`\n📥 [MQTT IN] Topic: ${topic}`);

        updateDataFromMqtt(topic, payload);

    } catch (err) {

        console.error(`❌ MQTT Parse Error:`, err.message);

    }

});



function updateDataFromMqtt(topic, payload) {

    const parts = topic.split('/');

    if (parts.length < 4) return;



    const f_id = parts[0];

    const s_id = parts[1];

    // parts[2] is machine_type

    const m_id = parts[3];



    let sysData = readData();

    let updated = false;



    // Traverse structure matching the array format expected by the frontend

    const factory = (sysData.factories || []).find(f => f.id === f_id);

    if (factory) {

        const storage = (factory.storageUnits || []).find(s => s.id === s_id);

        if (storage) {

            const machine = (storage.machineUnits || []).find(m => m.id === m_id);

            if (machine) {

                

                // 1. Update Motors

                if (topic.includes('/motor/status') || payload['Control Mode'] !== undefined) {

                    const controlMode = String(payload['Control Mode'] || "");

                    

                    if (controlMode === "2") {

                        updated = true;

                        if (!machine.motors) machine.motors = {};

                        

                        if (payload['Enabled'] !== undefined) {

                            machine.motors.enabled = parseInt(payload['Enabled']);

                        }

                        if (payload['Motor 1 State'] !== undefined) {

                            if (!machine.motors.motor_1) machine.motors.motor_1 = { state: 0 };

                            machine.motors.motor_1.state = parseInt(payload['Motor 1 State']);

                        }

                        if (payload['Motor 2 State'] !== undefined) {

                            if (!machine.motors.motor_2) machine.motors.motor_2 = { state: 0 };

                            machine.motors.motor_2.state = parseInt(payload['Motor 2 State']);

                        }

                    }

                }



                // 2. Update Outputs

                if (payload['output']) {

                    const outputsStatus = payload['output'];

                    if (!machine.outputs) machine.outputs = {};

                    

                    for (const k of Object.keys(outputsStatus)) {

                        const outputData = outputsStatus[k];

                        const output_id = `output_${k}`;

                        

                        if (machine.outputs[output_id]) {

                            machine.outputs[output_id].rpm = outputData.rpm;

                            updated = true;

                        }

                    }

                }

            }

        }

    }



    if (updated) {

        writeData(sysData);

        // Push the full JSON update to listening clients on WebSocket via MQTT

        mqttClient.publish('supervisory', JSON.stringify(sysData), { qos: 0 });

        console.log(`Publish Data : ${JSON.stringify(sysData)}`)

        console.log(`✅ Data updated and broadcasted to UI for machine: ${m_id}`);

    }

}



// ==========================================

// API ROUTES

// ==========================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));

});



app.get('/api/load-data', (req, res) => {

    res.json(readData());

});



// Endpoint invoked by saveSystemData()

app.post('/api/save-data', (req, res) => {

    const newData = req.body;

    writeData(newData);

    

    // Broadcast manual UI updates (e.g. Added Factory/Machine) so other connections sync

    mqttClient.publish('supervisory', JSON.stringify(newData), { qos: 0 });

    res.json({ success: true, message: "Saved successfully" });

});



app.get('/toggleOutputState', (req, res) => {

    const { factory_id, storage_id, machine_id, machine_type, output_id, output_state } = req.query;

    

    const out_id_num = parseInt(output_id.split("_")[1]) - 1;

    const out_state_num = parseInt(output_state);



    const publish_topic = `${factory_id}/${storage_id}/${machine_type}/${machine_id}/output/command`;

    

    const payloadDict = {

        id: messageCount,

        cmd: out_state_num,

        param: [out_id_num]

    };

    

    messageCount = messageCount + 1 < 1000000000 ? messageCount + 1 : 0;

    mqttClient.publish(publish_topic, JSON.stringify(payloadDict), { qos: 1 });

    

    res.send("OK");

});



app.get('/toggleMotorState', (req, res) => {

    const { factory_id, storage_id, machine_id, machine_type, motor_id, motor_state } = req.query;

    

    const motor_id_num = parseInt(motor_id.split("_")[1]);

    const motor_state_num = parseInt(motor_state);



    const publish_topic = `${factory_id}/${storage_id}/${machine_type}/${machine_id}/motor/command`;

    

    const payloadDict = {

        id: messageCount,

        cmd: motor_state_num,

        param: [motor_id_num, 0]

    };

    

    messageCount = messageCount + 1 < 1000000000 ? messageCount + 1 : 0;

    mqttClient.publish(publish_topic, JSON.stringify(payloadDict), { qos: 1 });

    

    res.send("OK");

});



// ==========================================

// SERVER STARTUP

// ==========================================

const PORT = process.env.PORT || 3000;

let server;



// Mimic server.py HTTPS configuration

if (fs.existsSync('key.pem') && fs.existsSync('cert.pem')) {
    const options = {
        key: fs.readFileSync('key.pem'),
        cert: fs.readFileSync('cert.pem')
    };
    server = https.createServer(options, app);
    console.log("🔒 HTTPS Enabled");
} else {
    server = http.createServer(app);
    console.log("⚠️ SSL certs not found, falling back to HTTP");
}
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Starting Server on port ${PORT}...`);
});
