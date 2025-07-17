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
  
  try {
    console.log('Starting Playwright token capture...');
    
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    console.log('Browser launched successfully');
    page = await browser.newPage();
    
    // Set up request interception
    console.log('Setting up request interception...');
    
    // Track captured data
    const capturedData = {
      requests: [],
      tokens: [],
      emails: []
    };

    // Intercept all requests
    page.on('request', async (request) => {
      const headers = request.headers();
      const url = request.url();
      
      // Log request for debugging
      console.log(`Request: ${request.method()} ${url}`);
      
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

      // Look for authorization token
      if (headers['authorization'] && !tokenFound) {
        tokenFound = true;
        authData = {
          authorization: headers['authorization'],
          found_at: new Date().toISOString(),
          url: url,
          method: request.method()
        };
        console.log('✅ Authorization token found!');
        capturedData.tokens.push(authData);
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

    // Also capture responses for additional data
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      
      if (status >= 200 && status < 300) {
        console.log(`Response: ${status} ${url}`);
        
        // Look for API responses that might contain tokens
        if (url.includes('auth') || url.includes('token') || url.includes('login')) {
          try {
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('application/json')) {
              const responseData = await response.json();
              console.log('Auth-related API response detected:', url);
              
              // Look for token-like data in response
              const responseStr = JSON.stringify(responseData);
              if (responseStr.includes('token') || responseStr.includes('auth')) {
                capturedData.requests.push({
                  type: 'api_response',
                  url: url,
                  status: status,
                  hasTokenData: true,
                  timestamp: new Date().toISOString()
                });
              }
            }
          } catch (e) {
            // Non-JSON response or error parsing
          }
        }
      }
    });

    // Try multiple PWC URLs
    console.log('Navigating to PWC Aura site...');
    
    const urlsToTry = [
      'https://kr-platinum.aura.pwcglb.com/#/',
      'https://kr-platinum.aura.pwcglb.com',
      'https://aura.pwc.com',
      'https://login.pwc.com',
      'https://www.pwc.com'
    ];
    
    let successfulUrl = null;
    
    for (const testUrl of urlsToTry) {
      try {
        console.log(`Trying URL: ${testUrl}`);
        
        const response = await page.goto(testUrl, { 
          waitUntil: 'networkidle',
          timeout: 20000 
        });
        
        console.log(`✅ Successfully loaded: ${testUrl} (status: ${response.status()})`);
        successfulUrl = testUrl;
        
        // Wait for potential redirects
        await page.waitForTimeout(3000);
        
        const finalUrl = page.url();
        console.log(`Final URL: ${finalUrl}`);
        
        break;
        
      } catch (navError) {
        console.log(`❌ Failed to load ${testUrl}: ${navError.message}`);
        continue;
      }
    }
    
    if (!successfulUrl) {
      throw new Error('All PWC URLs failed to load');
    }

    // Wait for user interaction or timeout
    console.log(`Waiting for token capture (timeout: ${timeout}ms)...`);
    console.log('Current page URL:', page.url());
    console.log('Page title:', await page.title());
    
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
            finalUrl: page.url(),
            pageTitle: 'Will be fetched',
            totalRequests: capturedData.requests.length,
            emailsFound: capturedData.emails.length,
            tokensFound: capturedData.tokens.length,
            recentRequests: capturedData.requests.slice(-10) // Last 10 requests
          },
          message: emailFound && tokenFound 
            ? 'Both found but response already sent'
            : emailFound 
              ? 'Email found but waiting for token - user needs to complete login'
              : tokenFound 
                ? 'Token found but email missing'
                : 'Please navigate to login page and enter your email to capture the token'
        };
        
        // Try to get page title safely
        page.title().then(title => {
          partialResult.debug.pageTitle = title;
        }).catch(() => {
          partialResult.debug.pageTitle = 'Could not retrieve title';
        }).finally(() => {
          resolve(partialResult);
        });
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
        emailData: emailData ? { found: true, email: emailData.email } : null
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