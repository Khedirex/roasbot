# --- base ---
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# --- deps ---
FROM base AS deps
# ⚠️ Para o build funcionar com Tailwind/PostCSS,
# precisamos instalar também devDependencies neste stage.
ENV NODE_ENV=development
RUN apk add --no-cache libc6-compat
COPY package*.json ./
# Instala deps de runtime + dev (para build do Next)
RUN npm ci

# --- builder ---
FROM base AS builder
RUN apk add --no-cache python3 make g++ libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Gera Prisma client se existir prisma/schema.prisma
RUN npx prisma generate || true
# Build de produção
RUN npm run build

# --- runtime ---
FROM base AS runtime
RUN apk add --no-cache libc6-compat
ENV PORT=3000
EXPOSE 3000
WORKDIR /app
# (mantido) copiando node_modules do stage deps
# OBS: isso leva também devDependencies para o runtime (imagem maior),
# mas preserva exatamente o seu fluxo.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package*.json ./
CMD ["npm", "start"]
