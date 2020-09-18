# Base image on node
FROM node:latest

# Create app directory and move into it
WORKDIR /usr/src/app

# Copy all files into container
COPY . .

# Install packages
RUN npm install

# Expose port
EXPOSE 80

# Run the app
CMD [ "node", "main.js" ]
