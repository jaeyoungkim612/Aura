// api/get-pwc-token.js
import { chromium } from 'playwright';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, timeout = 60000 } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address required' });
  }

  let browser;
  let page;
  let tokenFound = false;
  let emailFound = false;
  let authData = null;
  let emailData = null;
  
  // Move capturedData outside try block to fix scope issue
  const capturedData = {
    requests: [],
    tokens: [],
    emails: [],
    networkTests: []
  };
  
  try {
    console.log('Starting Playwright token capture...');
    
    // Launch browser with user agent set at browser level
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors'
      ]
    });

    console.log('Browser launched successfully');
    
    // Create context with user agent
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    page = await context.newPage();
    
    // Set realistic browser headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    
    // Set up request interception
    console.log('Setting up request interception...');

    // Intercept all requests
    page.on('request', async (request) => {
      const headers = request.headers();
      const url = request.url();
      
      // Log request for debugging
      console.log(`Request: ${request.method()} ${url}`);
      
      // Special monitoring for PWC Aura "app" requests
      if (url.includes('aura.pwcglb.com') && (url.includes('/app') || url.endsWith('/app'))) {
        console.log('🎯 PWC Aura app request detected:', {
          url: url,
          method: request.method(),
          hasAuth: !!headers['authorization']
        });
      }
      
      // Look for email in referer
      if (headers['referer'] && !emailFound) {
        try {
          const parsedUrl = new URL(headers['referer']);
          const authRouterEmail = parsedUrl.searchParams.get('authRouterEmail');

          if (authRouterEmail) {
            emailFound = true;
            emailData = {
              email: authRouterEmail,
              found_at: new Date().toISOString(),
              referer: headers['referer']
            };
            console.log('✅ Email found in referer:', authRouterEmail);
            capturedData.emails.push(emailData);
          }
        } catch (err) {
          console.log('Error parsing referer URL:', err.message);
        }
      }

      // Look for authorization token (especially Bearer tokens from PWC Aura)
      if (headers['authorization'] && !tokenFound) {
        const authHeader = headers['authorization'];
        
        // Check if it's a Bearer token
        if (authHeader.startsWith('Bearer ')) {
          tokenFound = true;
          authData = {
            authorization: authHeader,
            token: authHeader.replace('Bearer ', ''), // Extract just the token part
            found_at: new Date().toISOString(),
            url: url,
            method: request.method(),
            type: 'Bearer'
          };
          console.log('✅ Bearer token found!', {
            url: url,
            tokenPreview: authHeader.substring(0, 50) + '...'
          });
          capturedData.tokens.push(authData);
        } else {
          // Log other authorization headers for debugging
          console.log('🔍 Non-Bearer auth header found:', {
            url: url,
            authType: authHeader.split(' ')[0],
            preview: authHeader.substring(0, 30) + '...'
          });
        }
      }

      // Store request info for debugging
      capturedData.requests.push({
        url: url,
        method: request.method(),
        hasAuth: !!headers['authorization'],
        hasReferer: !!headers['referer'],
        timestamp: new Date().toISOString()
      });

      // Check if we have both email and token
      if (emailFound && tokenFound) {
        console.log('🎉 Both email and token captured! Preparing response...');
        
        const combinedData = {
          success: true,
          token: authData.authorization,
          email: emailData.email,
          captured_at: new Date().toISOString(),
          details: {
            auth: authData,
            email: emailData
          }
        };

        // Send response and close browser
        setTimeout(async () => {
          try {
            if (browser) {
              await browser.close();
            }
          } catch (e) {
            console.log('Error closing browser:', e.message);
          }
        }, 1000);

        return;
      }
    });

    // Comprehensive network testing
    console.log('🔍 Starting comprehensive network diagnostics...');
    
    // Test basic connectivity first
    const basicTests = [
      'https://www.google.com',
      'https://httpbin.org/get',
      'https://example.com',
      'https://www.microsoft.com'
    ];
    
    for (const testUrl of basicTests) {
      try {
        console.log(`Testing basic connectivity: ${testUrl}`);
        const response = await page.goto(testUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        const status = response.status();
        console.log(`✅ ${testUrl} - Status: ${status}`);
        capturedData.networkTests.push({
          url: testUrl,
          success: true,
          status: status,
          type: 'basic_connectivity'
        });
        break; // If one works, we have basic internet
      } catch (err) {
        console.log(`❌ ${testUrl} - Error: ${err.message}`);
        capturedData.networkTests.push({
          url: testUrl,
          success: false,
          error: err.message,
          type: 'basic_connectivity'
        });
      }
    }

    // Test PWC Aura domains (prioritize the target domain)
    console.log('🔍 Testing PWC Aura accessibility...');
    
    const pwcDomains = [
      'https://kr-platinum.aura.pwcglb.com',
      'https://kr-platinum.aura.pwcglb.com/#/',
      'https://aura.pwc.com',
      'https://login.pwc.com'
    ];
    
    let successfulUrl = null;
    let finalPageUrl = null;
    let pageTitle = 'Unknown';
    
    for (const testUrl of pwcDomains) {
      try {
        console.log(`🔗 Attempting to connect to: ${testUrl}`);
        
        const response = await page.goto(testUrl, { 
          waitUntil: 'networkidle',
          timeout: 15000 
        });
        
        const status = response.status();
        console.log(`✅ Successfully connected to: ${testUrl} (Status: ${status})`);
        
        // Wait for potential redirects
        await page.waitForTimeout(3000);
        
        successfulUrl = testUrl;
        finalPageUrl = page.url();
        pageTitle = await page.title();
        
        console.log(`📄 Final URL: ${finalPageUrl}`);
        console.log(`📋 Page title: ${pageTitle}`);
        
        capturedData.networkTests.push({
          url: testUrl,
          success: true,
          status: status,
          finalUrl: finalPageUrl,
          pageTitle: pageTitle,
          type: 'pwc_domain'
        });
        
        break;
        
      } catch (navError) {
        console.log(`❌ Failed to connect to ${testUrl}: ${navError.message}`);
        capturedData.networkTests.push({
          url: testUrl,
          success: false,
          error: navError.message,
          type: 'pwc_domain'
        });
        continue;
      }
    }
    
    if (!successfulUrl) {
      // Return detailed network diagnostic information
      return res.status(503).json({
        error: 'All PWC URLs failed to load',
        message: 'Network connectivity issue detected',
        debug: {
          basicConnectivity: capturedData.networkTests.filter(t => t.type === 'basic_connectivity'),
          pwcDomainTests: capturedData.networkTests.filter(t => t.type === 'pwc_domain'),
          serverInfo: {
            userAgent: await page.evaluate(() => navigator.userAgent),
            platform: await page.evaluate(() => navigator.platform),
            language: await page.evaluate(() => navigator.language)
          },
          suggestions: [
            'PWC domains may be geo-blocked for this server location',
            'Corporate firewall may be blocking access',
            'Try using a VPN or different server region',
            'Consider running this locally instead of on Railway'
          ]
        },
        timestamp: new Date().toISOString()
      });
    }

    // Auto-login with email
    console.log(`✅ Successfully loaded PWC Aura! Starting auto-login with email: ${email}`);
    console.log(`📍 Current page URL: ${finalPageUrl}`);
    console.log(`📋 Page title: ${pageTitle}`);
    
    try {
      console.log('🔍 Looking for login form...');
      
      // Wait for page to be fully loaded
      await page.waitForTimeout(3000);
      
      // Look for common email input selectors
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[id="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="이메일" i]',
        'input[name="username"]',
        'input[id="username"]',
        'input[type="text"]'
      ];
      
      let emailInput = null;
      for (const selector of emailSelectors) {
        try {
          emailInput = await page.waitForSelector(selector, { timeout: 5000 });
          if (emailInput) {
            console.log(`✅ Found email input with selector: ${selector}`);
            break;
          }
        } catch (err) {
          console.log(`❌ No input found for selector: ${selector}`);
        }
      }
      
      if (emailInput) {
        // Clear and type email
        console.log('📝 Entering email address...');
        await emailInput.click();
        await emailInput.fill('');
        await emailInput.type(email);
        console.log(`✅ Email entered: ${email}`);
        
        // Look for login button
        const loginSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("로그인")',
          'button:has-text("Login")',
          'button:has-text("Sign in")',
          'button:has-text("Submit")',
          'button:has-text("다음")',
          'button:has-text("Next")',
          '[role="button"]:has-text("로그인")',
          '.login-button',
          '#login-button',
          '.btn-login'
        ];
        
        let loginButton = null;
        for (const selector of loginSelectors) {
          try {
            loginButton = await page.waitForSelector(selector, { timeout: 3000 });
            if (loginButton) {
              console.log(`✅ Found login button with selector: ${selector}`);
              break;
            }
          } catch (err) {
            console.log(`❌ No button found for selector: ${selector}`);
          }
        }
        
        if (loginButton) {
          console.log('🚀 Clicking login button...');
          await loginButton.click();
          console.log('✅ Login button clicked, waiting for redirect...');
          
          // Wait for potential navigation
          await page.waitForTimeout(3000);
          
          const newUrl = page.url();
          const newTitle = await page.title();
          console.log(`📍 After login - URL: ${newUrl}`);
          console.log(`📋 After login - Title: ${newTitle}`);
        } else {
          console.log('❌ Could not find login button, will still wait for token capture...');
        }
      } else {
        console.log('❌ Could not find email input field, will still wait for token capture...');
      }
      
    } catch (autoLoginErr) {
      console.log('❌ Auto-login failed:', autoLoginErr.message);
      console.log('⏳ Will continue waiting for manual login or token capture...');
    }
    
    console.log(`⏳ Waiting for token capture (timeout: ${timeout}ms)...`);
    
    // Set up a promise that resolves when both email and token are found
    const tokenCapturePromise = new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (emailFound && tokenFound) {
          clearInterval(checkInterval);
          resolve({
            success: true,
            token: authData.authorization,
            email: emailData.email,
            captured_at: new Date().toISOString(),
            details: {
              auth: authData,
              email: emailData
            }
          });
        }
      }, 1000);

      // Timeout handling
      setTimeout(() => {
        clearInterval(checkInterval);
        
        // Return partial results or debugging info
        const partialResult = {
          success: false,
          timeout: true,
          found: {
            email: emailFound,
            token: tokenFound
          },
          data: {
            email: emailData,
            auth: authData
          },
          debug: {
            successfulUrl: successfulUrl,
            finalUrl: finalPageUrl,
            pageTitle: pageTitle,
            totalRequests: capturedData.requests.length,
            emailsFound: capturedData.emails.length,
            tokensFound: capturedData.tokens.length,
            recentRequests: capturedData.requests.slice(-10),
            networkTests: capturedData.networkTests
          },
          message: emailFound && tokenFound 
            ? 'Both found but response already sent'
            : emailFound 
              ? 'Email found but waiting for token - user needs to complete login'
              : tokenFound 
                ? 'Token found but email missing'
                : 'PWC site loaded successfully! Please log in to capture the authentication token.'
        };
        
        resolve(partialResult);
      }, timeout);
    });

    // Wait for capture or timeout
    const result = await tokenCapturePromise;
    
    return res.status(result.success ? 200 : 202).json(result);

  } catch (error) {
    console.error('Token capture failed:', error);
    
    return res.status(500).json({
      error: 'Token capture failed',
      details: error.message,
      timestamp: new Date().toISOString(),
      debug: {
        emailFound,
        tokenFound,
        authData: authData ? { found: true, url: authData.url } : null,
        emailData: emailData ? { found: true, email: emailData.email } : null,
        networkTests: capturedData.networkTests
      }
    });
  } finally {
    if (browser && !tokenFound) {
      try {
        await browser.close();
      } catch (e) {
        console.log('Error closing browser:', e.message);
      }
    }
  }
}