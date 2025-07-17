// server.js - 로컬 테스트용 간단한 서버
const http = require('http');
const url = require('url');

// API 함수 import (ES module을 CommonJS로 변환)
async function loadApiHandler() {
  const { default: handler } = await import('./api/get-pwc-token.js');
  return handler;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // CORS 헤더 추가
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (parsedUrl.pathname === '/api/get-pwc-token' && req.method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          req.body = JSON.parse(body);
          
          // Mock response object
          const mockRes = {
            status: (code) => ({
              json: (data) => {
                res.writeHead(code, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
              }
            })
          };
          
          const handler = await loadApiHandler();
          await handler(req, mockRes);
          
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
        }
      });
      
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server error', details: error.message }));
    }
  } else {
    // 간단한 테스트 페이지
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>PWC Token Extractor</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .form-group { margin: 15px 0; }
          label { display: block; margin-bottom: 5px; font-weight: bold; }
          input { width: 300px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
          button { background: #0070f3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #0051cc; }
          #result { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>🚀 PWC Token Extractor 테스트</h1>
        <p>API 엔드포인트: <code>POST /api/get-pwc-token</code></p>
        <p>서버가 정상적으로 실행 중입니다!</p>
        
        <h2>🧪 실시간 테스트</h2>
        <form id="testForm">
          <div class="form-group">
            <label for="email">이메일 주소:</label>
            <input type="email" id="email" name="email" required>
          </div>
          <button type="submit">🔑 토큰 추출 테스트</button>
        </form>
        
        <div id="result" style="display: none;"></div>
        
        <h2>📋 curl 명령어 테스트:</h2>
        <pre>curl -X POST http://localhost:3000/api/get-pwc-token \\
  -H "Content-Type: application/json" \\
  -d '{"email":"your-email@company.com"}'</pre>

        <script>
          document.getElementById('testForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const resultDiv = document.getElementById('result');
            
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '🔄 토큰 추출 중... (최대 30초 소요)';
            
            try {
              const response = await fetch('/api/get-pwc-token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
              });
              
              const data = await response.json();
              
              if (response.ok) {
                resultDiv.innerHTML = \`
                  <h3>✅ 성공!</h3>
                  <pre>\${JSON.stringify(data, null, 2)}</pre>
                \`;
              } else {
                resultDiv.innerHTML = \`
                  <h3>❌ 오류</h3>
                  <pre>\${JSON.stringify(data, null, 2)}</pre>
                \`;
              }
            } catch (error) {
              resultDiv.innerHTML = \`
                <h3>❌ 네트워크 오류</h3>
                <pre>\${error.message}</pre>
              \`;
            }
          });
        </script>
      </body>
      </html>
    `);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/get-pwc-token`);
}); 