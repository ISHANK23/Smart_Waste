# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --production --ignore-scripts

COPY src ./src

EXPOSE 4000
CMD ["node", "src/index.js"]