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
    
    f_id = parts[0]   # Factory_id
    s_id = parts[1]   # Warehouse_id
    # parts[2] is Tank_Conveyor
    m_id = parts[3]   # Machine_id (Make sure your topic is .../Tank_Conveyor/Machine_ID/motor_status)

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
                            
                            # 1. Update Motors based on payload
                            if "motor_status" in topic or "Control Mode" in payload:
                                # Safely get the Control Mode as a string
                                control_mode = str(payload.get("Control Mode", ""))
                                
                                # Process ONLY if Control Mode is "2"
                                if control_mode == "2":
                                    updated = True
                                    
                                    # Extract "Enabled"
                                    if "Enabled" in payload:
                                        machine["motors"]["enabled"] = int(payload["Enabled"])
                                        
                                    # Extract "Motor 1 State"
                                    if "Motor 1 State" in payload and "motor_1" in machine["motors"]:
                                        machine["motors"]["motor_1"]["state"] = int(payload["Motor 1 State"])
                                        
                                    # Extract "Motor 2 State"
                                    if "Motor 2 State" in payload and "motor_2" in machine["motors"]:
                                        machine["motors"]["motor_2"]["state"] = int(payload["Motor 2 State"])
                                        
                                # If Control Mode is "0" or "1", we pass (do nothing)
                                elif control_mode in ["0", "1"]:
                                    pass

                            # 2. Update Inputs (Conveyors) - Kept existing logic intact
                            if "input" in payload:
                                inputs_status = payload["input"]
                                for k in inputs_status.keys():
                                    input_data = inputs_status[k]
                                    input_id = f"input_{k}"
                                    
                                    if input_id in machine["inputs"]:
                                        machine["inputs"][input_id]["rpm"] = input_data.get("rpm")
                                        updated = True

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
    # Using # at the end allows matching dynamic subtopics like /motor_status
    client.subscribe("+/+/+/+/#")

def on_message(client, userdata, msg):
    topic = msg.topic
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        print(f"\n📥 [MQTT IN] Topic: {topic}")
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