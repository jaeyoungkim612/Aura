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
    
    // Now try the PWC site with navigation handling
    console.log('Attempting to access PWC Aura site...');
    const pwcUrl = 'https://kr-platinum.aura.pwcglb.com/';
    
    let finalUrl = pwcUrl;
    try {
      // Navigate and wait for all network activity to settle
      const response = await page.goto(pwcUrl, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });
      
      console.log('✅ PWC site loaded successfully');
      console.log('Response status:', response.status());
      
      // Wait for potential redirects to complete
      await page.waitForTimeout(3000);
      finalUrl = page.url();
      console.log('Final URL after redirects:', finalUrl);
      
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
          const altResponse = await page.goto(altUrl, { 
            waitUntil: 'networkidle', 
            timeout: 15000 
          });
          console.log(`✅ Alternative URL worked: ${altUrl} (status: ${altResponse.status()})`);
          finalUrl = page.url();
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

    // Wait for page to be stable before trying to interact
    console.log('Waiting for page to stabilize...');
    await page.waitForTimeout(2000);

    // Check if we're on a login page or need to navigate further
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    // Continue with email input logic with navigation safety...
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
      console.log('No email input found. Taking screenshot for debugging...');
      
      // Get page info safely
      let pageInfo;
      try {
        pageInfo = await page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.slice(0, 500)
        }));
      } catch (evalError) {
        console.log('Could not evaluate page info due to navigation:', evalError.message);
        pageInfo = {
          url: page.url(),
          title: await page.title(),
          bodyText: 'Could not retrieve body text due to navigation'
        };
      }
      
      const screenshot = await page.screenshot({ encoding: 'base64' });
      
      return res.status(400).json({
        error: 'No email input field found',
        debug: {
          ...pageInfo,
          screenshot: `data:image/png;base64,${screenshot.slice(0, 100)}...` // Truncated
        }
      });
    }

    // Fill email and continue with navigation safety...
    try {
      await emailInput.fill(email);
      console.log('Email entered successfully');
      
      // Wait a bit for any potential form validation
      await page.waitForTimeout(1000);
      
      // Try to get any tokens or useful info safely
      let pageData;
      try {
        pageData = await page.evaluate(() => {
          const data = {
            url: window.location.href,
            title: document.title,
            hasSessionStorage: typeof sessionStorage !== 'undefined',
            hasLocalStorage: typeof localStorage !== 'undefined'
          };
          
          // Try to get storage data safely
          try {
            data.sessionStorageKeys = sessionStorage ? Object.keys(sessionStorage) : [];
            data.localStorageKeys = localStorage ? Object.keys(localStorage) : [];
          } catch (e) {
            data.storageError = e.message;
          }
          
          return data;
        });
      } catch (evalError) {
        console.log('Could not evaluate page data due to navigation:', evalError.message);
        pageData = {
          url: page.url(),
          title: await page.title(),
          evaluationError: evalError.message
        };
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Email entered successfully',
        data: pageData,
        timestamp: new Date().toISOString()
      });

    } catch (fillError) {
      throw new Error(`Failed to fill email: ${fillError.message}`);
    }

  } catch (error) {
    console.error('Failed to extract token:', error);
    
    let debugInfo = null;
    if (page) {
      try {
        debugInfo = {
          url: page.url(),
          title: await page.title()
        };
        
        // Try to get user agent safely
        try {
          debugInfo.userAgent = await page.evaluate(() => navigator.userAgent);
        } catch (e) {
          debugInfo.userAgentError = e.message;
        }
      } catch (e) {
        debugInfo = { error: 'Could not get debug info due to navigation' };
      }
    }
    
    return res.status(500).json({
      error: 'Failed to extract token',
      details: error.message,
      timestamp: new Date().toISOString(),
      debug: debugInfo
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.log('Error closing browser:', e.message);
      }
    }
  }
}