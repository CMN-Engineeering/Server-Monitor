#!/usr/bin/env bash
set -e  # stop if any command fails
sudo rm -rf Server-Monitor

echo "Updating system..."
sudo apt update -y
sudo apt upgrade -y

echo "Installing Mosquitto..."
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
sudo systemctl status mosquitto
sudo ufw allow 1883/tcp
sudo ufw reload

echo "Installing Docker..."
sudo apt install -y docker.io

# enable and start docker
sudo systemctl enable docker
sudo systemctl start docker

echo "Cloning repo..."
sudo git clone https://github.com/CMN-Engineeering/Server-Monitor -b WebSocket

sudo docker stop influxdb mynodered grafana pc_web
sudo docker rm influxdb mynodered grafana pc_web

echo "Installing node-red..."
sudo docker run -d --restart unless-stopped -p 1880:1880 -v node_red_data:/data --name mynodered nodered/node-red

echo "Installing InfluxDB using Docker..."
sudo docker run -d --restart unless-stopped -p 1224:1224 --name influxdb influxdb:2

echo "Installing grafana..."
sudo docker run -d --restart unless-stopped -p 3000:3000 --name=grafana grafana/grafana-enterprise
sudo docker network create influxdb-grafana
sudo docker network connect influxdb-grafana influxdb
sudo docker network connect influxdb-grafana grafana

cd Server-Monitor/src
echo "Running Web..."
sudo docker build -t pc-web .
sudo docker run -d --restart unless-stopped -p 1224:1224 --name pc_web -t pc_web 
