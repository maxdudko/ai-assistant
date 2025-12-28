FROM node:20-bullseye

WORKDIR /app

# Enable Corepack and PNPM
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# We copy only the necessary files for caching dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy all applications and packages
COPY apps ./apps
COPY packages ./packages

# Installing dependencies
RUN pnpm install

# We expose the port
EXPOSE 3000

# Launching a server application
CMD ["pnpm", "--filter", "web", "dev"]
