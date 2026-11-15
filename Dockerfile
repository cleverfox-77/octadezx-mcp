FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.js server.js ./
COPY lib/ ./lib/

ENTRYPOINT ["node", "server.js"]
