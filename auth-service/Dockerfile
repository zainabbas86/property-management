FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
# src/ is bind-mounted at runtime — tsx watch picks up changes without rebuilding
CMD ["npx", "tsx", "watch", "src/index.ts"]
