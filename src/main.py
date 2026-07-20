import json
import time
import random
import paho.mqtt.client as mqtt

# ==========================
# MQTT Configuration
# ==========================
BROKER = "pi"   # Change to your broker IP/domain
PORT = 2250               # 8883 for TLS
USERNAME = "admin" # Set to None if not required
PASSWORD = "admin" # Set to None if not required
TOPIC = "Factory_22/Warehouse_1/May_Chan/Machine_2/session"

# ==========================
# Create MQTT Client
# ==========================
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

if USERNAME:
    client.username_pw_set(USERNAME, PASSWORD)

# Connect
client.connect(BROKER, PORT, keepalive=60)

client.loop_start()

try:
    while True:
        payload = {
			"PID":	"asd",
			"EID":	"0016045019\n",
			"MID":	"asd",
			"cf":	"1",
			"wait_time":	"100",
			"check_in":	"1783958706",
			"check_out":	"1783958710",
			"machine_start":	"1783958710",
			"machine_stop":	"1783958723",
			"qraw":	random.randint(1000, 9000),
			"qfinal": random.randint(1000, 9000)
		}

        result = client.publish(
            TOPIC,
            json.dumps(payload),
            qos=1,
            retain=False
        )

        result.wait_for_publish()

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"Published: {payload}")
        else:
            print(f"Failed to publish ({result.rc})")

        time.sleep(3)

except KeyboardInterrupt:
    print("Stopping publisher...")

client.loop_stop()
client.disconnect()