FROM node:22
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=1224
EXPOSE 1224

CMD ["node", "server.js"]