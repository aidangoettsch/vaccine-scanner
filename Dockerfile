FROM node:15-alpine
WORKDIR /app

RUN apk add python make gcc g++
RUN npm i -g pnpm
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm run build
CMD [ "pnpm", "start" ]
