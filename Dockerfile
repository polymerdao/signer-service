# Use the official Node.js 14 image as a base
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY main.ts .
COPY KMSProviderGCP.ts .

RUN npm install -g ts-node

CMD ["ts-node", "main.ts"]

