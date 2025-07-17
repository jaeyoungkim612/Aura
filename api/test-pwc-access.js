// api/test-pwc-access.js
// Railway에서 PWC 도메인 접속 가능성 테스트

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const testResults = [];
  
  // 테스트할 PWC 도메인들
  const pwcDomains = [
    'https://www.pwc.com',
    'https://www.pwc.com/kr',
    'https://www.pwc.com/kr/ko.html',
    'https://kr-platinum.aura.pwcglb.com',
    'https://aura.pwc.com',
    'https://login.pwc.com',
    'https://my.pwc.com',
    'https://identity.pwc.com',
    'https://pwc.com',
    'https://www.pwc.com/gx/en.html'
  ];

  console.log('🔍 Railway PWC 도메인 접속 테스트 시작...');

  // 기본 연결성 확인
  try {
    const googleTest = await fetch('https://www.google.com', { 
      method: 'HEAD',
      timeout: 5000 
    });
    testResults.push({
      domain: 'google.com',
      accessible: googleTest.ok,
      status: googleTest.status,
      type: 'baseline_test'
    });
  } catch (err) {
    testResults.push({
      domain: 'google.com',
      accessible: false,
      error: err.message,
      type: 'baseline_test'
    });
  }

  // PWC 도메인들 테스트
  for (const domain of pwcDomains) {
    try {
      console.log(`Testing: ${domain}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(domain, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      testResults.push({
        domain: domain,
        accessible: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': response.headers.get('content-type'),
          'server': response.headers.get('server'),
          'location': response.headers.get('location')
        },
        redirected: response.redirected,
        finalUrl: response.url,
        type: 'pwc_domain'
      });
      
      console.log(`✅ ${domain}: ${response.status} ${response.statusText}`);
      
    } catch (err) {
      testResults.push({
        domain: domain,
        accessible: false,
        error: err.message,
        errorType: err.name,
        type: 'pwc_domain'
      });
      
      console.log(`❌ ${domain}: ${err.message}`);
    }
    
    // 요청 간 간격 (너무 빠르게 요청하지 않도록)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // DNS 해상도 테스트 (추가)
  const dnsTests = [
    'kr-platinum.aura.pwcglb.com',
    'aura.pwc.com', 
    'login.pwc.com'
  ];

  for (const hostname of dnsTests) {
    try {
      // 간접적인 DNS 테스트 (fetch로 연결 시도)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch(`https://${hostname}`, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      testResults.push({
        domain: hostname,
        dnsResolvable: true,
        type: 'dns_test'
      });
      
    } catch (err) {
      testResults.push({
        domain: hostname,
        dnsResolvable: false,
        dnsError: err.message,
        type: 'dns_test'
      });
    }
  }

  // 결과 분석
  const accessibleDomains = testResults.filter(r => r.accessible && r.type === 'pwc_domain');
  const inaccessibleDomains = testResults.filter(r => !r.accessible && r.type === 'pwc_domain');
  
  const summary = {
    timestamp: new Date().toISOString(),
    railwayServer: 'accessible',
    totalTested: pwcDomains.length,
    accessible: accessibleDomains.length,
    inaccessible: inaccessibleDomains.length,
    accessibleDomains: accessibleDomains.map(d => d.domain),
    recommendations: []
  };

  // 추천사항
  if (accessibleDomains.length === 0) {
    summary.recommendations.push('❌ 모든 PWC 도메인 접속 불가 - 회사 방화벽/지역 제한 가능성');
    summary.recommendations.push('💡 다른 클라우드 서비스 (Vercel, AWS Lambda) 시도 권장');
    summary.recommendations.push('🔧 프록시 서버나 VPN 서비스 고려');
  } else if (accessibleDomains.length < pwcDomains.length / 2) {
    summary.recommendations.push('⚠️ 일부 PWC 도메인만 접속 가능');
    summary.recommendations.push(`✅ 사용 가능: ${accessibleDomains.map(d => d.domain).join(', ')}`);
  } else {
    summary.recommendations.push('✅ 대부분의 PWC 도메인 접속 가능');
    summary.recommendations.push('🚀 Railway에서 PWC 토큰 추출 서비스 구현 가능');
  }

  console.log('🎯 테스트 완료');
  
  return res.status(200).json({
    success: true,
    summary,
    detailedResults: testResults,
    serverInfo: {
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || 'unknown',
      region: process.env.RAILWAY_REGION || 'unknown'
    }
  });
} 