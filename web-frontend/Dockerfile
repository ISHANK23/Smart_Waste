# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
ENV CI=false
RUN npm install --legacy-peer-deps
COPY . .
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build
FROM nginx:1.25-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]