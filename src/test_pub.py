import paho.mqtt.client as mqtt
import time
import json
import random

# ==========================================
# CONFIGURATION
# ==========================================
BROKER_ADDRESS = "localhost"  # Change this if your broker is on a different IP
BROKER_PORT = 1883
PUBLISH_INTERVAL = 2          # Send data every 2 seconds

# The topic based on the MQTT Explorer hierarchy in your image
TOPIC = "Factory_1/Warehouse_1/Tank_Conveyor/Machine_1"

# ==========================================
# MQTT CALLBACKS (Updated for paho-mqtt v2.0+)
# ==========================================
def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f"✅ Successfully connected to MQTT Broker at {BROKER_ADDRESS}:{BROKER_PORT}")
    else:
        print(f"❌ Failed to connect, return code {reason_code}")

def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    print("⚠️ Disconnected from MQTT Broker")

# ==========================================
# MAIN EXECUTION
# ==========================================
def main():
    # Initialize MQTT Client with explicit API version 2
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2, 
        client_id="Python_Simulator_Client"
    )
    client.username_pw_set(username="amt", password="amt123456")

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect

    # Connect to the broker
    try:
        client.connect(BROKER_ADDRESS, BROKER_PORT, 60)
    except ConnectionRefusedError:
        print(f"❌ Connection Refused: Ensure Mosquitto is running on {BROKER_ADDRESS}:{BROKER_PORT}")
        return

    # Start the network loop in a background thread
    client.loop_start()
    
    print(f"📡 Starting to publish data to topic: {TOPIC}...\nPress Ctrl+C to stop.")

    try:
        while True:
            # Generate current timestamp (Unix epoch time as string)
            current_timestamp = str(int(time.time()))

            # Randomize motor states to see the dashboard UI update dynamically
            is_enabled = int(random.choice([0, 1]))
            motor_1_state = int(random.choice([0, 1]))
            motor_2_state = int(random.choice([0, 1]))

            # Construct the payload mimicking your exact JSON structure
            payload = {
                "system_info": {
                    "Timestamp": current_timestamp,
                    "Board ID": "1",
                    "Msg send count": int(random.randint(50000, 60000)),
                    "Msg send success count": int(random.randint(50000, 60000)),
                    "Wifi connected": "1"
                },
                "input": {
                    "2": {
                        "Timestamp": current_timestamp,
                        "Status": int(random.choice([0, 1])),
                        "ON Interval": int(random.randint(100, 600)),
                        "OFF Interval": int(random.randint(30, 90)),
                        "rpm": int(random.randint(30, 60))
                    }
                },
                "motor_status": {
                    "Timestamp": current_timestamp,
                    "Enabled": is_enabled,
                    "Control Mode": "2",
                    "Motor 1 State": motor_1_state,
                    "Motor 2 State": motor_2_state
                }
            }

            # Convert dictionary to JSON string
            json_payload = json.dumps(payload)

            # Publish the message
            client.publish(TOPIC, json_payload)
            print(f"[{time.strftime('%H:%M:%S')}] Published to {TOPIC}")
            print(f"Payload: {json_payload}\n")

            # Wait before sending the next message
            time.sleep(PUBLISH_INTERVAL)

    except KeyboardInterrupt:
        print("\n🛑 Stopped publishing.")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()