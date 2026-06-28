import express from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import mqtt from 'mqtt';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { publicIpv4 } from 'public-ip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_PUBLIC_IP = await publicIpv4();
console.log(`🌍 Server Public IP resolved: ${SERVER_PUBLIC_IP}`);

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const DATA_FILE = path.join(__dirname, 'sys-data.json');
let messageCount = 0;

const LOCAL_IP = '172.17.0.1'; 
const INFLUX_URL = process.env.INFLUX_URL || `http://${LOCAL_IP}:8086`;
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '6cDudw35AmidCnSwv4wvRApiTYWaOir5hoctURjyaWO12I3bjQCNR461IpcprEaOiBxRynkBraNBuoGEFXqObA==';
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
  } catch (err) {}
};

function writeToInfluxDB(topic, payload) {
  const parts = topic.split('/');
  if (parts.length < 4) return;
  const f_id = parts[0], s_id = parts[1], m_type = parts[2], m_id = parts[3];
  
  const point = new Point('machine_telemetry')
    .tag('factory_id', f_id).tag('warehouse_id', s_id)
    .tag('machine_type', m_type).tag('machine_id', m_id);

  let hasData = false;
  if (payload['Control Mode'] !== undefined && String(payload['Control Mode']) === "2") {
    if (payload['Enabled'] !== undefined) { point.intField('motors_enabled', parseInt(payload['Enabled'])); hasData = true; }
    if (payload['Motor 1 State'] !== undefined) { point.intField('motor_1_state', parseInt(payload['Motor 1 State'])); hasData = true; }
    if (payload['Motor 2 State'] !== undefined) { point.intField('motor_2_state', parseInt(payload['Motor 2 State'])); hasData = true; }
  }
  if (payload['output']) {
    for (const k of Object.keys(payload['output'])) {
      if (payload['output'][k].rpm !== undefined) { point.floatField(`output_${k}_rpm`, parseFloat(payload['output'][k].rpm)); hasData = true; }
      if (payload['output'][k].status !== undefined) { point.intField(`output_${k}_status`, parseInt(payload['output'][k].status)); hasData = true; }
    }
  }
  if (hasData) writeApi.writePoint(point);
}

const mqttClient = mqtt.connect(`mqtt://${LOCAL_IP}:2248`, { username: 'amt', password: 'amt123456' });
mqttClient.on('connect', () => {
  mqttClient.subscribe('+/+/+/+/motor/status', (err) => {});
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

const PORT = process.env.PORT || 1224;
let server = fs.existsSync('key.pem') && fs.existsSync('cert.pem') ? 
    https.createServer({ key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem') }, app) : 
    http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Starting Server...\n🏠 Local: https://localhost:${PORT}\n🌍 Public: https://${SERVER_PUBLIC_IP}:${PORT}`);
});