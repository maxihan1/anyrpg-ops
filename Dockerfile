# 게임 운영툴 웹 이미지 — tsx 로 서버를 바로 돌린다(빌드 단계 없음)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["npx", "tsx", "src/server.ts"]
