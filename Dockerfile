# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package.json ./

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpng-dev \
    python3 \
    python3-pip \
    libx11-xcb1 \
    libxrandr2 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libatk1.0-0 \
    libasound2 \
    libdbus-1-3

# Install any needed packages specified in package.json
RUN npm install

# Install dependencies for the server and UI
WORKDIR /app/src/server
RUN npm install
RUN npx playwright install --with-deps

WORKDIR /app/src/ui
RUN npm install

# Copy the rest of the application code
COPY . .

# Make port 80 available to the world outside this container
EXPOSE 3000

# Define environment variable
ENV NODE_ENV=development

# Entry point to run the application
ENTRYPOINT ["npm", "run", "start:dev"]