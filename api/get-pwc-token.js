// api/get-pwc-token.js
import { chromium } from 'playwright';

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
    console.log('Starting Playwright Chromium...');
    
    // Launch browser with Playwright
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    console.log('Browser launched');
    page = await browser.newPage();
    console.log('Page created');
    
    // Simple test
    await page.goto('https://httpbin.org/get', { timeout: 30000 });
    console.log('Test navigation successful');
    
    // Now try the actual site
    await page.goto('https://kr-platinum.aura.pwcglb.com', { timeout: 30000 });
    console.log('PWC site loaded');
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // Extract storage data
    const tokenData = await page.evaluate(() => {
      const storage = {};
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          storage[key] = sessionStorage.getItem(key);
        }
      } catch (e) {}
      
      return {
        sessionStorage: storage,
        url: window.location.href,
        title: document.title
      };
    });

    res.status(200).json({
      success: true,
      data: tokenData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to extract token',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    try {
      if (page) await page.close();
      if (browser) await browser.close();
    } catch (e) {}
  }
}