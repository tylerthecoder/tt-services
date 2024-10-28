FROM oven/bun:latest AS lib

WORKDIR /app/tt-services

COPY package.json ./

RUN bun install

COPY src ./src

COPY tsconfig.json ./

RUN bun run typecheck
