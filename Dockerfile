# 가장 가벼운 Alpine 기반 이미지
FROM node:18-alpine

# 필수 패키지만 설치
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 작업 디렉토리
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치 (캐시 최적화)
RUN npm ci --only=production

# 앱 코드 복사
COPY . .

# Puppeteer 환경 변수
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser

# 포트 노출
EXPOSE 3000

# 앱 실행
CMD ["node", "server.js"] 