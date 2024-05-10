FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY src src

RUN npm install -g ts-node

EXPOSE 8000

CMD ["ts-node", "src/server.ts"]

