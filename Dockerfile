FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Add build-time environment variables (these will be baked into the build)
# You can override these with --build-arg
ARG NEXT_PUBLIC_FIREBASE__A_P_I_K_E_Y
ARG NEXT_PUBLIC_FIREBASE__A_U_T_H_D_O_M_A_I_N
ARG NEXT_PUBLIC_FIREBASE__P_R_O_J_E_C_T_I_D
ARG NEXT_PUBLIC_FIREBASE__S_T_O_R_A_G_E_B_U_C_K_E_T
ARG NEXT_PUBLIC_FIREBASE__M_E_S_S_A_G_I_N_G_S_E_N_D_E_R_I_D
ARG NEXT_PUBLIC_FIREBASE__A_P_P_I_D
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_BASE_URL

ENV NEXT_PUBLIC_FIREBASE__A_P_I_K_E_Y=$NEXT_PUBLIC_FIREBASE__A_P_I_K_E_Y
ENV NEXT_PUBLIC_FIREBASE__A_U_T_H_D_O_M_A_I_N=$NEXT_PUBLIC_FIREBASE__A_U_T_H_D_O_M_A_I_N
ENV NEXT_PUBLIC_FIREBASE__P_R_O_J_E_C_T_I_D=$NEXT_PUBLIC_FIREBASE__P_R_O_J_E_C_T_I_D
ENV NEXT_PUBLIC_FIREBASE__S_T_O_R_A_G_E_B_U_C_K_E_T=$NEXT_PUBLIC_FIREBASE__S_T_O_R_A_G_E_B_U_C_K_E_T
ENV NEXT_PUBLIC_FIREBASE__M_E_S_S_A_G_I_N_G_S_E_N_D_E_R_I_D=$NEXT_PUBLIC_FIREBASE__M_E_S_S_A_G_I_N_G_S_E_N_D_E_R_I_D
ENV NEXT_PUBLIC_FIREBASE__A_P_P_I_D=$NEXT_PUBLIC_FIREBASE__A_P_P_I_D
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL

# Build without Turbopack (use webpack for stability in Docker)
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]


