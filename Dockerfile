# Base image on node
FROM node:latest

# Create app directory and move into it
WORKDIR /usr/src/app

# Copy all files into container
COPY . .

# Proxy configuration
RUN npm config set proxy http://172.16.98.151:8118
RUN npm config set https-proxy http://172.16.98.151:8118

# Install packages
RUN npm install

# Expose port
EXPOSE 8435

# Run the app
CMD [ "node", "main.js" ]
