FROM mcr.microsoft.com/playwright:bionic
WORKDIR /app

RUN npm i -g pnpm
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm run build
CMD [ "pnpm", "start" ]
