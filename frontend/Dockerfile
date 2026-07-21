FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image — static files only (served by FastAPI backend)
FROM scratch AS export
COPY --from=build /app/dist /dist
