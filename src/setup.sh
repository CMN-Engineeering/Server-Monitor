#!/usr/bin/env bash
set -e
echo "===== Preparing network ====="

# Remove temporary proxy environment variables
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ftp_proxy FTP_PROXY no_proxy NO_PROXY

# Remove apt proxy configuration if present
sudo rm -f /etc/apt/apt.conf
sudo rm -f /etc/apt/apt.conf.d/*proxy*
sudo rm -f /etc/apt/apt.conf.d/01proxy
sudo rm -f /etc/apt/apt.conf.d/99proxy

# Test Internet connectivity
if ! ping -c1 -W3 deb.debian.org >/dev/null 2>&1; then
    echo "DNS lookup failed. Trying Google DNS..."
    echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf >/dev/null
    echo "nameserver 1.1.1.1" | sudo tee -a /etc/resolv.conf >/dev/null
fi

# Retry apt update up to 5 times
for i in {1..5}; do
    echo "APT update attempt $i..."
    if sudo apt update; then
        break
    fi
    sleep 5
done
sudo apt upgrade -y

echo "Installing Mosquitto..."
sudo apt install -y ufw
sudo apt install -y mosquitto mosquitto-clients

echo "Configuring Mosquitto..."
sudo bash -c 'cat <<EOF > /etc/mosquitto/mosquitto.conf
per_listener_settings true

listener 1883
protocol mqtt
allow_anonymous true

listener 2250 0.0.0.0
protocol mqtt
allow_anonymous false
password_file /etc/mosquitto/pwfile

listener 9001 0.0.0.0
protocol websockets
allow_anonymous false
password_file /etc/mosquitto/pwfile
EOF'

# Create the password file and add a default user (username: admin, password: securepassword)
# IMPORTANT: Change "securepassword" to a real password before running this script!
sudo touch /etc/mosquitto/pwfile
sudo mosquitto_passwd -b /etc/mosquitto/pwfile admin admin
sudo chown mosquitto:mosquitto /etc/mosquitto/pwfile
echo "Starting and enabling Mosquitto..."
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto

echo "Configuring Firewall..."
sudo ufw allow 1883/tcp
sudo ufw allow 9001/tcp  # Added the WebSockets port to your firewall rules
sudo ufw reload

echo "Installing Docker..."
sudo apt install -y docker.io

# enable and start docker
sudo systemctl enable docker
sudo systemctl start docker

rm -rf Server-Monitor || true
echo "Cloning repo..."
sudo git clone https://github.com/CMN-Engineeering/Server-Monitor -b pi

# Suppress errors on stopping/removing containers in case they don't exist yet
sudo docker stop influxdb mynodered grafana pc_web || true
sudo docker rm influxdb mynodered grafana pc_web || true
echo "Installing node-red..."
echo "Checking Docker Hub..."

until curl -fsSL https://registry-1.docker.io/v2/ >/dev/null; do
    echo "Waiting for Internet..."
    sleep 5
done

echo "Internet OK."
sudo docker run -d --restart unless-stopped -p 1880:1880 -v node_red_data:/data --name mynodered nodered/node-red --add-host=host.docker.internal:host-gateway

echo "Installing InfluxDB using Docker..."
sudo docker run -d --restart unless-stopped -p 8086:8086 --name influxdb influxdb:2

echo "Installing grafana..."
sudo docker run -d --restart unless-stopped -p 3000:3000 --name=grafana grafana/grafana-enterprise
sudo docker network create influxdb-grafana || true
sudo docker network connect influxdb-grafana influxdb || true
sudo docker network connect influxdb-grafana grafana || true

cd Server-Monitor/src
echo "Running Web..."
sudo docker build -t pc-web .
sudo docker run -d --restart unless-stopped -p 1225:1225 --name pc_web -t pc_web