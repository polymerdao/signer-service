FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN addgroup -g 333 polymer && adduser -D -u 333 -G polymer polymer
RUN chown -R polymer:polymer /app
USER polymer

RUN npm install

COPY tsconfig.json ./
COPY src src

# Build TypeScript files
RUN npm run build

EXPOSE 8000

# Run compiled JavaScript instead of TypeScript
CMD ["node", "dist/server.js"]
