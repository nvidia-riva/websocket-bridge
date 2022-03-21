FROM node:16
RUN npm install -g npm@8.5.5
WORKDIR /opt/riva/websocket-bridge
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8009
CMD [ "node", "server.js" ]
