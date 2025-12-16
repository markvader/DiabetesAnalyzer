// Enhanced Nightscout proxy with full API v1 and v3 support
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api-secret, accept, user-agent, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'content-type, content-length'
}

interface ProxyRequest {
  url: string;
  path: string;
  token?: string;
  apiVersion?: 'v1' | 'v3' | 'auto';
  authMethod?: 'bearer' | 'api-secret' | 'url-param' | 'auto';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests for the proxy
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed', message: 'Only POST requests are supported' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse the request body
    let requestData: ProxyRequest;
    try {
      requestData = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON', 
          message: 'Request body must be valid JSON' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { url, path, token, apiVersion = 'auto', authMethod = 'auto' } = requestData;

    // Validate required fields
    if (!url) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing URL', 
          message: 'Nightscout URL is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate and construct the target URL
    // IMPORTANT: preserve base pathname so instances hosted under a subpath work.
    // Example base: https://example.com/nightscout
    // Example path: /api/v3/entries?...  -> https://example.com/nightscout/api/v3/entries?...
    let targetUrl: string;
    try {
      const baseUrl = new URL(url);
      const fullPath = path || '';

      const basePath = baseUrl.pathname === '/' ? '' : baseUrl.pathname.replace(/\/+$/, '');
      const normalizedPath = fullPath.startsWith('/') ? fullPath : `/${fullPath}`;

      targetUrl = `${baseUrl.origin}${basePath}${normalizedPath}`;
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid URL', 
          message: `Invalid Nightscout URL: ${error.message}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Proxying request to: ${targetUrl}`);

    // Detect API version from path if not specified
    let detectedApiVersion = apiVersion;
    if (apiVersion === 'auto') {
      if (path && path.includes('/api/v3/')) {
        detectedApiVersion = 'v3';
      } else if (path && path.includes('/api/v1/')) {
        detectedApiVersion = 'v1';
      } else {
        // Default to v1 for backward compatibility
        detectedApiVersion = 'v1';
      }
    }

    console.log(`Detected API version: ${detectedApiVersion}`);

    // Prepare headers for the Nightscout request
    const nightscoutHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'DiabetesAnalyzer/2.0 (Nightscout-Proxy)',
      'Cache-Control': 'no-cache',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    };

    // Special handling for known problematic instances
    const hostname = new URL(url).hostname.toLowerCase();
    console.log(`Processing request for hostname: ${hostname}`);
    
    if (hostname.includes('10be.de')) {
      console.log('Detected 10be.de instance - applying specific headers');
      nightscoutHeaders['User-Agent'] = 'Mozilla/5.0 (compatible; DiabetesAnalyzer/2.0)';
      nightscoutHeaders['Accept'] = 'application/json, text/plain, */*';
    }

    // Handle authentication based on API version and auth method
    if (token && token.trim()) {
      const trimmedToken = token.trim();
      
      if (detectedApiVersion === 'v3') {
        // API v3 uses Bearer token authentication
        nightscoutHeaders['Authorization'] = `Bearer ${trimmedToken}`;
        console.log('Using Bearer Token authentication for API v3');
      } else {
        // API v1 uses API-SECRET header with Access Token
        nightscoutHeaders['API-SECRET'] = trimmedToken;
        console.log('Using Access Token authentication for API v1 (API-SECRET header)');
      }
      
      // Log the headers being sent (without exposing the full token)
      console.log('Headers being sent:', {
        ...nightscoutHeaders,
        'Authorization': nightscoutHeaders['Authorization'] ? 'Bearer [REDACTED]' : undefined,
        'API-SECRET': nightscoutHeaders['API-SECRET'] ? '[REDACTED]' : undefined
      });
    } else {
      console.log('No authentication token provided');
    }

    // Make the request to Nightscout with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout for large datasets

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: 'GET',
        headers: nightscoutHeaders,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        return new Response(
          JSON.stringify({ 
            error: 'Request timeout', 
            message: 'The request to your Nightscout server timed out after 45 seconds. This may indicate a slow server or large dataset.' 
          }),
          { 
            status: 504, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.error('Fetch error details:', {
        name: error.name,
        message: error.message,
        cause: error.cause,
        stack: error.stack,
        targetUrl: targetUrl,
        hostname: new URL(url).hostname
      });
      
      // Enhanced error message for network connectivity issues
      let errorMessage = `Unable to connect to Nightscout server: ${error.message || 'Unknown network error'}`;
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = `Failed to connect to your Nightscout server (${new URL(url).hostname}). This could be due to:
• Your Nightscout URL is incorrect or unreachable from the internet
• DNS resolution issues with your Nightscout domain
• Your Nightscout server is offline or not responding
• Network connectivity issues between Supabase and your server
• Firewall or security settings blocking the connection
• SSL/TLS certificate issues with your Nightscout server
• CORS configuration issues on your Nightscout server

Please verify:
1. Your Nightscout URL is correct and accessible from a web browser
2. Your Nightscout server is online and responding
3. The URL uses HTTPS (required for secure connections)
4. Your Nightscout instance allows external API access

Original error: ${error.message}`;
      } else if (error instanceof TypeError && !error.message) {
        errorMessage = `Failed to connect to your Nightscout server (${new URL(url).hostname}). This could be due to:
• Your Nightscout URL is incorrect or unreachable from the internet
• DNS resolution issues with your Nightscout domain
• Your Nightscout server is offline or not responding
• Network connectivity issues between Supabase and your server
• Firewall or security settings blocking the connection
• SSL/TLS certificate issues with your Nightscout server
• CORS configuration issues on your Nightscout server

Please verify:
1. Your Nightscout URL is correct and accessible from a web browser
2. Your Nightscout server is online and responding
3. The URL uses HTTPS (required for secure connections)
4. Your Nightscout instance allows external API access

Network error occurred with no specific error message.`;
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Connection failed', 
          message: errorMessage,
          debugInfo: {
            errorType: error.name,
            originalMessage: error.message,
            hostname: new URL(url).hostname,
            targetUrl: targetUrl
          }
        }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    clearTimeout(timeoutId);

    console.log(`Response from ${new URL(url).hostname}: ${response.status} ${response.statusText}`);

    // Handle authentication errors specifically
    if (response.status === 401) {
      // Log the exact response for debugging
      let responseBody = '';
      try {
        responseBody = await response.text();
        console.log(`401 Response body: ${responseBody}`);
      } catch {
        console.log('Could not read 401 response body');
      }

      const authMethodUsed = detectedApiVersion === 'v3' ? 'Bearer Token' : 'Access Token (API-SECRET)';
      
      const authAdvice = detectedApiVersion === 'v3' 
        ? 'For API v3, ensure your Bearer token has the required permissions: api:entries:read, api:treatments:read, api:profile:read, api:devicestatus:read'
        : 'For API v1, ensure your Access Token is correct and has read permissions';
      
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          message: `Authentication failed using ${authMethodUsed}. ${authAdvice}. Please check your API token and ensure it has the correct permissions for ${detectedApiVersion.toUpperCase()}. Server response: ${responseBody}`,
          apiVersion: detectedApiVersion,
          authMethod: authMethodUsed,
          serverResponse: responseBody
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Handle other non-200 responses from Nightscout
    if (!response.ok) {
      // Handle 421 Misdirected Request specifically (common with ns.10be.de)
      if (response.status === 421) {
        // Check if this is the specific ns.10be.de redirect issue
        let responseBody = '';
        try {
          responseBody = await response.text();
        } catch {
          responseBody = 'Could not read response body';
        }
        
        if (responseBody.includes('forgot-port.html') || responseBody.includes('10be.de')) {
          return new Response(
            JSON.stringify({
              error: 'Incorrect URL - This is a redirect service',
              message: `You're trying to connect to ns.10be.de, but this appears to be a redirect service, not your actual Nightscout instance.

🔍 The server redirected to: ${responseBody}

✅ To fix this:
1. Visit ns.10be.de in your web browser
2. Follow the redirect to find your actual Nightscout URL
3. Use that actual URL in Diabetes Analyzer settings

Example: If it redirects to something like "yourname.herokuapp.com" or "yourname.10be.de:1337", use that URL instead.

This is not an authentication issue - you need the correct Nightscout server URL.`,
              status: response.status,
              statusText: response.statusText,
              hostname: new URL(url).hostname,
              redirectInfo: responseBody,
              suggestions: [
                "Visit ns.10be.de in your web browser to find the correct URL",
                "Look for a URL like 'yourname.herokuapp.com' or 'yourname.10be.de:XXXX'",
                "Use the actual Nightscout server URL, not the redirect service"
              ]
            }),
            {
              status: 421,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        // Generic 421 handling for other cases
        return new Response(
          JSON.stringify({
            error: 'Server Configuration Issue',
            message: `Your Nightscout server (${new URL(url).hostname}) returned a "421 Misdirected Request" error. This typically means:

• The server doesn't recognize the hostname you're using
• There may be a virtual host configuration issue
• The server expects a different URL format

For ${new URL(url).hostname}, please try:
1. Check if there's a different URL format (maybe without 'ns.' prefix)
2. Verify the correct hostname with your Nightscout provider
3. Ensure your Nightscout instance is properly configured

This is a server-side configuration issue, not an authentication problem.`,
            status: response.status,
            statusText: response.statusText,
            hostname: new URL(url).hostname,
            suggestions: [
              "Try accessing your Nightscout in a web browser to verify the correct URL",
              "Contact your Nightscout hosting provider about the hostname configuration", 
              "Check if the URL format should be different (e.g., different subdomain)"
            ]
          }),
          {
            status: 421,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Handle 503 Service Unavailable specifically
      if (response.status === 503) {
        return new Response(
          JSON.stringify({
            error: 'Service Unavailable',
            message: `Your Nightscout server (${new URL(url).hostname}) is temporarily unavailable. This could be due to server maintenance, high load, or technical issues. Please try again later.`,
            status: response.status,
            statusText: response.statusText
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorText = await response.text();
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      } catch {
        // Ignore errors when reading error response
      }

      // Provide specific guidance for common errors
      if (response.status === 403) {
        errorMessage += `. Your API token may not have sufficient permissions for ${detectedApiVersion.toUpperCase()}.`;
      } else if (response.status === 404) {
        errorMessage += `. The requested endpoint may not exist on your Nightscout server or ${detectedApiVersion.toUpperCase()} may not be supported.`;
      }

      return new Response(
        JSON.stringify({ 
          error: 'Nightscout error', 
          message: errorMessage,
          status: response.status,
          apiVersion: detectedApiVersion
        }),
        { 
          status: response.status >= 500 ? 502 : response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the response data
    let responseData: any;
    try {
      const responseText = await response.text();
      
      // Try to parse as JSON
      try {
        responseData = JSON.parse(responseText);
      } catch {
        // If not JSON, return as text (shouldn't happen with Nightscout API)
        responseData = responseText;
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Response parsing failed', 
          message: `Failed to read response from Nightscout: ${error.message}` 
        }),
        { 
          status: 502, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Log successful response details
    console.log(`Successfully proxied ${detectedApiVersion.toUpperCase()} request. Response type: ${typeof responseData}, Array: ${Array.isArray(responseData)}`);
    
    // Handle API v3 response format - API v3 wraps data in { status, result } object
    // API v1 returns arrays directly, API v3 returns { status: 200, result: [...] }
    let normalizedData = responseData;
    
    if (detectedApiVersion === 'v3' && responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
      // API v3 response format: { status: 200, result: [...] }
      if (responseData.result !== undefined) {
        console.log(`API v3 response detected with result wrapper. Extracting result array.`);
        normalizedData = responseData.result;
        
        // Handle case where result might be a single object (like profile/current)
        if (normalizedData && typeof normalizedData === 'object' && !Array.isArray(normalizedData)) {
          // For single object responses like profile, wrap in array for consistency
          // But only if it's not already an array
          console.log(`API v3 result is single object, keeping as-is for profile-like endpoints`);
        }
      } else if (responseData.status && responseData.message) {
        // Error response from API v3
        console.log(`API v3 error response: ${responseData.message}`);
        return new Response(
          JSON.stringify({ 
            error: 'API v3 error', 
            message: responseData.message || 'Unknown API v3 error',
            status: responseData.status
          }),
          { 
            status: responseData.status || 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }
    
    if (Array.isArray(normalizedData)) {
      console.log(`Returned ${normalizedData.length} items`);
    } else if (normalizedData && typeof normalizedData === 'object') {
      console.log(`Returned object with keys: ${Object.keys(normalizedData).join(', ')}`);
    }

    // Return successful response with API version info
    return new Response(
      JSON.stringify({ 
        data: normalizedData,
        apiVersion: detectedApiVersion,
        success: true,
        timestamp: new Date().toISOString(),
        itemCount: Array.isArray(normalizedData) ? normalizedData.length : null
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: `Proxy server error: ${error.message}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})