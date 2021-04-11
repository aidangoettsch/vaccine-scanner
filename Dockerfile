FROM node:15
WORKDIR /app

RUN npm i -g pnpm
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY . .
RUN pnpm install
RUN pnpm run build
CMD [ "pnpm", "start" ]
