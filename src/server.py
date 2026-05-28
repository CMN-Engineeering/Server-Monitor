import json
import os
import string
from flask import Flask, request, jsonify
import paho.mqtt.client as mqtt
import paho.mqtt.publish as publish

app = Flask(__name__, static_folder='.', static_url_path='')

DATA_FILE = 'sys-data.json'
with open(DATA_FILE, 'r', encoding='utf-8') as f:
    sys_data = json.load(f)
MESSAGE_COUNT = 0
print(f"Initial Message Count: {MESSAGE_COUNT}")

# ==========================================
# DATA PARSING AND BROADCASTING LOGIC
# ==========================================
def update_data_from_mqtt(topic, payload):
    parts = topic.split('/')
    if len(parts) < 4:
        return
    
    f_id = parts[0]   # Factory_id
    s_id = parts[1]   # Warehouse_id
    m_id = parts[3]   # Machine_id

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
                                control_mode = str(payload.get("Control Mode", ""))
                                
                                if control_mode == "2":
                                    updated = True
                                    if "Enabled" in payload:
                                        machine["motors"]["enabled"] = int(payload["Enabled"])
                                    if "Motor 1 State" in payload and "motor_1" in machine["motors"]:
                                        machine["motors"]["motor_1"]["state"] = int(payload["Motor 1 State"])
                                    if "Motor 2 State" in payload and "motor_2" in machine["motors"]:
                                        machine["motors"]["motor_2"]["state"] = int(payload["Motor 2 State"])
                                elif control_mode in ["0", "1"]:
                                    pass

                            # 2. Update Outputs (Conveyors) 
                            if "output" in payload:
                                outputs_status = payload["output"]
                                for k in outputs_status.keys():
                                    output_data = outputs_status[k]
                                    output_id = f"output_{k}"
                                    
                                    if output_id in machine["outputs"]:
                                        if "rpm" in output_data:
                                            machine["outputs"][output_id]["rpm"] = output_data.get("rpm")
                                        if "status" in output_data:
                                            machine["outputs"][output_id]["status"] = output_data.get("status")
                                        updated = True

    if updated:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(sys_data, f, indent=4)
        print(f"✅ Data updated and broadcasted for {m_id}")

# ==========================================
# MQTT SETUP
# ==========================================
def on_connect(client, userdata, flags, reason_code, properties):
    print("✅ Connected to MQTT Broker")
    client.subscribe("+/+/+/+/#")

def on_message(client, userdata, msg):
    topic = msg.topic
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        print(f"\n📥 [MQTT IN] Topic: {topic}")
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
    return jsonify({"success": True, "message": "Saved successfully"})

@app.route('/toggleOutputState')
def toggle_output_state():
    factory_id = request.args.get('factory_id')
    storage_id = request.args.get('storage_id')
    machine_id = request.args.get('machine_id')
    machine_type = request.args.get('machine_type')
    output_id = int(request.args.get('output_id').split("_")[-1]) - 1
    output_state = request.args.get('output_state', type=int)
    
    publish_topic = f"{factory_id}/{storage_id}/{machine_type}/{machine_id}/output/command"
    global MESSAGE_COUNT
    
    payload_dict = {
        "id": MESSAGE_COUNT,
        "cmd": output_state,
        "param": [output_id]
    }
    MESSAGE_COUNT = MESSAGE_COUNT + 1 if MESSAGE_COUNT < 1000000000 else 0
    payload = json.dumps(payload_dict)
    
    mqtt_client.publish(publish_topic, payload, qos=1)
    return "OK"

@app.route('/toggleMotorState')
def toggle_motor_state():
    factory_id = request.args.get('factory_id')
    storage_id = request.args.get('storage_id')
    machine_id = request.args.get('machine_id')
    machine_type = request.args.get('machine_type')
    motor_id = int(request.args.get('motor_id').split("_")[-1])
    motor_state = request.args.get('motor_state', type=int)
    
    publish_topic = f"{factory_id}/{storage_id}/{machine_type}/{machine_id}/motor/command"
    global MESSAGE_COUNT
    
    payload_dict = {
        "id": MESSAGE_COUNT,
        "cmd": motor_state,
        "param": [motor_id, 0]
    }
    MESSAGE_COUNT = MESSAGE_COUNT + 1 if MESSAGE_COUNT < 1000000000 else 0
    payload = json.dumps(payload_dict)
    
    mqtt_client.publish(publish_topic, payload, qos=1)
    return "OK"

@app.route('/toggleMotorEnable')
def toggle_motor_enable():
    factory_id = request.args.get('factory_id')
    storage_id = request.args.get('storage_id')
    machine_id = request.args.get('machine_id')
    machine_type = request.args.get('machine_type')
    enable_state = request.args.get('enable_state', type=int)
    
    publish_topic = f"{factory_id}/{storage_id}/{machine_type}/{machine_id}/motor/command"
    global MESSAGE_COUNT
    
    # 2 generally acts as the enable/disable mode configuration trigger. Adjust if your MCU expects a different structure.
    payload_dict = {
        "id": MESSAGE_COUNT,
        "cmd": 2, 
        "param": [enable_state]
    }
    MESSAGE_COUNT = MESSAGE_COUNT + 1 if MESSAGE_COUNT < 1000000000 else 0
    payload = json.dumps(payload_dict)
    
    mqtt_client.publish(publish_topic, payload, qos=1)
    return "OK"

# ==========================================
# SERVER STARTUP
# ==========================================
if __name__ == '__main__':
    print("🚀 Starting Server on port 3000...")
    app.run(host="0.0.0.0", port=3000)