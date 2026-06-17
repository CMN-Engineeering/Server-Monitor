# Server Monitor Setup Guide

## 1. Build Docker

Run:

```bash
docker build -t pc_web .
# Relace pc_web with any name you want
```
---

## 2. Run Docker
Run:

```bash
docker run -d --restart unless-stopped -p 3000:3000 --name node_service -t pc_web 
```
-d (Detached mode): This is what makes Docker run "silently." It starts the container in the background and leaves your terminal free.

-p 3000:3000: Maps port 3000 from the container (which you exposed in your Dockerfile) to port 3000 on your host machine.

--restart unless-stopped: This ensures the container behaves like a persistent service. If your app crashes, or if you reboot your entire server, Docker will automatically start this container back up. It will only stay off if you manually type docker stop node_service.

--name node_service: Gives the container a recognizable name so you can easily manage it later.

## 3. Stop Docker
```bash
docker stop node_service
```
To start it again
```bash
docker start node_service
```
