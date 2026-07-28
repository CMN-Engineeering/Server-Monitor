FROM node:22
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install pg
COPY . .
ENV PORT=1225
EXPOSE 1225

CMD ["node", "server.js"]