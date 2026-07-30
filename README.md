# Factory Supervisory & Monitoring System

Welcome to the Factory Supervisory & Monitoring System repository. This project is a complete, production-ready full-stack application designed to monitor, manage, and control industrial factory equipment in real-time. It leverages a modern IoT stack featuring MQTT for real-time messaging, InfluxDB for time-series telemetry, PostgreSQL for system state persistence, and a Node.js/Express backend. 

---

## 🌟 Key Features

*   **Real-Time MQTT Integration:** Communicates with factory machines and updates the UI instantly using MQTT over WebSockets.
*   **Time-Series Telemetry:** Automatically parses incoming MQTT payloads and logs critical machine data (like `qraw` and `qfinal`) to InfluxDB for historical analysis.
*   **Robust State Management:** Stores the entire factory hierarchical structure (Factories > Storages > Machine Types > Machines) as a JSONB object in PostgreSQL.
*   **Automated Infrastructure Deployment:** Includes a comprehensive bash script that provisions a complete Dockerized environment, configuring Mosquitto, Node-RED, InfluxDB, Grafana, PostgreSQL, and the custom Node.js application.
*   **Role-Based Access Control (RBAC):** Built-in authentication separating Administrator and Operator roles.
*   **Dynamic Dashboarding:** An interactive frontend that allows users to drill down into specific factories, view machine statuses (Check In/Out, Motor states), and send output commands directly to hardware.
*   **Admin CRUD Operations:** Administrators can dynamically add, edit, or delete Factories, Storage units, Machine Types, and Individual Machines directly from the UI.

---

## 🏗️ Architecture & Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend** | Node.js (v22), Express | Serves static assets, provides REST APIs, and bridges MQTT telemetry with databases. |
| **Relational DB** | PostgreSQL | Runs in Docker (Port 1555 mapped to 5432), storing the `system_data` JSON state. |
| **Time-Series DB** | InfluxDB v2 | Dockerized (Port 8086), stores machine telemetry (`machine_telemetry` measurement). |
| **Message Broker** | Mosquitto | Handles MQTT traffic on TCP 1883 and WebSockets on 9001 with configured authentication. |
| **Data Visualization**| Grafana & Node-RED | Automatically provisioned alongside the stack for extended dashboarding and logic flows. |
| **Containerization**| Docker | The entire stack, including the backend web server, is containerized for seamless deployment. |

---

## 🚀 Getting Started

### 1. Prerequisites
You will need a Linux-based environment (Ubuntu/Debian recommended) to run the provided deployment script. The script will automatically handle network configurations, DNS fallbacks, and package installations.

### 2. Automated Deployment
The provided deployment bash script is the fastest way to get the production showcase running. It will update package managers, configure firewalls, install Docker, and spin up all necessary microservices.

Run the bash script with root privileges:
```bash
chmod +x setup.sh
sudo ./setup.sh
```

**What the script does:**
*   Clears temporary proxy environments and tests DNS connectivity.
*   Installs and configures Mosquitto MQTT broker (TCP 1883, WS 9001) with a default `admin` user.
*   Updates UFW firewall rules to allow ports 1883 and 9001.
*   Installs Docker and deploys containers for Node-RED, InfluxDB, Grafana, and PostgreSQL.
*   Clones the repository (branch `pi`), builds the `node:22` Docker image, and deploys the backend server on port `1225`.

### 3. Accessing the Services
Once the deployment script finishes, the services will be available at the following local addresses:

*   **Web Dashboard:** `http://localhost:1225` (or your server's Public IP)
*   **Grafana:** `http://localhost:3000`
*   **Node-RED:** `http://localhost:1880`
*   **InfluxDB:** `http://localhost:8086`

---

## 🔐 Authentication

The web interface features two default roles. Upon navigating to the web dashboard, use one of the following credentials:

| Role | Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin` | Full access. Can add, edit, and delete system architecture and control machines. |
| **Operator** | `operator` | `operator` | View-only dashboard access and standard operational toggles. |

*Note: The Mosquitto broker is also configured with the credentials `admin` / `admin` by default.*

---

## ⚙️ Environment Configuration

The backend Node.js application accepts several environment variables to override defaults. These are injected automatically by the Docker deployment script:

*   `PORT`: Server port (Default: `1225`)
*   `DB_HOST`: PostgreSQL hostname (Default: `postgresql`)
*   `DB_USER`: PostgreSQL user (Default: `admin`)
*   `DB_PASSWORD`: PostgreSQL password (Default: `admin`)
*   `DB_NAME`: PostgreSQL database name (Default: `factory_db`)
*   `DB_PORT`: PostgreSQL port (Default: `5432`)
*   `INFLUX_URL`: InfluxDB URL (Default: `http://172.17.0.1:8086`)
*   `INFLUX_TOKEN`: InfluxDB API token
*   `INFLUX_ORG`: InfluxDB Organization (Default: `CMN`)
*   `INFLUX_BUCKET`: InfluxDB Bucket (Default: `supervisory`)
