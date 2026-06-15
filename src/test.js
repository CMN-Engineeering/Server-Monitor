import { publicIpv4 } from "public-ip";
import mqtt from 'mqtt';

const ipv4 = await publicIpv4();
const mqttClient = mqtt.connect(`mqtt://113.22.167.238:2248`, {
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

    writeToInfluxDB(topic, payload);
    updateDataFromMqtt(topic, payload);

  } catch (err) {
    console.error(`❌ MQTT Parse Error:`, err.message);
  }
});
