FROM mcr.microsoft.com/playwright:bionic
WORKDIR /app

ENV TZ="America/New_York"

RUN npm i -g pnpm
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm run build
CMD [ "pnpm", "start" ]
