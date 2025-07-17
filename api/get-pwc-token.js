// api/get-pwc-token.js
import puppeteer from 'puppeteer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address required' });
  }

  let browser;
  
  try {
    // Puppeteer with system Chromium for Docker
    browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ]
    });

    const page = await browser.newPage();
    
    // User Agent 설정
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    // PWC 사이트 접속
    await page.goto('https://kr-platinum.aura.pwcglb.com', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // 페이지 로딩 대기
    await page.waitForTimeout(2000);

    // 이메일로 토큰 요청 과정 (실제 사이트 구조에 맞게 수정 필요)
    try {
      // 이메일 입력 필드 대기 및 입력
      await page.waitForSelector('input[type="email"], #email, #username, [name="email"]', { timeout: 10000 });
      
      // 여러 가능한 셀렉터 시도
      const emailSelectors = ['input[type="email"]', '#email', '#username', '[name="email"]', '[placeholder*="email"]'];
      let emailInput = null;
      
      for (const selector of emailSelectors) {
        try {
          emailInput = await page.$(selector);
          if (emailInput) break;
        } catch (e) {
          continue;
        }
      }
      
      if (emailInput) {
        await emailInput.type(email);
      } else {
        throw new Error('Email input field not found');
      }
      
      // 토큰 요청 버튼 클릭 (여러 가능한 셀렉터)
      const buttonSelectors = ['#getTokenButton', '[type="submit"]', 'button[type="submit"]', '.login-btn', '.submit-btn'];
      let submitButton = null;
      
      for (const selector of buttonSelectors) {
        try {
          submitButton = await page.$(selector);
          if (submitButton) break;
        } catch (e) {
          continue;
        }
      }
      
      if (submitButton) {
        await submitButton.click();
        
        // 페이지 이동 또는 응답 대기
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
        } catch (e) {
          // 네비게이션이 없을 수도 있으므로 계속 진행
          await page.waitForTimeout(3000);
        }
      }
      
    } catch (error) {
      console.log('Form interaction error:', error.message);
    }

    // 세션 스토리지에서 토큰 추출
    const tokenData = await page.evaluate(() => {
      const storage = {};
      
      // 세션 스토리지 전체 확인
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        storage[key] = sessionStorage.getItem(key);
      }
      
      // 로컬 스토리지도 확인
      const localStorage_data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        localStorage_data[key] = localStorage.getItem(key);
      }
      
      return {
        sessionStorage: storage,
        localStorage: localStorage_data,
        // 기존 방식도 시도
        appToken: sessionStorage.getItem('appToken'),
        analytcId: sessionStorage.getItem('analytcId'),
        currentUser: sessionStorage.getItem('currentUser'),
        email: sessionStorage.getItem('email'),
        fullname: sessionStorage.getItem('fullname'),
        // 추가 가능한 토큰 키들
        token: sessionStorage.getItem('token'),
        authToken: sessionStorage.getItem('authToken'),
        accessToken: sessionStorage.getItem('accessToken'),
        pwcToken: sessionStorage.getItem('pwcToken')
      };
    });

    await browser.close();

    // 토큰이 있는지 확인
    const hasToken = tokenData.appToken || tokenData.token || tokenData.authToken || 
                    tokenData.accessToken || tokenData.pwcToken || 
                    Object.keys(tokenData.sessionStorage).length > 0;

    if (!hasToken) {
      return res.status(401).json({ 
        error: 'No token found',
        debug: 'Token extraction completed but no tokens were found in storage',
        storageData: tokenData
      });
    }

    res.status(200).json({
      success: true,
      data: tokenData
    });

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to extract token',
      details: error.message 
    });
  }
}

// Railway 배포용 패키지 설정
/*
{
  "dependencies": {
    "puppeteer": "^21.11.0",
    "express": "^4.18.2"
  }
}
*/