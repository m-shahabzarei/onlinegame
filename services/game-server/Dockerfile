# Build with repository root as context; this service never starts Next.js.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY src/game/shared ./src/game/shared
COPY services/game-server ./services/game-server
RUN npm run game:build

FROM node:22-bookworm-slim
ENV NODE_ENV=production GAMEPLAY_HOST=0.0.0.0 GAMEPLAY_PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist/game-server ./dist/game-server
USER node
EXPOSE 8080
CMD ["node", "dist/game-server/services/game-server/main.js"]
