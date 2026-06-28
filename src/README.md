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
docker run -d --restart unless-stopped -p 1224:1224 --name pc_web -t pc_web 
```
-d (Detached mode): This is what makes Docker run "silently." It starts the container in the background and leaves your terminal free.

-p 1224:1224: Maps port 1224 from the container (which you exposed in your Dockerfile) to port 1224 on your host machine.

--restart unless-stopped: This ensures the container behaves like a persistent service. If your app crashes, or if you reboot your entire server, Docker will automatically start this container back up. It will only stay off if you manually type docker stop pc_web.

--name pc_web: Gives the container a recognizable name so you can easily manage it later.

## 3. Run node-red
```bash
docker run -it -p 1880:1880 -v node_red_data:/data --name mynodered nodered/node-red
```

