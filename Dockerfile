# Production build of the manager app, served by nginx. /api is proxied to the backend `api`
# service, so the browser talks to one origin (no CORS, refresh cookie stays first-party).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_USE_MOCKS=false
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
