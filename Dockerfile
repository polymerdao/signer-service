FROM node:18-alpine

WORKDIR /app

RUN npm install -g ts-node

COPY package*.json ./

RUN adduser -D polymer
RUN chown -R polymer:polymer /app
USER polymer

RUN npm install

COPY  src src

EXPOSE 8000

CMD ["ts-node", "src/server.ts"]

