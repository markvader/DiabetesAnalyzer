// deno-lint-ignore-file no-explicit-any
import { subDays } from 'date-fns';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 2000; // Initial delay in milliseconds
const MAX_RETRY_DELAY = 32000; // Maximum delay in milliseconds

// Detect if running in WebContainer environment
const isWebContainer = (): boolean => {
  return typeof window !== 'undefined' && 
         (window.location.hostname.includes('webcontainer') || 
          window.location.hostname.includes('local-credentialless') ||
          window.location.hostname.includes('stackblitz') ||
          process.env.NODE_ENV === 'development');
};

// Validate and format URL
const formatUrl = (url: string): string => {
  if (!url?.trim()) {
    throw new Error('Please configure your Nightscout URL in Settings');
  }

  let formattedUrl = url.trim();
  
  console.log(`🔧 formatUrl input: "${formattedUrl}"`);
  
  try {
    // Handle URLs with or without protocol
    if (!formattedUrl.match(/^https?:\/\//)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Remove any query parameters or hash fragments before validation
    formattedUrl = formattedUrl.split(/[?#]/)[0];

    console.log(`🔧 formatUrl after protocol/cleanup: "${formattedUrl}"`);

    const urlObj = new URL(formattedUrl);
    
    // Basic sanity checks
    if (!urlObj.hostname) {
      throw new Error('Invalid hostname in URL');
    }
    
    // Remove trailing slashes and normalize path
    const finalUrl = urlObj.origin + (urlObj.pathname === '/' ? '' : urlObj.pathname.replace(/\/+$/, ''));
    
    console.log(`🔧 formatUrl final output: "${finalUrl}"`);
    
    return finalUrl;
  } catch (error) {
    console.error('🔧 URL validation error:', error);
    throw new Error(`Invalid Nightscout URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Validate Supabase configuration and construct proxy URL
const getProxyUrl = (): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  console.log('Environment check:', {
    supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined',
    supabaseAnonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined',
    allEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')),
    isWebContainer: isWebContainer()
  });

  if (!supabaseUrl || !supabaseUrl.trim()) {
    throw new Error('Missing Supabase URL configuration. Please check your VITE_SUPABASE_URL environment variable. Make sure your .env file is in the project root and contains VITE_SUPABASE_URL.');
  }

  if (!supabaseAnonKey || !supabaseAnonKey.trim()) {
    throw new Error('Missing Supabase anonymous key configuration. Please check your VITE_SUPABASE_ANON_KEY environment variable. Make sure your .env file is in the project root and contains VITE_SUPABASE_ANON_KEY.');
  }

  try {
    // Validate that the Supabase URL is properly formatted
    const url = new URL('/functions/v1/nightscout-proxy', supabaseUrl.trim());
    console.log('Proxy URL constructed:', url.toString());
    return url.toString();
  } catch (error) {
    console.error('Supabase URL validation error:', error);
    throw new Error(`Invalid Supabase URL configuration: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your VITE_SUPABASE_URL environment variable.`);
  }
};

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException(String(signal.reason || 'Aborted'), 'AbortError'));
    return;
  }

  const timeoutId = setTimeout(() => {
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
    resolve();
  }, ms);

  const onAbort = () => {
    clearTimeout(timeoutId);
    reject(new DOMException(String(signal?.reason || 'Aborted'), 'AbortError'));
  };

  if (signal) {
    signal.addEventListener('abort', onAbort, { once: true });
  }
});

// Enhanced error message extraction
const getErrorMessage = (error: unknown): string => {
  if (!error) return 'Unknown error occurred';
  
  if (error instanceof Error) {
    return error.message || 'Error occurred but no message provided';
  }
  
  if (typeof error === 'string') {
    return error || 'Empty error string';
  }
  
  if (typeof error === 'object') {
    const errorObj = error as any;
    return errorObj.message || errorObj.error || errorObj.toString() || 'Unknown error object';
  }
  
  return String(error) || 'Failed to convert error to string';
};

// Create WebContainer-specific error message
const createWebContainerError = (): Error => {
  const error = new Error(
    '🚫 Network Connection Blocked\n\n' +
    'This application is running in a sandboxed development environment (WebContainer) that blocks outbound network requests to external services like Supabase Edge Functions.\n\n' +
    '✅ To use this Nightscout analysis tool:\n\n' +
    '1. Deploy this application to a hosting service like:\n' +
    '   • Netlify (recommended)\n' +
    '   • Vercel\n' +
    '   • GitHub Pages\n' +
    '   • Your own server\n\n' +
    '2. Or run it locally on your machine:\n' +
    '   • Clone/download the project\n' +
    '   • Run `npm install`\n' +
    '   • Run `npm run dev`\n' +
    '   • Access via localhost\n\n' +
    '3. Make sure your .env file contains:\n' +
    '   • VITE_SUPABASE_URL=your_supabase_url\n' +
    '   • VITE_SUPABASE_ANON_KEY=your_supabase_key\n\n' +
    '📝 The WebContainer environment is great for development and testing the UI, but network requests to external services are restricted for security reasons.\n\n' +
    '🔗 Once deployed to a proper hosting environment, this application will be able to connect to your Nightscout server and provide full functionality.'
  );
  error.name = 'WebContainerNetworkError';
  return error;
};

// Make request with authentication fallback for API v1
const makeProxyRequestWithFallback = async (
  nightscoutUrl: string, 
  path: string, 
  token?: string,
  signal?: AbortSignal,
  apiVersion: 'v1' | 'v3' = 'v1',
  requestMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  requestBody?: unknown
) => {
  console.log(`🔍 makeProxyRequestWithFallback called with:`, {
    nightscoutUrl: nightscoutUrl?.substring(0, 50) + '...',
    path,
    hasToken: !!token,
    tokenLength: token?.length || 0,
    apiVersion,
    actualUrl: nightscoutUrl
  });

  // For API v3, always use bearer token
  if (apiVersion === 'v3') {
    return makeProxyRequest(nightscoutUrl, path, token, signal, apiVersion, 'bearer', requestMethod, requestBody);
  }
  
  // For API v1, use the correct authentication method directly
  // The proxy now handles API v1 with API-SECRET header, so use 'auto' to let it decide
  try {
    console.log(`🔄 Using standard API v1 authentication with API-SECRET header`);
    const result = await makeProxyRequest(nightscoutUrl, path, token, signal, apiVersion, 'auto', requestMethod, requestBody);
    console.log(`✅ API v1 authentication succeeded`);
    return result;
  } catch (error) {
    console.log(`❌ API v1 authentication failed:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
};

// Parse error response from proxy
const parseErrorResponse = (responseText: string): string => {
  try {
    const errorData = JSON.parse(responseText);
    return errorData.message || errorData.error || 'Unknown error occurred';
  } catch {
    return responseText || 'Failed to parse error response';
  }
};

// Make request through Supabase Edge Function proxy with retry logic
const makeProxyRequest = async (
  nightscoutUrl: string, 
  path: string, 
  token?: string,
  signal?: AbortSignal,
  apiVersion: 'v1' | 'v3' | 'auto' = 'auto',
  authMethod: 'bearer' | 'api-secret' | 'url-param' | 'auto' = 'auto',
  requestMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  requestBody?: unknown
) => {
  // Check if signal is already aborted
  if (signal?.aborted) {
    console.log('Request aborted before starting:', signal.reason);
    return null;
  }

  try {
    const proxyUrl = getProxyUrl();
    
    let lastError: Error | null = null;
    let lastResponse: string | null = null;
    
    // Try the request up to MAX_RETRIES times
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Check if signal is aborted before each attempt
        if (signal?.aborted) {
          console.log('Request aborted before attempt:', signal.reason);
          return null;
        }

        // If this isn't the first attempt, wait with exponential backoff + jitter
        if (attempt > 0) {
          const baseDelay = Math.min(
            INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1),
            MAX_RETRY_DELAY
          );

          // Equal-jitter: base/2 .. base
          const jitteredDelay = Math.floor(baseDelay / 2 + Math.random() * (baseDelay / 2));
          await sleep(jitteredDelay, signal);
        }

        // Format and validate URL before making request
        const validatedUrl = formatUrl(nightscoutUrl);
        console.log(`📡 Making proxy request:`, {
          url: validatedUrl?.substring(0, 50) + '...',
          path,
          hasToken: !!token,
          tokenPreview: token ? token.substring(0, 8) + '...' : 'none',
          apiVersion,
          authMethod,
          requestMethod,
          attempt: attempt + 1
        });

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            url: validatedUrl,
            path: path.startsWith('/') ? path : `/${path}`,
            token: token?.trim(),
            apiVersion,
            authMethod,
            method: requestMethod,
            body: requestBody
          }),
          signal,
          credentials: 'omit'
        });

        if (!response.ok) {
          const errorData = await response.text();
          lastResponse = errorData;
          const errorMessage = parseErrorResponse(errorData);
          
          // Provide more specific error messages based on status code
          if (response.status === 502) {
            throw new Error(`Proxy server error: ${errorMessage}. This usually means your Nightscout server is unreachable from the internet.`);
          } else if (response.status === 504) {
            throw new Error(`Request timeout: ${errorMessage}. Your Nightscout server may be slow to respond.`);
          } else if (response.status === 503) {
            throw new Error(`Nightscout server unavailable: ${errorMessage}. Your Nightscout server is temporarily unable to handle requests. This could be due to server maintenance, high load, or technical issues. Please try again later.`);
          } else if (response.status === 401) {
            const authError = new Error(`Authentication failed: ${errorMessage}. Please check your API token.`);
            authError.name = 'AuthenticationError';
            throw authError;
          } else if (response.status === 403) {
            const forbiddenError = new Error(`Access forbidden: ${errorMessage}. Your API token may not have sufficient permissions.`);
            forbiddenError.name = 'ForbiddenError';
            throw forbiddenError;
          } else if (response.status === 400) {
            const badRequestError = new Error(`Bad request: ${errorMessage}. The request parameters may be invalid.`);
            badRequestError.name = 'BadRequestError';
            throw badRequestError;
          } else if (response.status === 404) {
            const notFoundError = new Error(`Not found: ${errorMessage}. The requested endpoint may not exist.`);
            notFoundError.name = 'NotFoundError';
            throw notFoundError;
          } else {
            throw new Error(`HTTP ${response.status}: ${errorMessage}`);
          }
        }

        const responseText = await response.text();
        lastResponse = responseText;

        try {
          const responseData = JSON.parse(responseText);

          // Check if signal was aborted during the request
          if (signal?.aborted) {
            console.log('Request aborted during fetch:', signal.reason);
            return null;
          }

          // Check if the response contains an error
          if (responseData.error) {
            throw new Error(responseData.message || responseData.error);
          }
          
          // Return empty array if no data
          if (!responseData.data) {
            console.log('⚠️ No data received from Nightscout server, returning empty array');
            console.log('⚠️ Full response:', responseData);
            return [];
          }

          // Validate that data is either an array or an object
          if (typeof responseData.data !== 'object') {
            throw new Error(`Invalid response type from proxy: expected object or array, got ${typeof responseData.data}`);
          }

          console.log(`✅ Received data from Nightscout: ${Array.isArray(responseData.data) ? responseData.data.length + ' items' : 'object'}`);
          return responseData.data;
        } catch (parseError) {
          const parseErrorMessage = getErrorMessage(parseError);
          console.error('Failed to parse proxy response:', {
            error: parseErrorMessage,
            responsePreview: responseText.substring(0, 200)
          });
          throw new Error(
            `Failed to parse proxy response: ${parseErrorMessage}. Response preview: ${responseText.substring(0, 200)}`
          );
        }
      } catch (error) {
        // Check if signal was aborted during error handling
        if (signal?.aborted) {
          console.log('Request aborted during error handling:', signal.reason);
          return null;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request aborted:', error.message);
          return null;
        }

        // Check if this is a WebContainer network restriction
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          if (isWebContainer()) {
            const webContainerError = createWebContainerError();
            throw webContainerError;
          }
        }
        
        const errorMessage = getErrorMessage(error);
        lastError = new Error(errorMessage);
        
        // Don't retry on non-transient HTTP errors (authentication, authorization, bad request, not found)
        if (error instanceof Error && 
            ['ForbiddenError', 'BadRequestError', 'NotFoundError'].includes(error.name)) {
          console.error('Non-transient error, not retrying:', errorMessage);
          throw error;
        }
        
        // For authentication errors, throw immediately but allow fallback logic to handle them
        if (error instanceof Error && error.name === 'AuthenticationError') {
          console.error('Authentication error, throwing for fallback handling:', errorMessage);
          throw error;
        }
        
        // Enhanced error handling for network issues
        if (error instanceof TypeError && errorMessage.includes('Failed to fetch')) {
          lastError = new Error(
            `Network connection failed. This could be due to:\n` +
            '• Your internet connection is down or unstable\n' +
            '• Supabase Edge Functions are not properly configured or deployed\n' +
            '• Your browser is blocking the connection (check for ad blockers)\n' +
            '• CORS or firewall blocking the connection\n' +
            '• Invalid Supabase project URL or API key\n' +
            '• Environment variables not properly loaded (check .env file)\n' +
            '• Your Nightscout server is offline or unreachable\n' +
            '• WebContainer environment restrictions on outbound requests\n\n' +
            'Please verify your network connection and Supabase configuration.\n' +
            `Original error: ${errorMessage || 'No error message provided'}`
          );
        } else if (!errorMessage || errorMessage === 'undefined' || errorMessage.trim() === '') {
          lastError = new Error(
            'Request failed with no error message. This typically indicates:\n' +
            '• Network connectivity issues\n' +
            '• DNS resolution problems\n' +
            '• Firewall or proxy blocking the request\n' +
            '• Invalid Supabase configuration\n' +
            '• WebContainer environment restrictions\n' +
            '• Edge function timeout or internal error'
          );
        }
        
        console.error('Proxy request error:', {
          attempt: attempt + 1,
          error: lastError.message,
          stack: lastError.stack,
          lastResponse: lastResponse?.substring(0, 200)
        });
        
        // Don't retry WebContainer network errors
        if (lastError.name === 'WebContainerNetworkError') {
          throw lastError;
        }
        
        if (attempt === MAX_RETRIES - 1) {
          throw new Error(`Failed after ${MAX_RETRIES} attempts: ${lastError.message}`);
        }
      }
    }

    throw lastError || new Error('Failed to make request after all retries');
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    
    // Don't wrap WebContainer network errors
    if (error instanceof Error && error.name === 'WebContainerNetworkError') {
      throw error;
    }
    
    // If this is a configuration error, throw it immediately without retries
    if (errorMessage.includes('Supabase') || errorMessage.includes('configuration') || errorMessage.includes('environment')) {
      throw new Error(errorMessage);
    }
    
    throw new Error(`Failed to make proxy request: ${errorMessage}`);
  }
};

// Test basic connectivity without authentication
export const testBasicConnectivity = async (url: string) => {
  try {
    console.log(`🌐 Testing basic connectivity to: ${url}`);
    
    // Try to access the status endpoint which usually doesn't require auth
    const testPath = '/api/v1/status';
    
    const result = await makeProxyRequest(url, testPath, undefined, undefined, 'v1', 'auto');
    
    console.log('✅ Basic connectivity test successful:', result);
    return { success: true, data: result };
  } catch (error) {
    console.log('❌ Basic connectivity test failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
};

// Special test function for troubleshooting ns.10be.de and similar instances
export const testSpecificInstance = async (url: string, token?: string) => {
  try {
    console.log(`🔍 DIAGNOSTIC TEST for ${url}`);
    console.log(`🔧 formatUrl input: "${url}"`);
    
    const formattedUrl = formatUrl(url);
    console.log(`🔧 formatUrl output: "${formattedUrl}"`);
    
    // Test without any authentication first
    console.log(`📍 Testing status endpoint without auth...`);
    try {
      const statusResult = await makeProxyRequest(formattedUrl, '/api/v1/status', undefined, undefined, 'v1', 'auto');
      console.log(`✅ Status endpoint accessible:`, statusResult);
    } catch (error) {
      console.log(`❌ Status endpoint failed:`, error);
    }
    
    if (token) {
      // Test with authentication
      console.log(`📍 Testing entries endpoint with auth...`);
      try {
        const entriesResult = await makeProxyRequest(formattedUrl, '/api/v1/entries?count=1', token, undefined, 'v1', 'auto');
        console.log(`✅ Entries endpoint accessible:`, entriesResult);
        return { success: true, data: entriesResult };
      } catch (error) {
        console.log(`❌ Entries endpoint failed:`, error);
        throw error;
      }
    } else {
      return { success: true, message: 'Status endpoint test completed' };
    }
  } catch (error) {
    console.error('❌ Diagnostic test failed:', error);
    throw error;
  }
};

// Test connection to Nightscout
export const testConnection = async (url: string, token?: string, apiVersion: 'v1' | 'v3' = 'v1') => {
  try {
    console.log(`🧪 Testing connection with API ${apiVersion}...`);
    console.log(`🔗 URL: ${url?.substring(0, 50)}...`);
    console.log(`🔑 Token provided: ${!!token}, length: ${token?.length || 0}`);
    
    // Special handling for known problematic instances
    const hostname = new URL(formatUrl(url)).hostname.toLowerCase();
    if (hostname.includes('10be.de')) {
      console.log(`🚨 Detected problematic instance: ${hostname}`);
      console.log(`🔍 Running diagnostic test...`);
      
      try {
        await testSpecificInstance(url, token);
        console.log(`✅ Diagnostic test passed for ${hostname}`);
        return {
          success: true,
          apiVersion: apiVersion,
          diagnosticPassed: true
        };
      } catch (error) {
        console.log(`❌ Diagnostic test failed for ${hostname}:`, error);
        // Continue with normal test to get proper error message
      }
    }
    
    // Use appropriate test endpoint based on API version
    let testPath: string;
    if (apiVersion === 'v3') {
      // Prefer API v3's filter syntax for broad compatibility.
      // Many instances support `sort=-date`, while some support `sort$desc=date`.
      testPath = '/api/v3/entries?limit=1&sort=-date';
    } else {
      testPath = '/api/v1/entries?count=1';
    }
    
    console.log(`📍 Test endpoint: ${testPath}`);
    
    const testResult = await makeProxyRequestWithFallback(url, testPath, token, undefined, apiVersion);

    // If v3 sort syntax is not supported, retry with the alternative.
    if (apiVersion === 'v3' && Array.isArray(testResult) && testResult.length === 0) {
      try {
        const alt = await makeProxyRequestWithFallback(url, '/api/v3/entries?limit=1&sort$desc=date', token, undefined, 'v3');
        if (Array.isArray(alt)) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          testResult.splice(0, testResult.length, ...alt);
        }
      } catch {
        // ignore: empty is not necessarily an error
      }
    }
    
    if (testResult === null) {
      throw new Error('Connection test failed - no response received');
    }
    
    console.log(`✅ Connection test successful for API ${apiVersion}`);
    return {
      success: true,
      apiVersion: apiVersion
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('❌ Connection test failed:', error);
    
    // Check if this is a 421 error for specific guidance
    if (errorMessage.includes('421') || errorMessage.includes('Misdirected Request')) {
      throw new Error(`Server Configuration Issue: Your Nightscout server doesn't recognize the hostname you're using.

This is common with ns.10be.de and similar hosting services.

Please try:
1. Verify the correct URL by accessing your Nightscout in a web browser
2. Check if the URL format should be different (maybe without 'ns.' prefix)
3. Contact your hosting provider about the hostname configuration

This is a server-side issue, not an authentication problem.`);
    }
    
    // Provide specific guidance for API v3 issues
    if (apiVersion === 'v3' && errorMessage.includes('401')) {
      throw new Error(`Failed to connect to Nightscout API v3: Authentication failed. 

For API v3, ensure your Bearer token has these permissions:
• api:entries:read
• api:treatments:read  
• api:profile:read
• api:devicestatus:read

Your Nightscout server must be version 15.0+ to support API v3.

Original error: ${errorMessage}`);
    } else if (apiVersion === 'v3' && errorMessage.includes('404')) {
      throw new Error(`Failed to connect to Nightscout API v3: Endpoint not found.

This usually means:
• Your Nightscout server doesn't support API v3 (requires version 15.0+)
• Try switching to API v1 in settings if you have an older Nightscout version

Original error: ${errorMessage}`);
    }
    
    throw new Error(`Failed to connect to Nightscout: ${errorMessage}`);
  }
};

// Fetch data with enhanced pagination support for large datasets
export const fetchData = async (
  url: string, 
  days: number, 
  token?: string,
  signal?: AbortSignal,
  preferredApiVersion?: 'v1' | 'v3' | null
) => {
  try {
    const startDate = subDays(new Date(), days).toISOString();
    const endDate = new Date().toISOString();

    console.log(`📥 Fetching ${days} days of data from ${startDate} to ${endDate}`);

    // Enhanced count limits for larger datasets - UP TO 30,000 READINGS
    const getCountLimit = (days: number) => {
      if (days <= 3) return 1000;       // 3 days: 1k entries
      if (days <= 7) return 3000;       // 1 week: 3k entries
      if (days <= 14) return 5000;      // 2 weeks: 5k entries  
      if (days <= 30) return 10000;     // 1 month: 10k entries
      if (days <= 60) return 20000;     // 2 months: 20k entries
      return 30000;                     // 3+ months: 30k entries (NEW MAXIMUM)
    };

    const countLimit = getCountLimit(days);
    console.log(`📊 Using count limit: ${countLimit} for ${days} days`);

    // Use the specified API version - no fallback logic
    let entries, treatments, profiles;
    const apiVersion = preferredApiVersion || 'v1'; // Default to v1 if not specified
    let result;
    
    if (apiVersion === 'v1') {
      console.log('🔧 Using API v1 (optimized for cost)...');
      
      // OPTIMIZATION: Use date timestamp instead of dateString for better performance
      // Most Nightscout instances index by date (timestamp) which is more reliable
      const startTimestamp = new Date(startDate).getTime();
      const endTimestamp = new Date(endDate).getTime();
      
        // API v1 entries for long ranges must be paged; otherwise we only get the newest slice.
        // Default 5-min CGM data is ~288 points/day, so 90 days is ~26k points.
        const maxV1PageSize = 10000;
        const optimizedLimit = countLimit;
      
      // Build endpoints
        const getV1EntryDateMs = (entry: any): number | null => {
          const candidate = entry?.date ?? entry?.mills ?? entry?.srvCreated ?? entry?.dateString ?? entry?.created_at;
          if (candidate == null) return null;
          if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
          if (typeof candidate === 'string') {
            const asNumber = Number(candidate);
            if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
            const asDate = Date.parse(candidate);
            if (Number.isFinite(asDate)) return asDate;
          }
          return null;
        };

        const safeProxyFetch = async (
          path: string
        ): Promise<any[]> => {
          try {
            const res = await makeProxyRequestWithFallback(url, path, token, signal, 'v1');
            return Array.isArray(res) ? res : [];
          } catch (e) {
            console.warn('⚠️ Non-fatal Nightscout fetch failed:', { path, error: getErrorMessage(e) });
            return [];
          }
        };

        const normalizeEpochMs = (value: number): number => {
          // Heuristic: epoch seconds are ~1e9, epoch ms are ~1e12.
          // Treat anything < 1e11 as seconds.
          if (value > 0 && value < 1e11) return value * 1000;
          return value;
        };

        const getV1TreatmentTimeMs = (treatment: any): number | null => {
          const candidate = treatment?.created_at ?? treatment?.timestamp ?? treatment?.mills;
          if (candidate == null) return null;
          if (typeof candidate === 'number' && Number.isFinite(candidate)) return normalizeEpochMs(candidate);
          if (typeof candidate === 'string') {
            const asNumber = Number(candidate);
            if (Number.isFinite(asNumber) && asNumber > 0) return normalizeEpochMs(asNumber);
            const asDate = Date.parse(candidate);
            if (Number.isFinite(asDate)) return asDate;
          }
          return null;
        };

        const fetchV1TreatmentsPaged = async () => {
          // Nightscout v1 treatments often cap at count=5000.
          // For long ranges (e.g. 90 days) we need pagination, otherwise older sensor events disappear.
          const pageSize = 5000;
          const maxPages = 25; // safety cap to avoid unbounded loads

          console.log(`📄 API v1 treatments pagination enabled (max ${maxPages} pages × ${pageSize})`);

          const fetchCreatedAtPages = async () => {
            const collected: any[] = [];
            let cursorIso: string | null = endDate;

            for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
              const params = new URLSearchParams();
              params.set('count', String(pageSize));
              params.set('sort$desc', 'created_at');
              // Do NOT rely on server-side $gte filters here; some instances ignore/handle them inconsistently.
              // We page backwards by cursor and stop once we've reached the requested start.
              params.set(pageIndex === 0 ? 'find[created_at][$lte]' : 'find[created_at][$lt]', cursorIso ?? endDate);
              const path = `/api/v1/treatments?${params.toString()}`;

              console.log(`📄 API v1 treatments(created_at) page ${pageIndex + 1}/${maxPages}: ${path}`);
              const page = await safeProxyFetch(path);
              if (!page.length) break;
              collected.push(...page);

              const oldest = page[page.length - 1];
              const oldestMs = getV1TreatmentTimeMs(oldest);
              if (!oldestMs || oldestMs <= startTimestamp) break;
              cursorIso = new Date(oldestMs).toISOString();

              if (page.length < pageSize) break;
            }

            return collected;
          };

          const fetchTimestampPages = async () => {
            const collected: any[] = [];
            let cursorMs: number | null = endTimestamp;

            for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
              const params = new URLSearchParams();
              params.set('count', String(pageSize));
              params.set('sort$desc', 'timestamp');
              // Same approach as created_at: page by cursor only, then filter client-side.
              params.set(pageIndex === 0 ? 'find[timestamp][$lte]' : 'find[timestamp][$lt]', String(cursorMs ?? endTimestamp));
              const path = `/api/v1/treatments?${params.toString()}`;

              console.log(`📄 API v1 treatments(timestamp) page ${pageIndex + 1}/${maxPages}: ${path}`);
              const page = await safeProxyFetch(path);
              if (!page.length) break;
              collected.push(...page);

              const oldest = page[page.length - 1];
              const oldestMs = getV1TreatmentTimeMs(oldest);
              if (!oldestMs || oldestMs <= startTimestamp) break;
              cursorMs = oldestMs;

              if (page.length < pageSize) break;
            }

            return collected;
          };

          const byCreatedAt = await fetchCreatedAtPages();
          // Most Nightscout instances include `created_at`. Only fall back to timestamp paging
          // when `created_at` is missing/unusable for the requested range.
          const byTimestamp = byCreatedAt.length > 0 ? [] : await fetchTimestampPages();

          const combined = [...byCreatedAt, ...byTimestamp];
          const seen = new Set<string>();

          const deduped = combined.filter((t: any) => {
            const id = t?._id ?? t?.id;
            const key = id ? String(id) : `${t?.eventType ?? ''}:${t?.created_at ?? ''}:${t?.timestamp ?? ''}:${t?.enteredBy ?? ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          const inRange = deduped.filter((t: any) => {
            const tMs = getV1TreatmentTimeMs(t);
            if (!tMs) return false;
            return tMs >= startTimestamp && tMs <= endTimestamp;
          });

          console.log(`📄 API v1 treatments collected: ${combined.length}, deduped: ${deduped.length}, in-range: ${inRange.length}`);
          return inRange;
        };

        const buildV1EntriesPath = (cursor: number | null, isFirstPage: boolean, pageCount: number) => {
          const params = new URLSearchParams();
          params.set('count', String(pageCount));
          params.set('sort$desc', 'date');
          params.set('find[date][$gte]', String(startTimestamp));
          params.set(isFirstPage ? 'find[date][$lte]' : 'find[date][$lt]', String(cursor ?? endTimestamp));
          return `/api/v1/entries?${params.toString()}`;
        };

        const fetchV1EntriesPaged = async () => {
          const collected: any[] = [];
          const seen = new Set<string>();
          const target = Math.min(optimizedLimit, 30000);

          let cursor: number | null = endTimestamp;
          const maxPages = Math.max(1, Math.ceil(target / maxV1PageSize));

          for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
            const remaining = target - collected.length;
            if (remaining <= 0) break;

            const pageSize = Math.min(maxV1PageSize, remaining);
            const path = buildV1EntriesPath(cursor, pageIndex === 0, pageSize);
            console.log(`📄 API v1 entries page ${pageIndex + 1}/${maxPages}: ${path}`);

            const page = await safeProxyFetch(path);
            if (!page.length) break;

            for (const item of page) {
              const id = item?._id ?? item?.id ?? getV1EntryDateMs(item);
              const key = `${id ?? ''}:${item?.type ?? ''}:${item?.sgv ?? ''}`;
              if (!seen.has(key)) {
                seen.add(key);
                collected.push(item);
              }
            }

            const oldest = page[page.length - 1];
            const oldestDate = getV1EntryDateMs(oldest);
            if (!oldestDate || oldestDate <= startTimestamp) break;
            cursor = oldestDate;

            if (page.length < pageSize) break;
          }

          return collected;
        };

      const v1ProfilePath = '/api/v1/profile';
      const v1DeviceStatusPath = '/api/v1/devicestatus?count=1';

        // Parallelize requests; entries are paged to actually cover long ranges.
        const [entriesRes, treatmentsRes, profilesRes, deviceStatusRes] = await Promise.all([
          fetchV1EntriesPaged(),
          fetchV1TreatmentsPaged(),
          makeProxyRequestWithFallback(url, v1ProfilePath, token, signal, 'v1'),
          makeProxyRequestWithFallback(url, v1DeviceStatusPath, token, signal, 'v1')
        ]);

      entries = entriesRes;
      treatments = treatmentsRes;
      profiles = profilesRes;
      const deviceStatus = deviceStatusRes;

      console.log(`📋 Entries result: ${Array.isArray(entries) ? entries.length + ' items' : typeof entries}`);
      console.log(`💊 Treatments result: ${Array.isArray(treatments) ? treatments.length + ' items' : typeof treatments}`);
      console.log(`👤 Profile result: ${Array.isArray(profiles) ? profiles.length + ' items' : typeof profiles}`);
      console.log(`📱 Device status result: ${Array.isArray(deviceStatus) ? deviceStatus.length + ' items' : typeof deviceStatus}`);
      
      console.log('✅ Successfully fetched data using API v1 (4 optimized requests)');
      
      // Return the detected API version along with the data
      result = {
        entries: Array.isArray(entries) ? entries : [],
        treatments: Array.isArray(treatments) ? treatments : [],
        profile: Array.isArray(profiles) ? profiles : [],
        deviceStatus: Array.isArray(deviceStatus) ? deviceStatus : [],
        detectedApiVersion: apiVersion as 'v1' | 'v3'
      };
    } else if (apiVersion === 'v3') {
      console.log('Using detected API v3...');
      // API v3 uses different query parameter syntax and endpoints
      // Convert ISO date to timestamp for API v3 compatibility
      const startTimestamp = new Date(startDate).getTime();
      const endTimestamp = new Date(endDate).getTime();
      
      // API v3 has a default limit of 1000, which is sufficient for most use cases
      // We'll use larger limits and fewer requests to minimize Edge Function calls
      // The API v3 limit can be up to 1000 per request
      const maxV3Limit = 1000;
      
      console.log(`📅 API v3 date range: ${startTimestamp} to ${endTimestamp}`);
      console.log(`📊 Requesting data for ${days} days`);

      // For API v3, we'll make a single optimized request for each data type
      // Using date$gte and date$lte query parameters (API v3 uses $ instead of [] for filters)
      
      type V3ParamStyle = 'filter' | 'dollar';

      const getEntryDate = (entry: any): number | null => {
        const candidate = entry?.date ?? entry?.srvCreated ?? entry?.mills ?? entry?.dateString ?? entry?.created_at;
        if (candidate == null) return null;
        if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
        if (typeof candidate === 'string') {
          const asNumber = Number(candidate);
          if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
          const asDate = Date.parse(candidate);
          if (Number.isFinite(asDate)) return asDate;
        }
        return null;
      };

      const estimateMaxPagesForDays = (days: number) => {
        // Assume ~288-300 CGM points/day (5 min). Add a small buffer.
        const estimatedPoints = Math.ceil(days * 300 * 1.15);
        return Math.min(50, Math.max(3, Math.ceil(estimatedPoints / maxV3Limit) + 1));
      };

      const buildV3EntriesPath = (style: V3ParamStyle, cursor: number | null, isFirstPage: boolean) => {
        const params = new URLSearchParams();
        params.set('limit', String(maxV3Limit));

        if (style === 'filter') {
          // Nightscout v3 canonical filtering
          params.set('filter[date][$gte]', String(startTimestamp));
          params.set(isFirstPage ? 'filter[date][$lte]' : 'filter[date][$lt]', String(cursor ?? endTimestamp));
          params.set('sort', '-date');
        } else {
          // Older/alternate syntax seen on some deployments
          params.set('date$gte', String(startTimestamp));
          params.set(isFirstPage ? 'date$lte' : 'date$lt', String(cursor ?? endTimestamp));
          params.set('sort$desc', 'date');
        }

        return `/api/v3/entries?${params.toString()}`;
      };

      const fetchV3EntriesPaged = async (style: V3ParamStyle) => {
        const maxPages = estimateMaxPagesForDays(days);
        const collected: any[] = [];
        const seen = new Set<string>();

        let cursor: number | null = endTimestamp;
        for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
          const path = buildV3EntriesPath(style, cursor, pageIndex === 0);
          console.log(`📄 API v3 entries page ${pageIndex + 1}/${maxPages} (${style}): ${path}`);

          const page = await makeProxyRequestWithFallback(url, path, token, signal, 'v3');
          if (!Array.isArray(page) || page.length === 0) {
            break;
          }

          for (const item of page) {
            const id = item?._id ?? item?.id ?? getEntryDate(item);
            const key = `${id ?? ''}:${item?.type ?? ''}:${item?.sgv ?? ''}`;
            if (!seen.has(key)) {
              seen.add(key);
              collected.push(item);
            }
          }

          const oldest = page[page.length - 1];
          const oldestDate = getEntryDate(oldest);
          if (!oldestDate || oldestDate <= startTimestamp) {
            break;
          }
          // Move cursor earlier for the next page.
          cursor = oldestDate;

          // If we got less than the limit, no more pages.
          if (page.length < maxV3Limit) {
            break;
          }
        }

        return collected;
      };

      const fetchV3EntriesWithFallbacks = async () => {
        // 1) Try canonical filter syntax first.
        const filtered = await fetchV3EntriesPaged('filter');
        if (filtered.length > 0) return filtered;

        // 2) Sanity check: do we get *any* data unfiltered? If yes, it's likely query-param incompatibility.
        const unfiltered = await makeProxyRequestWithFallback(url, '/api/v3/entries?limit=5&sort=-date', token, signal, 'v3');
        if (Array.isArray(unfiltered) && unfiltered.length > 0) {
          console.log('⚠️ API v3 entries filter returned empty, but unfiltered returned data. Trying alternate param style...');
          const dollar = await fetchV3EntriesPaged('dollar');
          if (dollar.length > 0) return dollar;

          // 3) Last resort: return unfiltered data (at least non-empty) and let downstream logic work.
          return unfiltered;
        }

        // 4) Nothing returned even unfiltered.
        return Array.isArray(unfiltered) ? unfiltered : [];
      };

      const getV3TreatmentTimeMs = (treatment: any): number | null => {
        const candidate = treatment?.created_at ?? treatment?.srvCreated ?? treatment?.timestamp ?? treatment?.mills;
        if (candidate == null) return null;
        if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
        if (typeof candidate === 'string') {
          const asNumber = Number(candidate);
          if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
          const asDate = Date.parse(candidate);
          if (Number.isFinite(asDate)) return asDate;
        }
        return null;
      };

      const fetchV3TreatmentsPaged = async (style: V3ParamStyle) => {
        const maxPages = 25;
        const collected: any[] = [];
        const seen = new Set<string>();

        let cursorIso: string | null = endDate;
        for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
          const params = new URLSearchParams();
          params.set('limit', String(maxV3Limit));

          if (style === 'filter') {
            params.set('sort', '-created_at');
            params.set('filter[created_at][$gte]', startDate);
            params.set(pageIndex === 0 ? 'filter[created_at][$lte]' : 'filter[created_at][$lt]', cursorIso ?? endDate);
          } else {
            params.set('sort$desc', 'created_at');
            params.set('created_at$gte', encodeURIComponent(startDate));
            params.set(pageIndex === 0 ? 'created_at$lte' : 'created_at$lt', encodeURIComponent(cursorIso ?? endDate));
          }

          const path = `/api/v3/treatments?${params.toString()}`;
          console.log(`📄 API v3 treatments page ${pageIndex + 1}/${maxPages} (${style}): ${path}`);

          const page = await makeProxyRequestWithFallback(url, path, token, signal, 'v3');
          if (!Array.isArray(page) || page.length === 0) break;

          for (const item of page) {
            const id = item?._id ?? item?.id;
            const key = id ? String(id) : `${item?.eventType ?? ''}:${item?.created_at ?? ''}:${item?.timestamp ?? ''}:${item?.enteredBy ?? ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            collected.push(item);
          }

          const oldest = page[page.length - 1];
          const oldestMs = getV3TreatmentTimeMs(oldest);
          if (!oldestMs || oldestMs <= startTimestamp) break;
          cursorIso = new Date(oldestMs).toISOString();

          if (page.length < maxV3Limit) break;
        }

        return collected;
      };

      const fetchV3TreatmentsWithFallbacks = async () => {
        // 1) Canonical filter syntax first (paged)
        const filtered = await fetchV3TreatmentsPaged('filter');
        if (filtered.length > 0) return filtered;

        // 2) Sanity check: any data at all?
        const unfiltered = await makeProxyRequestWithFallback(url, '/api/v3/treatments?limit=5&sort=-created_at', token, signal, 'v3');
        if (Array.isArray(unfiltered) && unfiltered.length > 0) {
          console.log('⚠️ API v3 treatments filter returned empty, but unfiltered returned data. Trying alternate param style...');
          const alt = await fetchV3TreatmentsPaged('dollar');
          if (alt.length > 0) return alt;
          return unfiltered;
        }

        return Array.isArray(unfiltered) ? unfiltered : [];
      };

      const fetchV3Profile = async () => {
        try {
          return await makeProxyRequestWithFallback(url, '/api/v3/profile/current', token, signal, 'v3');
        } catch (err) {
          if (err instanceof Error && err.name === 'NotFoundError') {
            return await makeProxyRequestWithFallback(url, '/api/v3/profile', token, signal, 'v3');
          }
          throw err;
        }
      };

      const fetchV3DeviceStatus = async () => {
        try {
          return await makeProxyRequestWithFallback(url, '/api/v3/devicestatus?limit=1&sort$desc=created_at', token, signal, 'v3');
        } catch (err) {
          if (err instanceof Error && (err.name === 'NotFoundError' || err.name === 'BadRequestError')) {
            return await makeProxyRequestWithFallback(url, '/api/v3/devicestatus?limit=1&sort$desc=date', token, signal, 'v3');
          }
          throw err;
        }
      };

      // Entries + treatments are required; profile/devicestatus are best-effort.
      const [entriesSettled, treatmentsSettled, profilesSettled, deviceStatusSettled] = await Promise.allSettled([
        fetchV3EntriesWithFallbacks(),
        fetchV3TreatmentsWithFallbacks(),
        fetchV3Profile(),
        fetchV3DeviceStatus()
      ]);

      if (entriesSettled.status === 'rejected') {
        throw entriesSettled.reason;
      }
      if (treatmentsSettled.status === 'rejected') {
        throw treatmentsSettled.reason;
      }

      entries = entriesSettled.value;
      treatments = treatmentsSettled.value;
      profiles = profilesSettled.status === 'fulfilled' ? profilesSettled.value : [];
      const deviceStatus = deviceStatusSettled.status === 'fulfilled' ? deviceStatusSettled.value : [];

      console.log(`📋 Entries result: ${Array.isArray(entries) ? entries.length + ' items' : typeof entries}`);
      console.log(`💊 Treatments result: ${Array.isArray(treatments) ? treatments.length + ' items' : typeof treatments}`);
      
      // `fetchV3EntriesWithFallbacks()` already paginates as needed.
      
      console.log('✅ Successfully fetched data using API v3 with optimized requests');
      
      // Normalize the data to ensure consistent format with v1
      // API v3 might have slightly different field names
      const normalizedEntries = Array.isArray(entries) ? entries.map((entry: any) => ({
        ...entry,
        // Ensure date field exists (v3 might use 'date' or 'srvCreated')
        date: entry.date || entry.srvCreated,
        // Ensure sgv is a number (v3 might return as string)
        sgv: typeof entry.sgv === 'string' ? parseInt(entry.sgv, 10) : entry.sgv,
        // Ensure mills exists for compatibility
        mills: entry.date || entry.srvCreated
      })) : [];

      const normalizedTreatments = Array.isArray(treatments) ? treatments.map((treatment: any) => ({
        ...treatment,
        // Ensure created_at exists
        created_at: treatment.created_at || treatment.srvCreated,
        // Ensure mills exists for compatibility
        mills: treatment.created_at || treatment.srvCreated
      })) : [];

      // Return the detected API version along with the data
      result = {
        entries: normalizedEntries,
        treatments: normalizedTreatments,
        profile: Array.isArray(profiles) ? profiles : (profiles ? [profiles] : []), // Normalize v3 profile response
        deviceStatus: Array.isArray(deviceStatus) ? deviceStatus : [],
        detectedApiVersion: apiVersion as 'v1' | 'v3'
      };
    } else {
      throw new Error(`Unsupported API version: ${apiVersion}. Please select either 'v1' or 'v3' in settings.`);
    }

    // Check if any request was aborted
    if ([entries, treatments].some(result => result === null)) {
      console.log('One or more requests were aborted');
      return null;
    }


    console.log(`📊 Processed data summary (${apiVersion.toUpperCase()}):`);
    console.log(`  - Entries: ${result.entries.length}`);
    console.log(`  - Treatments: ${result.treatments.length}`);
    console.log(`  - Profiles: ${result.profile.length}`);
    console.log(`  - Device Status: ${result.deviceStatus.length}`);

    return result;
  } catch (error) {
    // Check if the request was aborted
    if (signal?.aborted) {
      console.log('Data fetch aborted:', signal.reason);
      return null;
    }

    // Don't wrap WebContainer network errors
    if (error instanceof Error && error.name === 'WebContainerNetworkError') {
      throw error;
    }

    const errorMessage = getErrorMessage(error);
    console.error('Data fetch failed:', error);
    
    // Provide specific guidance for API v3 issues
    if (preferredApiVersion === 'v3') {
      if (errorMessage.includes('Parameter limit out of tolerance')) {
        throw new Error(`Failed to fetch Nightscout data using API v3: Parameter limit exceeded.

The pagination system should have prevented this error. This might indicate:
• Your Nightscout server has very strict API v3 limits
• There was an issue with the automatic pagination
• Suggestion: Try reducing the time range or switching to API v1 in Settings

Technical details: ${errorMessage}`);
      } else if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('404')) {
        throw new Error(`Failed to fetch Nightscout data using API v3: ${errorMessage}

Common API v3 issues:
• Authentication: Ensure your Bearer token has required permissions (api:entries:read, api:treatments:read, api:profile:read, api:devicestatus:read)
• Compatibility: Your Nightscout server must be version 15.0+ for API v3 support
• Suggestion: Try switching to API v1 in Settings if you have an older Nightscout version

If you continue having issues, please try switching to API v1 in the Settings page.`);
      }
    }
    
    throw new Error(`Failed to fetch Nightscout data: ${errorMessage}`);
  }
};

// Create a treatment/event in Nightscout (used for sensor-change tracking)
export const createTreatment = async (
  url: string,
  treatment: Record<string, unknown>,
  token?: string,
  signal?: AbortSignal,
  preferredApiVersion?: 'v1' | 'v3' | null
) => {
  const apiVersion = preferredApiVersion || 'v1';
  const path = apiVersion === 'v3' ? '/api/v3/treatments' : '/api/v1/treatments';

  return makeProxyRequestWithFallback(
    url,
    path,
    token,
    signal,
    apiVersion,
    'POST',
    treatment
  );
};