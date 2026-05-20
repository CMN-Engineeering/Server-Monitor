import paho.mqtt.client as mqtt
import time
import json
import random

# ==========================================
# CONFIGURATION
# ==========================================
BROKER_ADDRESS = "localhost"  # Change this if your broker is on a different IP
BROKER_PORT = 1883
PUBLISH_INTERVAL = 3          # Send data every 3 seconds

# The base topic for the machine
BASE_TOPIC = "Factory_22/Warehouse_1/Tank_Conveyor/Machine_2"

# ==========================================
# MQTT CALLBACKS
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
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2, 
        client_id="Python_Simulator_Testcases"
    )
    client.username_pw_set(username="amt", password="amt123456")

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect

    try:
        client.connect(BROKER_ADDRESS, BROKER_PORT, 60)
    except ConnectionRefusedError:
        print(f"❌ Connection Refused: Ensure Mosquitto is running on {BROKER_ADDRESS}:{BROKER_PORT}")
        return

    client.loop_start()
    print(f"📡 Starting to publish test cases to: {BASE_TOPIC}/...\nPress Ctrl+C to stop.\n")

    # Define our test cases based on your logic rules
    test_cases = [
        {
            "name": "TEST 1: Mode 2 (SHOULD PASS - Motors ON)",
            "Control Mode": "2",
            "Enabled": "1",
            "Motor 1 State": "0",
            "Motor 2 State": "1"
        },
        {
            "name": "TEST 2: Mode 0 (SHOULD BE IGNORED - Data won't update UI)",
            "Control Mode": "2",
            "Enabled": "1",
            "Motor 1 State": "1",
            "Motor 2 State": "0"
        },
        {
            "name": "TEST 3: Mode 2 (SHOULD PASS - Motors OFF)",
            "Control Mode": "2",
            "Enabled": "1",
            "Motor 1 State": "0",
            "Motor 2 State": "0"
        },
        {
            "name": "TEST 4: Mode 1 (SHOULD BE IGNORED - Data won't update UI)",
            "Control Mode": "2",
            "Enabled": "1",
            "Motor 1 State": "1",
            "Motor 2 State": "1"
        },
        {
            "name": "TEST 5: Mode 1 (SHOULD BE IGNORED - Data won't update UI)",
            "Control Mode": "2",
            "Enabled": "1",
            "Motor 1 State": "0",
            "Motor 2 State": "0"
        }
    ]

    test_index = 0

    try:
        while True:
            current_timestamp = str(int(time.time()))
            
            # --- 1. PUBLISH MOTOR STATUS TEST CASE ---
            current_test = test_cases[test_index]
            print(f"🔄 Executing {current_test['name']}")
            
            motor_payload = {
                "Timestamp": current_timestamp,
                "Enabled": current_test["Enabled"],
                "Control Mode": current_test["Control Mode"],
                "Motor 1 State": current_test["Motor 1 State"],
                "Motor 2 State": current_test["Motor 2 State"]
            }
            
            motor_topic = f"{BASE_TOPIC}//motor_status"
            client.publish(motor_topic, json.dumps(motor_payload))
            print(f"Topic: {motor_topic}")
            print(f"Payload: {json.dumps(motor_payload)}\n")


            # --- 2. PUBLISH OUTPUT (CONVEYOR RPM) TEST CASE ---
            # Keeping this so your inputs/conveyors still update on the UI!
            input_payload = {
                "input": {
                    "2": {
                        "rpm": random.randint(30, 60)
                    }
                }
            }
            client.publish(BASE_TOPIC, json.dumps(input_payload))

            # Move to next test case
            test_index = (test_index + 1) % len(test_cases)

            # Wait before sending next test
            time.sleep(PUBLISH_INTERVAL)

    except KeyboardInterrupt:
        print("\n🛑 Stopped publishing.")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()