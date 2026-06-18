import express from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import mqtt from 'mqtt';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { publicIpv4 } from 'public-ip';
import { fileURLToPath } from 'url';

// 1. Recreate __dirname (it doesn't exist by default in ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Get the Server's Public IP once at startup
const SERVER_PUBLIC_IP = await publicIpv4();
console.log(`🌍 Server Public IP resolved: ${SERVER_PUBLIC_IP}`);

const app = express();

// Trust proxy (required if you are behind Nginx or Apache to get real IPs)
app.set('trust proxy', true);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const DATA_FILE = path.join(__dirname, 'sys-data.json');
let messageCount = 0;

// ==========================================
// BACKEND INTERNAL CONNECTIONS
// ==========================================
// For backend services running on the same machine, localhost is safest.
const LOCAL_IP = '172.17.0.1'; 

// INFLUXDB SETUP
const INFLUX_URL = process.env.INFLUX_URL || `http://${LOCAL_IP}:8086`;
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '6cDudw35AmidCnSwv4wvRApiTYWaOir5hoctURjyaWO12I3bjQCNR461IpcprEaOiBxRynkBraNBuoGEFXqObA==';
const INFLUX_ORG = process.env.INFLUX_ORG || 'CMN';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'supervisory';

const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
const writeApi = influxDB.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ns'); // 'ns' precision

// Graceful shutdown for InfluxDB
process.on('SIGINT', async () => {
  try {
    await writeApi.close();
    console.log('✅ InfluxDB Write API closed.');
  } catch (e) {
    console.error('❌ Error closing InfluxDB API', e);
  }
  process.exit(0);
});

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
// INFLUXDB WRITE HELPER
// ==========================================
function writeToInfluxDB(topic, payload) {
  const parts = topic.split('/');
  if (parts.length < 4) return;

  const f_id = parts[0];
  const s_id = parts[1];
  const m_type = parts[2];
  const m_id = parts[3];

  const point = new Point('machine_telemetry')
    .tag('factory_id', f_id)
    .tag('warehouse_id', s_id)
    .tag('machine_type', m_type)
    .tag('machine_id', m_id)
    .tag('full_path', `${f_id}/${s_id}/${m_type}/${m_id}`);

  let hasData = false;

  // 1. Check and save Motor Data
  if (payload['Control Mode'] !== undefined && String(payload['Control Mode']) === "2") {
    if (payload['Enabled'] !== undefined) {
      point.intField('motors_enabled', parseInt(payload['Enabled']));
      hasData = true;
    }
    if (payload['Motor 1 State'] !== undefined) {
      point.intField('motor_1_state', parseInt(payload['Motor 1 State']));
      hasData = true;
    }
    if (payload['Motor 2 State'] !== undefined) {
      point.intField('motor_2_state', parseInt(payload['Motor 2 State']));
      hasData = true;
    }
  }

  // 2. Check and save Output Data
  if (payload['output']) {
    const outputsStatus = payload['output'];
    for (const k of Object.keys(outputsStatus)) {
      const outputData = outputsStatus[k];
     
      if (outputData.rpm !== undefined) {
        point.floatField(`output_${k}_rpm`, parseFloat(outputData.rpm));
        hasData = true;
      }
      if (outputData.status !== undefined) {
        point.intField(`output_${k}_status`, parseInt(outputData.status));
        hasData = true;
      }
    }
  }

  if (hasData) {
    writeApi.writePoint(point);
    console.log(`💾 Saved metrics to InfluxDB for: ${f_id}/${s_id}/${m_type}/${m_id}`);
  }
}

// ==========================================
// MQTT SETUP & DATA BROADCASTING LOGIC
// ==========================================
const mqttClient = mqtt.connect(`mqtt://${LOCAL_IP}:2248`, {
  username: 'amt',
  password: 'amt123456'
});

mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT Broker locally');
  mqttClient.subscribe('+/+/+/+/motor/status', (err) => {
    if (err) console.error('MQTT Subscription Error:', err);
  });
});

mqttClient.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    writeToInfluxDB(topic, payload);
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
  const m_id = parts[3];

  let sysData = readData();
  let updated = false;

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
            if (!machine.motors) machine.motors = {};
           
            if (payload['Enabled'] !== undefined) {
              machine.motors.enabled = parseInt(payload['Enabled']);
              updated = true;
            }
            if (payload['Motor 1 State'] !== undefined) {
              if (!machine.motors.motor_1) machine.motors.motor_1 = { state: 0 };
              machine.motors.motor_1.state = parseInt(payload['Motor 1 State']);
              updated = true;
            }
            if (payload['Motor 2 State'] !== undefined) {
              if (!machine.motors.motor_2) machine.motors.motor_2 = { state: 0 };
              machine.motors.motor_2.state = parseInt(payload['Motor 2 State']);
              updated = true;
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
              if (outputData.status !== undefined) {
                  machine.outputs[output_id].status = outputData.status;
              }
              updated = true;
            }
          }
        }
      }
    }
  }

  if (updated) {
    writeData(sysData);
    mqttClient.publish('supervisory', JSON.stringify(sysData), { qos: 1 });
  }
}

// ==========================================
// API ROUTES
// ==========================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 📌 NEW: Dynamic IP Route based on client location
app.get('/api/get-broker-ip', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  const isLocalhost = clientIp === '127.0.0.1' || 
                      clientIp === '::1' || 
                      clientIp === '::ffff:127.0.0.1';

  // Return localhost if accessed locally, else return the public IP
  const targetIp = isLocalhost ? "localhost" : SERVER_PUBLIC_IP;
  
  console.log(`📡 Requested Broker IP | Client IP: ${clientIp} | Sent: ${targetIp}`);
  res.json({ targetIp: targetIp });
});

app.get('/api/load-data', (req, res) => {
  res.json(readData());
});

app.post('/api/save-data', (req, res) => {
  const newData = req.body;
  writeData(newData);
 
  mqttClient.publish('supervisory', JSON.stringify(newData), { qos: 1});
  res.json({ success: true, message: "Saved successfully" });
});

app.get('/toggleOutputState', (req, res) => {
  const { factory_id, warehouse_id, machine_id, machine_type, output_id, output_state } = req.query;
 
  const out_id_num = parseInt(output_id.split("_")[1]) - 1;
  const out_state_num = parseInt(output_state);

  const publish_topic = `${factory_id}/${warehouse_id}/${machine_type}/${machine_id}/output/command`;
 
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
  const { factory_id, warehouse_id, machine_id, machine_type, motor_id, motor_state } = req.query;
 
  const motor_id_num = parseInt(motor_id.split("_")[1]);
  const motor_state_num = parseInt(motor_state);

  const publish_topic = `${factory_id}/${warehouse_id}/${machine_type}/${machine_id}/motor/command`;
 
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
  console.log(`🚀 Starting Server...`);
  console.log(`🏠 Local Access:  https://localhost:${PORT}`);
  console.log(`🌍 Public Access: https://${SERVER_PUBLIC_IP}:${PORT}`);
});