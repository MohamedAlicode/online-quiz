# Image de production du serveur (API + Socket.IO).
# À construire depuis la racine du monorepo :
#   docker build -f apps/server/Dockerfile -t quiz-live-server .

FROM node:22-alpine AS build
WORKDIR /app

# 1. Dépendances (couche mise en cache tant que les package.json ne changent pas)
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @quiz/server --workspace @quiz/shared --include-workspace-root --ignore-scripts

# 2. Code source, client Prisma et bundle
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npx --workspace @quiz/server prisma generate \
  && npm run build --workspace @quiz/server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/prisma.config.ts ./apps/server/prisma.config.ts
COPY --from=build /app/apps/server/dist ./apps/server/dist

WORKDIR /app/apps/server
USER node
EXPOSE 3001

# Applique les migrations en attente puis démarre le serveur.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
