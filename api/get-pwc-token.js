// api/get-pwc-token.js
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  let browser;
  
  try {
    // 로컬 환경과 Vercel 환경 구분
    const isLocal = !process.env.VERCEL;
    
    if (isLocal) {
      // 로컬 환경: 시스템에 설치된 Chrome 사용
      browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-dev-shm-usage'
        ]
      });
    } else {
      // Vercel 환경: Sparticuz Chromium 사용
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    }

    const page = await browser.newPage();
    
    // PWC 사이트 접속
    await page.goto('https://kr-platinum.aura.pwcglb.com', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // 로그인 과정 (사이트 구조에 따라 수정 필요)
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', username);
    await page.type('#password', password);
    
    // 로그인 버튼 클릭
    await page.click('#loginButton');
    
    // 로그인 완료 대기
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    // 세션 스토리지에서 토큰 추출
    const tokenData = await page.evaluate(() => {
      return {
        appToken: sessionStorage.getItem('appToken'),
        analytcId: sessionStorage.getItem('analytcId'),
        currentUser: sessionStorage.getItem('currentUser'),
        email: sessionStorage.getItem('email'),
        fullname: sessionStorage.getItem('fullname')
      };
    });

    await browser.close();

    if (!tokenData.appToken) {
      return res.status(401).json({ error: 'Failed to retrieve token' });
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

// package.json에 필요한 dependencies
/*
{
  "dependencies": {
    "puppeteer-core": "^21.0.0",
    "@sparticuz/chromium": "^119.0.0"
  }
}
*/