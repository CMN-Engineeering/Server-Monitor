# Server Monitor Setup Guide

## 1. Install Python Packages

Run:

```bash
pip install flask flask-socketio paho-mqtt
```
or
```bash
pip install -r requirements.txt
```
---

## 2. Start MQTT Broker

Example using Mosquitto:

```bash
mosquitto
```

Or with config:

```bash
mosquitto -c mosquitto.conf
```

---

## 3. Run Server

Start the Flask server:

```bash
python server.py
```

Server runs at:

```text
https://localhost:3000
```

---

## 4. Open Web Dashboard

Open browser:

```text
https://localhost:3000
```

---

## 5. Login Accounts

### Admin

```text
Username: admin
Password: admin
```

### Operator

```text
Username: operator
Password: operator
```

---

## 6. Important

In `index.html`, make sure Socket.IO loads BEFORE `script.js`:

```html
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
<script src="script.js?v=2"></script>
```

---

## 7. MQTT Example Topic

```text
Factory_1/Warehouse_1/Tank_Conveyor/Machine_1
```

---

## 8. MQTT Example Payload

```json
{
  "motor_status": {
    "Enabled": 1,
    "Motor 1 State": 1,
    "Motor 2 State": 0
  }
}
```

Dashboard updates automatically in realtime.