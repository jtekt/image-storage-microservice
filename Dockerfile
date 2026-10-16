FROM node:24 as build-stage
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

COPY . .

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
ENV NODE_ENV=production

RUN npm run swagger-autogen
RUN npm run build
EXPOSE 80
CMD [ "npm", "run", "start"]
