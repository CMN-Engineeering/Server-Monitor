import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http'; // No longer need https
import mqtt from 'mqtt';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { publicIpv4 } from 'public-ip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let SERVER_PUBLIC_IP = "127.0.0.1";

try {
    SERVER_PUBLIC_IP = await publicIpv4({
        timeout: 10000
    });

    console.log(`🌍 Server Public IP resolved: ${SERVER_PUBLIC_IP}`);
} catch (err) {
    console.warn("⚠️ Unable to determine public IP.");
    console.warn(err.message);

    SERVER_PUBLIC_IP = process.env.PUBLIC_IP || "127.0.0.1";
}

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const DATA_FILE = path.join(__dirname, 'sys-data.json');
let messageCount = 0;

const LOCAL_IP = '172.17.0.1'; 
const INFLUX_URL = process.env.INFLUX_URL || `http://${LOCAL_IP}:8086`;
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'Z-eeyu5nHVK-oGgaRMsrTpJNtTR0Ukd_ZUULtKj3klr4I1Nl0I4TfSkFuhmBIXoIkfkIGXfxWmKZY0qAcNXKrg==';
const INFLUX_ORG = process.env.INFLUX_ORG || 'CMN';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'supervisory';

const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
const writeApi = influxDB.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ns');

process.on('SIGINT', async () => {
  try {
    await writeApi.close();
  } catch (e) {
    console.error('❌ Error closing InfluxDB API', e);
  }
  process.exit(0);
});

const readData = () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return { factories: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    return { factories: [] };
  }
};

const writeData = (data) => {
  try {
    // USE ASYNCHRONOUS WRITE: Prevents blocking the event loop on high-frequency MQTT updates
    fs.writeFile(DATA_FILE, JSON.stringify(data, null, 4), 'utf8', (err) => {
        if (err) console.error("❌ Error writing system data to file:", err);
    });
  } catch (err) {
      console.error("❌ Unexpected error in writeData:", err);
  }
};

function writeToInfluxDB(topic, payload) {
  console.log(`📥 Message Received on topic: ${topic}`);
  console.log(`Payload: ${JSON.stringify(payload)}`);
  const parts = topic.split('/');
  if (parts.length < 4) return;
  const f_id = parts[0], s_id = parts[1], m_type = parts[2], m_id = parts[3];
  
  const point = new Point('machine_telemetry')
    .tag('factory_id', f_id).tag('warehouse_id', s_id)
    .tag('machine_type', m_type).tag('machine_id', m_id);

  let hasData = false;
  if (payload['qraw']){
    point.floatField('qraw', parseFloat(payload['qraw'])); hasData = true;
  }
  if (payload['qfinal']){
    point.floatField('qfinal', parseFloat(payload['qfinal'])); hasData = true;
  }
  if (hasData){
    writeApi.writePoint(point);
    
    // ADD THIS LINE: Force the buffer to flush to the database immediately
    writeApi.flush().catch(err => console.error('❌ Error flushing to InfluxDB:', err));
    
    console.log(`📥 InfluxDB Point Written for ${f_id}/${s_id}/${m_type}/${m_id}`);
  }
}
const mqttClient = mqtt.connect(`mqtt://172.17.0.1:2250`, { username: 'admin', password: 'admin' });

mqttClient.on('connect', () => {
  mqttClient.subscribe('+/+/+/+/motor/status', (err) => {});
  mqttClient.subscribe('+/+/+/+/session', (err) => {});
});

mqttClient.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    writeToInfluxDB(topic, payload);
    updateDataFromMqtt(topic, payload);
  } catch (err) {}
});

function updateDataFromMqtt(topic, payload) {
  const parts = topic.split('/');
  console.log(`Topic : ${topic}`);
  console.log(`Payload : ${payload}`);
  
  if (parts.length < 4) return;
  const f_id = parts[0], s_id = parts[1], m_type = parts[2], m_id = parts[3];

  let sysData = readData();
  let updated = false;

  const factory = (sysData.factories || []).find(f => f.id === f_id);
  if (factory) {
    const storage = (factory.storageUnits || []).find(s => s.id === s_id);
    if (storage) {
      const typeObj = (storage.machine_types || []).find(t => t.type === m_type);
      if (typeObj) {
        const machine = (typeObj.machineUnits || []).find(m => m.id === m_id);
        if (machine) {
          
          if (topic.endsWith('/session')) {
              if (payload['PID'] !== undefined) { machine.pid = payload['PID']; updated = true; }
              if (payload['EID'] !== undefined) { machine.eid = String(payload['EID']).trim(); updated = true; }
              if (payload['MID'] !== undefined) { machine.mid = payload['MID']; updated = true; }
              if (payload['cf'] !== undefined) { machine.cf = payload['cf']; updated = true; }
              if (payload['qraw'] !== undefined) { machine.qraw = payload['qraw']; updated = true; }
              if (payload['qfinal'] !== undefined) { machine.qfinal = payload['qfinal']; updated = true; }
          }

          if (topic.includes('/motor/status') || payload['Control Mode'] !== undefined) {
            if (String(payload['Control Mode'] || "") === "2") {
              if (!machine.motors) machine.motors = {};
              if (payload['Enabled'] !== undefined) { machine.motors.enabled = parseInt(payload['Enabled']); updated = true; }
              if (payload['Motor 1 State'] !== undefined) { if (!machine.motors.motor_1) machine.motors.motor_1 = {}; machine.motors.motor_1.state = parseInt(payload['Motor 1 State']); updated = true; }
              if (payload['Motor 2 State'] !== undefined) { if (!machine.motors.motor_2) machine.motors.motor_2 = {}; machine.motors.motor_2.state = parseInt(payload['Motor 2 State']); updated = true; }
            }
          }
          if (payload['output']) {
            if (!machine.outputs) machine.outputs = {};
            for (const k of Object.keys(payload['output'])) {
              const output_id = `output_${k}`;
              if (machine.outputs[output_id]) {
                machine.outputs[output_id].rpm = payload['output'][k].rpm;
                if (payload['output'][k].status !== undefined) machine.outputs[output_id].status = payload['output'][k].status;
                updated = true;
              }
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

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/get-broker-ip', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const targetIp = (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') ? "localhost" : SERVER_PUBLIC_IP;
  res.json({ targetIp: targetIp });
});

app.get('/api/load-data', (req, res) => res.json(readData()));
app.post('/api/save-data', (req, res) => { writeData(req.body); mqttClient.publish('supervisory', JSON.stringify(req.body), { qos: 1}); res.json({ success: true }); });

app.get('/toggleOutputState', (req, res) => {
  const { factory_id, warehouse_id, machine_id, machine_type, output_id, output_state } = req.query;
  const out_id_num = parseInt(output_id.split("_")[1]) - 1;
  const out_state_num = parseInt(output_state);
  const publish_topic = `${factory_id}/${warehouse_id}/${machine_type}/${machine_id}/output/command`;
  const payloadDict = { id: messageCount, cmd: out_state_num, param: [out_id_num] };
  messageCount = messageCount + 1 < 1000000000 ? messageCount + 1 : 0;
  mqttClient.publish(publish_topic, JSON.stringify(payloadDict), { qos: 1 });
  res.send("OK");
});

app.get('/toggleMotorState', (req, res) => {
  const { factory_id, warehouse_id, machine_id, machine_type, motor_id, motor_state } = req.query;
  const motor_id_num = parseInt(motor_id.split("_")[1]);
  const motor_state_num = parseInt(motor_state);
  const publish_topic = `${factory_id}/${warehouse_id}/${machine_type}/${machine_id}/motor/command`;
  const payloadDict = { id: messageCount, cmd: motor_state_num, param: [motor_id_num, 0] };
  messageCount = messageCount + 1 < 1000000000 ? messageCount + 1 : 0;
  mqttClient.publish(publish_topic, JSON.stringify(payloadDict), { qos: 1 });
  res.send("OK");
});

const PORT = process.env.PORT || 1225;

// 🚀 Explicitly create an HTTP server (No HTTPS / SSL logic)
const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Starting Server...\n🏠 Local: http://localhost:${PORT}\n🌍 Public: http://${SERVER_PUBLIC_IP}:${PORT}`);
});