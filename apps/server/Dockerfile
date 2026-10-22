# Image de production : API + Socket.IO + front React, servis par le même serveur.
# À construire depuis la racine du monorepo :
#   docker build -f apps/server/Dockerfile -t quiz-live .

FROM node:22-alpine AS build
WORKDIR /app
# Prisma détecte la version d'OpenSSL pour choisir son moteur de migration.
RUN apk add --no-cache openssl

# 1. Dépendances (couche mise en cache tant que les package.json ne changent pas)
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts

# 2. Code source, client Prisma, bundle du serveur et build du front
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web
RUN npx --workspace @quiz/server prisma generate \
  && npm run build --workspace @quiz/server \
  && npm run build --workspace @quiz/web \
  && mkdir -p apps/server/node_modules

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV WEB_DIST_PATH=/app/apps/web/dist

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
# Dépendances propres au serveur que npm n'a pas pu remonter à la racine (souvent vide).
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/prisma.config.ts ./apps/server/prisma.config.ts
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

WORKDIR /app/apps/server
USER node
EXPOSE 3001

# Applique les migrations en attente puis démarre le serveur.
# --no-install : utilise la CLI Prisma de l'image, jamais une version téléchargée à la volée.
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node dist/index.js"]
