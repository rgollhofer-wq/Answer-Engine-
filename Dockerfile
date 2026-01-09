FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY src/data/schema.prisma ./src/data/schema.prisma
RUN npm install
RUN npx prisma generate --schema=src/data/schema.prisma
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/package.json /app/package-lock.json* ./
RUN npm install --omit=dev
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
