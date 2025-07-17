// server.js - Railway 배포용 Express 서버
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS 설정
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// API 라우트 - PWC 토큰 추출
app.post('/api/get-pwc-token', async (req, res) => {
  try {
    // API 함수 동적 import
    const { default: handler } = await import('./api/get-pwc-token.js');
    
    // Express req/res를 Vercel 스타일로 변환
    const mockVercelRes = {
      status: (code) => ({
        json: (data) => {
          res.status(code).json(data);
        }
      })
    };
    
    await handler(req, mockVercelRes);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// 헬스체크 엔드포인트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'PWC Token Extractor'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 Railway Server running at http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/get-pwc-token`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
}); 