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
    
    // Launch browser with enhanced debugging
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    console.log('Browser launched successfully');
    page = await browser.newPage();
    console.log('Page created');
    
    // Test basic connectivity first
    console.log('Testing basic connectivity...');
    try {
      await page.goto('https://www.google.com', { 
        waitUntil: 'load', 
        timeout: 10000 
      });
      console.log('✅ Google connectivity test passed');
    } catch (testError) {
      console.log('❌ Google connectivity test failed:', testError.message);
      
      // Try another simple test
      try {
        await page.goto('https://httpbin.org/get', { 
          waitUntil: 'load', 
          timeout: 10000 
        });
        console.log('✅ httpbin.org connectivity test passed');
      } catch (fallbackError) {
        console.log('❌ httpbin.org connectivity test also failed:', fallbackError.message);
        throw new Error(`Network connectivity test failed: ${fallbackError.message}`);
      }
    }
    
    // Now try the PWC site
    console.log('Attempting to access PWC Aura site...');
    const pwcUrl = 'https://kr-platinum.aura.pwcglb.com/';
    
    try {
      await page.goto(pwcUrl, { 
        waitUntil: 'load', 
        timeout: 30000 
      });
      console.log('✅ PWC site loaded successfully');
    } catch (pwcError) {
      console.log('❌ PWC site failed:', pwcError.message);
      
      // Try alternative PWC URLs
      const alternativeUrls = [
        'https://aura.pwc.com/',
        'https://www.pwc.com/',
        'https://login.aura.pwc.com/'
      ];
      
      let pwcAccessible = false;
      for (const altUrl of alternativeUrls) {
        try {
          console.log(`Trying alternative URL: ${altUrl}`);
          await page.goto(altUrl, { 
            waitUntil: 'load', 
            timeout: 15000 
          });
          console.log(`✅ Alternative URL worked: ${altUrl}`);
          pwcAccessible = true;
          break;
        } catch (altError) {
          console.log(`❌ Alternative URL failed: ${altUrl} - ${altError.message}`);
        }
      }
      
      if (!pwcAccessible) {
        throw new Error(`All PWC URLs failed. Original error: ${pwcError.message}`);
      }
    }

    // Continue with email input logic...
    console.log('Looking for email input field...');
    
    // Multiple selectors to try
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]', 
      'input[name="username"]',
      'input[id="email"]',
      'input[id="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="이메일" i]',
      '.email-input',
      '.login-email'
    ];

    let emailInput = null;
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        emailInput = await page.$(selector);
        if (emailInput) {
          console.log(`Found email input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`Selector ${selector} not found`);
      }
    }

    if (!emailInput) {
      // Take screenshot for debugging
      const screenshot = await page.screenshot({ encoding: 'base64' });
      console.log('No email input found. Page screenshot taken.');
      
      return res.status(400).json({
        error: 'No email input field found',
        debug: {
          url: page.url(),
          title: await page.title(),
          screenshot: `data:image/png;base64,${screenshot.slice(0, 100)}...` // Truncated
        }
      });
    }

    // Fill email and continue...
    await emailInput.fill(email);
    console.log('Email entered successfully');

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Email entered successfully',
      debug: {
        url: page.url(),
        title: await page.title()
      }
    });

  } catch (error) {
    console.error('Failed to extract token:', error);
    
    return res.status(500).json({
      error: 'Failed to extract token',
      details: error.message,
      timestamp: new Date().toISOString(),
      debug: page ? {
        url: page.url(),
        userAgent: await page.evaluate(() => navigator.userAgent)
      } : null
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}