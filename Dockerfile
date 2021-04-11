FROM node:15
WORKDIR /app

RUN npm i -g pnpm
COPY package.json ./
COPY pnpm-lock.json ./
COPY . .
RUN pnpm run build
CMD [ "pnpm", "start" ]
