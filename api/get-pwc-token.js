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
  let page;
  
  try {
    console.log('Starting Puppeteer with system Chromium...');
    
    // Launch browser with Docker-optimized settings
    browser = await puppeteer.launch({
      headless: 'new',
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
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-crash-upload',
        '--disable-breakpad'
      ],
      timeout: 60000,
      protocolTimeout: 60000
    });

    console.log('Browser launched successfully');
    page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    console.log('Navigating to PWC Aura site...');
    
    // Navigate to PWC site with extended timeout
    await page.goto('https://kr-platinum.aura.pwcglb.com', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    console.log('Page loaded successfully');
    
    // Wait for page to stabilize
    await page.waitForTimeout(3000);

    // Try to find and fill email field
    try {
      console.log('Looking for email input field...');
      
      // Multiple possible selectors for email input
      const emailSelectors = [
        'input[type="email"]', 
        '#email', 
        '#username', 
        '[name="email"]', 
        '[placeholder*="email" i]',
        '[placeholder*="이메일" i]',
        'input[type="text"]'
      ];
      
      let emailInput = null;
      
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          emailInput = await page.$(selector);
          if (emailInput) {
            console.log(`Found email input with selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
          continue;
        }
      }
      
      if (emailInput) {
        await emailInput.click();
        await emailInput.type(email, { delay: 100 });
        console.log('Email entered successfully');
        
        // Look for submit button
        const buttonSelectors = [
          '#getTokenButton', 
          '[type="submit"]', 
          'button[type="submit"]', 
          '.login-btn', 
          '.submit-btn',
          'button:contains("로그인")',
          'button:contains("Login")',
          'button:contains("확인")'
        ];
        
        let submitButton = null;
        
        for (const selector of buttonSelectors) {
          try {
            submitButton = await page.$(selector);
            if (submitButton) {
              console.log(`Found submit button with selector: ${selector}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (submitButton) {
          await submitButton.click();
          console.log('Submit button clicked');
          
          // Wait for potential navigation or response
          try {
            await Promise.race([
              page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
              page.waitForTimeout(5000)
            ]);
          } catch (e) {
            console.log('No navigation occurred, continuing...');
          }
          
          // Additional wait for any dynamic content
          await page.waitForTimeout(3000);
        }
      } else {
        console.log('No email input field found');
      }
      
    } catch (error) {
      console.log('Form interaction error:', error.message);
    }

    console.log('Extracting tokens from storage...');
    
    // Extract tokens from storage
    const tokenData = await page.evaluate(() => {
      const storage = {};
      const localStorage_data = {};
      
      // Session storage
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          storage[key] = sessionStorage.getItem(key);
        }
      } catch (e) {
        console.log('Session storage error:', e);
      }
      
      // Local storage
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          localStorage_data[key] = localStorage.getItem(key);
        }
      } catch (e) {
        console.log('Local storage error:', e);
      }
      
      return {
        sessionStorage: storage,
        localStorage: localStorage_data,
        // Common token keys
        appToken: sessionStorage.getItem('appToken'),
        analytcId: sessionStorage.getItem('analytcId'),
        currentUser: sessionStorage.getItem('currentUser'),
        email: sessionStorage.getItem('email'),
        fullname: sessionStorage.getItem('fullname'),
        token: sessionStorage.getItem('token'),
        authToken: sessionStorage.getItem('authToken'),
        accessToken: sessionStorage.getItem('accessToken'),
        pwcToken: sessionStorage.getItem('pwcToken'),
        userToken: sessionStorage.getItem('userToken'),
        loginToken: sessionStorage.getItem('loginToken')
      };
    });

    console.log('Token extraction completed');

    // Check if any tokens were found
    const hasToken = tokenData.appToken || tokenData.token || tokenData.authToken || 
                    tokenData.accessToken || tokenData.pwcToken || tokenData.userToken ||
                    tokenData.loginToken || Object.keys(tokenData.sessionStorage).length > 0;

    if (!hasToken) {
      console.log('No tokens found in storage');
      return res.status(401).json({ 
        error: 'No token found',
        debug: 'Token extraction completed but no tokens were found in storage',
        storageData: tokenData
      });
    }

    console.log('Tokens found successfully');
    res.status(200).json({
      success: true,
      data: tokenData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error during token extraction:', error);
    res.status(500).json({ 
      error: 'Failed to extract token',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Cleanup
    try {
      if (page) await page.close();
      if (browser) await browser.close();
      console.log('Browser cleanup completed');
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
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