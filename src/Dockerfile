FROM node:22
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=1225
EXPOSE 1225

CMD ["node", "server.js"]