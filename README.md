# PWC Token Extractor

PWC Aura 플랫폼에서 인증 토큰을 추출하는 서버리스 서비스입니다.

## 프로젝트 구조

```
my-pwc-token-extractor/
├── api/
│   └── get-pwc-token.js          # 서버리스 함수
├── package.json                  # 의존성 관리
├── vercel.json                   # Vercel 설정
└── README.md                     # 프로젝트 문서
```

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 로컬 개발 서버 실행
```bash
npm run dev
```

### 3. Vercel 배포
```bash
vercel --prod
```

## API 사용법

### POST /api/get-pwc-token

PWC 사이트에 로그인하여 인증 토큰을 추출합니다.

#### 요청 예시
```javascript
const response = await fetch('/api/get-pwc-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'your-username',
    password: 'your-password'
  })
});

const result = await response.json();
```

#### 응답 예시
```json
{
  "success": true,
  "data": {
    "appToken": "your-app-token",
    "analytcId": "your-analytic-id",
    "currentUser": "your-user-info",
    "email": "your-email",
    "fullname": "your-full-name"
  }
}
```

## 환경 요구사항

- Node.js 18.0.0 이상
- Vercel CLI (개발/배포용)

## 기술 스택

- **Runtime**: Node.js
- **Automation**: Puppeteer + Chromium
- **Deployment**: Vercel Serverless Functions
- **Region**: ICN1 (Seoul)

## 주의사항

- 이 서비스는 PWC Aura 플랫폼의 인증 토큰 추출을 위한 용도로만 사용해야 합니다.
- 적절한 권한과 승인 하에 사용하시기 바랍니다.
- 민감한 정보(사용자명, 비밀번호)는 안전하게 관리하세요. 