import json
import paho.mqtt.client as mqtt
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

# ==========================================
# CONFIGURATION
# ==========================================

# MQTT Configuration
MQTT_BROKER = "localhost" # Replace with your MQTT broker IP/Hostname
MQTT_PORT = 1883
MQTT_TOPIC = "supervisory"

# InfluxDB Configuration
INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "F-RvkMlik6gl3kQ_XHoXLIBWQyg4optm9wIuC3HK2iJDMFphhmt_3HxVCa2c3nulNutS4VQ4SKauH9oCz7cQrA=="
INFLUX_ORG = "cuong"
INFLUX_BUCKET = "test"

# Initialize InfluxDB Client
influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = influx_client.write_api(write_options=SYNCHRONOUS)

# ==========================================
# MQTT CALLBACKS
# ==========================================

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC)
        print(f"Subscribed to topic: {MQTT_TOPIC}")
    else:
        print(f"Failed to connect to MQTT Broker, return code: {rc}")

def on_message(client, userdata, msg):
    try:
        # Decode the payload string and parse the JSON
        payload_str = msg.payload.decode('utf-8')
        data = json.loads(payload_str)
        
        process_and_save_data(data)
        
    except json.JSONDecodeError as e:
        print(f"Failed to decode JSON payload: {e}")
    except Exception as e:
        print(f"Error processing message: {e}")

# ==========================================
# DATA PROCESSING
# ==========================================

def process_and_save_data(data):
    points = []
    
    # Traverse the nested JSON structure
    for factory in data.get("factories", []):
        factory_id = factory.get("id")
        
        for warehouse in factory.get("storageUnits", []):
            warehouse_id = warehouse.get("id")
            
            for machine in warehouse.get("machineUnits", []):
                # Create an InfluxDB Point for each machine
                point = Point("machine_telemetry") \
                    .tag("factory_id", factory_id) \
                    .tag("warehouse_id", warehouse_id) \
                    .tag("machine_id", machine.get("id")) \
                    .tag("machine_type", machine.get("type")) \
                    .tag("ip_address", machine.get("ip"))
                
                # Extract Output Metrics
                outputs = machine.get("outputs", {})
                for out_key, out_val in outputs.items():
                    point.field(f"{out_key}_rpm", int(out_val.get("rpm", 0)))
                    point.field(f"{out_key}_status", int(out_val.get("status", 0)))
                
                # Extract Motor Metrics
                motors = machine.get("motors", {})
                point.field("control_mode", int(motors.get("control_mode", 0)))
                point.field("motors_enabled", int(motors.get("enabled", 0)))
                
                # Iterate through individual motors (motor_1, motor_2, etc.)
                for motor_key, motor_val in motors.items():
                    if isinstance(motor_val, dict) and "state" in motor_val:
                        point.field(f"{motor_key}_state", int(motor_val.get("state", 0)))
                
                points.append(point)

    # Write the batched points to InfluxDB
    if points:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
        print(f"Successfully wrote {len(points)} machine records to InfluxDB.")

# ==========================================
# MAIN EXECUTION
# ==========================================

if __name__ == "__main__":
    # Setup MQTT Client
    mqtt_client = mqtt.Client()
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message

    try:
        # Connect to MQTT and start the loop
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_forever()
    except KeyboardInterrupt:
        print("Script terminated by user.")
    finally:
        mqtt_client.disconnect()
        write_api.close()
        influx_client.close()
        print("Connections closed.")