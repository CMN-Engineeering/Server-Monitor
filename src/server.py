import json
import os
from flask import Flask, request, jsonify
from flask_socketio import SocketIO
import paho.mqtt.client as mqtt

app = Flask(__name__, static_folder='.', static_url_path='')
# Allow Cross-Origin Resource Sharing for Socket.IO
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading"
)

DATA_FILE = 'sys-data.json'

# ==========================================
# DATA PARSING AND BROADCASTING LOGIC
# ==========================================
def update_data_from_mqtt(topic, payload):
    parts = topic.split('/')
    if len(parts) < 4:
        return
    f_id = parts[0]   # Factory_22
    s_id = parts[1]   # Warehouse_1
    m_id = parts[3]   # Machine_2

    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            sys_data = json.load(f)
    except FileNotFoundError:
        return

    updated = False
    
    for factory in sys_data.get('factories', []):
        if factory['id'] == f_id:
            for storage in factory.get('storageUnits', []):
                if storage['id'] == s_id:
                    for machine in storage.get('machineUnits', []):
                        if machine['id'] == m_id:
                            updated = True
                            
                            # 1. Update Motors
                            if 'motor_status' in payload:
                                status = payload["motor_status"]
                                # Note: Ensure types match what script.js expects (0/1 or True/False)
                                machine["motors"]["enabled"] = status.get("Enabled")
                                
                                # Update motor states dynamically if they exist
                                if "motor_1" in machine["motors"]:
                                    machine["motors"]["motor_1"]["state"] = status.get("Motor 1 State")
                                if "motor_2" in machine["motors"]:
                                    machine["motors"]["motor_2"]["state"] = status.get("Motor 2 State")

                            # 2. Update Inputs (Conveyors)
                            if "input" in payload:
                                inputs_status = payload["input"]
                                for k in inputs_status.keys():
                                    input_data = inputs_status[k]
                                    # Map MQTT key '2' to JSON key 'input_2'
                                    input_id = f"input_{k}"
                                    
                                    if input_id in machine["inputs"]:
                                        # machine["inputs"][input_id]["status"] = input_data.get("Status")
                                        machine["inputs"][input_id]["rpm"] = input_data.get("rpm")

    if updated:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(sys_data, f, indent=4)
        socketio.emit('system-data-updated', sys_data)
        print(f"✅ Data updated and broadcasted for {m_id}")
# ==========================================
# MQTT SETUP
# ==========================================
def on_connect(client, userdata, flags, reason_code, properties):
    print("✅ Connected to MQTT Broker")
    client.subscribe("+/+/+/+") # Subscribe to match Factory/Warehouse/Type/Machine

def on_message(client, userdata, msg):
    topic = msg.topic
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        print(f"\n📥 [MQTT IN] Topic: {topic}")
        # Uncomment below to print raw payloads in terminal
        # print(json.dumps(payload, indent=2)) 
        
        update_data_from_mqtt(topic, payload)
    except Exception as e:
        print(f"❌ MQTT Parse Error: {e}")

# Initialize MQTT Client (paho-mqtt v2 compatible)
mqtt_client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message
mqtt_client.username_pw_set(username="amt", password="amt123456")
mqtt_client.connect("localhost", 1883, 60)
mqtt_client.loop_start()

# ==========================================
# API ROUTES
# ==========================================
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/load-data', methods=['GET'])
def load_data():
    if not os.path.exists(DATA_FILE):
        return jsonify({"factories": []})
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/save-data', methods=['POST'])
def save_data():
    new_data = request.json
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, indent=4)
    # Broadcast manual UI updates
    socketio.emit('system-data-updated', new_data)
    return jsonify({"success": True, "message": "Saved successfully"})

# ==========================================
# SERVER STARTUP
# ==========================================
if __name__ == '__main__':
    print("🚀 Starting Server on port 3000...")
    
    # Configure arguments for Socket.IO
    run_kwargs = {"host": "0.0.0.0", "port": 3000, "allow_unsafe_werkzeug": True}
    
    # Check for SSL Certs to mimic Node.js HTTPS environment
    if os.path.exists('key.pem') and os.path.exists('cert.pem'):
        run_kwargs["ssl_context"] = ('cert.pem', 'key.pem')
        print("🔒 HTTPS Enabled")
    else:
        print("⚠️ SSL certs not found, falling back to HTTP")

    socketio.run(app, **run_kwargs)