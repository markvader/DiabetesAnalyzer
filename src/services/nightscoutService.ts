// deno-lint-ignore-file no-explicit-any
import { subDays } from 'date-fns';
import { debugError, debugLog, debugWarn } from '../utils/logger';
import { toEpochMs } from '../utils/time';
import {
  normalizeNightscoutV3DeviceStatusArray,
  normalizeNightscoutV3ProfileArray,
  unwrapNightscoutV3Entries,
  unwrapNightscoutV3Treatments
} from '../utils/nightscoutUnwrap';
import { createPagedFetchV3 } from '../utils/nightscoutPaging';
import { normalizeNightscoutV1Data } from '../utils/nightscoutNormalizeV1';
import { fetchNightscoutV1EntriesPaged, fetchNightscoutV1TreatmentsPaged } from '../utils/nightscoutV1Paging';
import type { NightscoutFetchResult } from '../types/nightscout';
import { createAsyncRequestCache } from '../utils/asyncRequestCache';
import {
  parseNightscoutDeviceStatus,
  parseNightscoutEntries,
  parseNightscoutProfiles,
  parseNightscoutTreatments
} from '../utils/nightscoutParse';
import {
  AuthError,
  BadResponseError,
  RateLimitedError,
  TimeoutError,
  isNightscoutError
} from '../utils/nightscoutErrors';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 2000; // Initial delay in milliseconds
const MAX_RETRY_DELAY = 32000; // Maximum delay in milliseconds

const NIGHTSCOUT_REQUEST_CACHE_TTL_MS = 10_000;
const nightscoutRequestCache = createAsyncRequestCache<unknown>({
  defaultTtlMs: NIGHTSCOUT_REQUEST_CACHE_TTL_MS,
  maxEntries: 250
});

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
  
  debugLog(`🔧 formatUrl input: "${formattedUrl}"`);
  
  try {
    // Handle URLs with or without protocol
    if (!formattedUrl.match(/^https?:\/\//)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Remove any query parameters or hash fragments before validation
    formattedUrl = formattedUrl.split(/[?#]/)[0];

    debugLog(`🔧 formatUrl after protocol/cleanup: "${formattedUrl}"`);

    const urlObj = new URL(formattedUrl);
    
    // Basic sanity checks
    if (!urlObj.hostname) {
      throw new Error('Invalid hostname in URL');
    }
    
    // Remove trailing slashes and normalize path
    const finalUrl = urlObj.origin + (urlObj.pathname === '/' ? '' : urlObj.pathname.replace(/\/+$/, ''));
    
    debugLog(`🔧 formatUrl final output: "${finalUrl}"`);
    
    return finalUrl;
  } catch (error) {
    debugError('🔧 URL validation error:', error);
    throw new Error(`Invalid Nightscout URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Validate Supabase configuration and construct proxy URL
const getProxyUrl = (): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  debugLog('Environment check:', {
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
    debugLog('Proxy URL constructed:', url.toString());
    return url.toString();
  } catch (error) {
    debugError('Supabase URL validation error:', error);
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
    const errorObj = error as { message?: unknown; error?: unknown };
    if (typeof errorObj.message === 'string' && errorObj.message) return errorObj.message;
    if (typeof errorObj.error === 'string' && errorObj.error) return errorObj.error;
    return String(error);
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
  debugLog(`🔍 makeProxyRequestWithFallback called with:`, {
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
    debugLog(`🔄 Using standard API v1 authentication with API-SECRET header`);
    const result = await makeProxyRequest(nightscoutUrl, path, token, signal, apiVersion, 'auto', requestMethod, requestBody);
    debugLog(`✅ API v1 authentication succeeded`);
    return result;
  } catch (error) {
    debugWarn(`❌ API v1 authentication failed:`, error instanceof Error ? error.message : String(error));
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
    debugLog('Request aborted before starting:', signal.reason);
    return null;
  }

  try {
    const proxyUrl = getProxyUrl();

    // Validate URL once per request (not once per retry attempt)
    const validatedUrl = formatUrl(nightscoutUrl);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const trimmedToken = token?.trim();

    // Small in-memory TTL cache + inflight dedupe.
    // Enabled for GET requests (no body). If a caller provides an AbortSignal, we only cancel *waiting*;
    // the underlying shared request is not aborted to avoid cross-cancelling other callers.
    const isCacheable = requestMethod === 'GET' && (requestBody === undefined || requestBody === null);
    const cacheKey = isCacheable
      ? JSON.stringify({
          url: validatedUrl,
          path: normalizedPath,
          token: trimmedToken ?? '',
          apiVersion,
          authMethod,
          method: requestMethod
        })
      : null;

    const executeWithRetries = async (effectiveSignal?: AbortSignal): Promise<unknown> => {
      let lastError: Error | null = null;
      let lastResponse: string | null = null;
    
      // Try the request up to MAX_RETRIES times
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Check if signal is aborted before each attempt
          if (effectiveSignal?.aborted) {
            debugLog('Request aborted before attempt:', effectiveSignal.reason);
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
            await sleep(jitteredDelay, effectiveSignal);
          }

          debugLog(`📡 Making proxy request:`, {
            url: validatedUrl?.substring(0, 50) + '...',
            path: normalizedPath,
            hasToken: !!trimmedToken,
            tokenPreview: trimmedToken ? trimmedToken.substring(0, 8) + '...' : 'none',
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
              path: normalizedPath,
              token: trimmedToken,
              apiVersion,
              authMethod,
              method: requestMethod,
              body: requestBody
            }),
            signal: effectiveSignal,
            credentials: 'omit'
          });

        if (!response.ok) {
          const errorData = await response.text();
          lastResponse = errorData;
          const errorMessage = parseErrorResponse(errorData);

          const status = response.status;

          if (status === 401 || status === 403) {
            throw new AuthError(`Authentication failed: ${errorMessage}`, { status, cause: errorData });
          }

          if (status === 429) {
            throw new RateLimitedError(`Rate limited: ${errorMessage}`, { status, cause: errorData });
          }

          if (status === 504) {
            throw new TimeoutError(`Request timeout: ${errorMessage}`, { status, cause: errorData });
          }

          // 4xx is typically non-retryable; 5xx/502/503 are often transient.
          const retryable = status >= 500 || status === 502 || status === 503;
          throw new BadResponseError(`HTTP ${status}: ${errorMessage}`, { status, retryable, cause: errorData });
        }

          const responseText = await response.text();
          lastResponse = responseText;

          try {
            const responseData = JSON.parse(responseText);

          // Check if signal was aborted during the request
          if (effectiveSignal?.aborted) {
            debugLog('Request aborted during fetch:', effectiveSignal.reason);
            return null;
          }

          // Check if the response contains an error
          if (responseData.error) {
            throw new Error(responseData.message || responseData.error);
          }
          
          // Return empty array if no data
          if (!responseData.data) {
            debugWarn('⚠️ No data received from Nightscout server, returning empty array');
            debugLog('⚠️ Full response:', responseData);
            return [];
          }

          // Validate that data is either an array or an object
          if (typeof responseData.data !== 'object') {
            throw new Error(`Invalid response type from proxy: expected object or array, got ${typeof responseData.data}`);
          }

            debugLog(
              `✅ Received data from Nightscout: ${Array.isArray(responseData.data) ? responseData.data.length + ' items' : 'object'}`
            );
            return responseData.data;
          } catch (parseError) {
            const parseErrorMessage = getErrorMessage(parseError);
            debugError('Failed to parse proxy response:', {
              error: parseErrorMessage,
              responsePreview: responseText.substring(0, 200)
            });
            throw new BadResponseError(
              `Failed to parse proxy response: ${parseErrorMessage}`,
              { retryable: true, cause: responseText.substring(0, 200) }
            );
          }
        } catch (error) {
          // Check if signal was aborted during error handling
          if (effectiveSignal?.aborted) {
            debugLog('Request aborted during error handling:', effectiveSignal.reason);
            return null;
          }

          if (error instanceof Error && error.name === 'AbortError') {
            debugLog('Request aborted:', error.message);
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

          // Don't retry on known non-retryable Nightscout/proxy errors.
          if (isNightscoutError(error) && !error.retryable) {
            console.error('Non-retryable Nightscout/proxy error, not retrying:', errorMessage);
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

          debugWarn('Proxy request error:', {
            attempt: attempt + 1,
            error: lastError.message,
            stack: lastError.stack,
            lastResponse: lastResponse?.substring(0, 200),
            nightscoutError: isNightscoutError(error)
              ? { kind: error.kind, status: error.status, retryable: error.retryable }
              : null
          });

          // Don't retry WebContainer network errors
          if (lastError.name === 'WebContainerNetworkError') {
            throw lastError;
          }

          if (attempt === MAX_RETRIES - 1) {
            if (isNightscoutError(error)) throw error;
            throw new Error(`Failed after ${MAX_RETRIES} attempts: ${lastError.message}`);
          }
        }
      }

      throw lastError || new Error('Failed to make request after all retries');
    };

    const waitUnlessAborted = async (promise: Promise<unknown>): Promise<unknown> => {
      if (!signal) return promise;
      if (signal.aborted) return null;

      return await Promise.race<unknown>([
        promise,
        new Promise<unknown>((resolve) => {
          signal.addEventListener('abort', () => resolve(null), { once: true });
        })
      ]);
    };

    if (cacheKey) {
      const shared = nightscoutRequestCache.getOrCreate(cacheKey, () => executeWithRetries(undefined));
      return await waitUnlessAborted(shared);
    }

    return await executeWithRetries(signal);
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    // Preserve typed Nightscout/proxy errors for higher-level formatting.
    if (isNightscoutError(error)) {
      throw error;
    }
    
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
): Promise<NightscoutFetchResult | null> => {
  try {
    const startDate = subDays(new Date(), days).toISOString();
    const endDate = new Date().toISOString();

    debugLog(`📥 Fetching ${days} days of data from ${startDate} to ${endDate}`);

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
    debugLog(`📊 Using count limit: ${countLimit} for ${days} days`);

    const isRecord = (value: unknown): value is Record<string, unknown> => {
      return !!value && typeof value === 'object' && !Array.isArray(value);
    };

    // Use the specified API version - no fallback logic
    let entries: unknown[] | null = null;
    let treatments: unknown[] | null = null;
    let profiles: unknown = null;
    const apiVersion = preferredApiVersion || 'v1'; // Default to v1 if not specified
    let result: NightscoutFetchResult;
    
    if (apiVersion === 'v1') {
      debugLog('🔧 Using API v1 (optimized for cost)...');
      
      // OPTIMIZATION: Use date timestamp instead of dateString for better performance
      // Most Nightscout instances index by date (timestamp) which is more reliable
      const startTimestamp = new Date(startDate).getTime();
      const endTimestamp = new Date(endDate).getTime();
      
        // API v1 entries for long ranges must be paged; otherwise we only get the newest slice.
        // Default 5-min CGM data is ~288 points/day, so 90 days is ~26k points.
        const maxV1PageSize = 10000;
        const optimizedLimit = countLimit;
      
        const safeProxyFetch = async (
          path: string
        ): Promise<unknown[]> => {
          try {
            const res = await makeProxyRequestWithFallback(url, path, token, signal, 'v1');
            return Array.isArray(res) ? res : [];
          } catch (e) {
            debugWarn('⚠️ Non-fatal Nightscout fetch failed:', { path, error: getErrorMessage(e) });
            return [];
          }
        };

        const pagingConfig = {
          startTimestamp,
          endTimestamp,
          startDateIso: startDate,
          endDateIso: endDate,
          entriesTarget: optimizedLimit,
          maxV1EntryPageSize: maxV1PageSize,
          debugLog
        };

        const fetchV1EntriesPaged = () => fetchNightscoutV1EntriesPaged(safeProxyFetch, pagingConfig);
        const fetchV1TreatmentsPaged = () => fetchNightscoutV1TreatmentsPaged(safeProxyFetch, pagingConfig);

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

      const normalizedV1 = normalizeNightscoutV1Data({
        entries,
        treatments,
        deviceStatus
      });

      debugLog(`📋 Entries result: ${Array.isArray(entries) ? entries.length + ' items' : typeof entries}`);
      debugLog(`💊 Treatments result: ${Array.isArray(treatments) ? treatments.length + ' items' : typeof treatments}`);
      debugLog(`👤 Profile result: ${Array.isArray(profiles) ? profiles.length + ' items' : typeof profiles}`);
      debugLog(`📱 Device status result: ${normalizedV1.deviceStatus.length} items`);
      
      debugLog('✅ Successfully fetched data using API v1 (4 optimized requests)');

      const parsedProfiles = parseNightscoutProfiles(profiles);
      
      // Return the detected API version along with the data
      result = {
        entries: normalizedV1.entries,
        treatments: normalizedV1.treatments,
        profile: parsedProfiles,
        deviceStatus: normalizedV1.deviceStatus,
        detectedApiVersion: apiVersion as 'v1' | 'v3'
      };
    } else if (apiVersion === 'v3') {
      debugLog('Using detected API v3...');
      // API v3 uses different query parameter syntax and endpoints
      // Convert ISO date to timestamp for API v3 compatibility
      const startTimestamp = new Date(startDate).getTime();
      const endTimestamp = new Date(endDate).getTime();
      
      // API v3 has a default limit of 1000, which is sufficient for most use cases
      // We'll use larger limits and fewer requests to minimize Edge Function calls
      // The API v3 limit can be up to 1000 per request
      const maxV3Limit = 1000;
      
      debugLog(`📅 API v3 date range: ${startTimestamp} to ${endTimestamp}`);
      debugLog(`📊 Requesting data for ${days} days`);

      // For API v3, we'll make a single optimized request for each data type
      // Using date$gte and date$lte query parameters (API v3 uses $ instead of [] for filters)
      
      type V3ParamStyle = 'filter' | 'dollar';

      const getEntryDate = (entry: unknown): number | null => {
        if (!isRecord(entry)) return null;
        const candidate = entry.date ?? entry.srvCreated ?? entry.mills ?? entry.dateString ?? entry.created_at;
        return toEpochMs(candidate);
      };

      const estimateMaxPagesForDays = (days: number) => {
        // Assume ~288-300 CGM points/day (5 min). Add a small buffer.
        const estimatedPoints = Math.ceil(days * 300 * 1.15);
        return Math.min(50, Math.max(3, Math.ceil(estimatedPoints / maxV3Limit) + 1));
      };

      const fetchV3EntriesPaged = async (style: V3ParamStyle) => {
        const maxPages = estimateMaxPagesForDays(days);

        const pagedFetchV3 = createPagedFetchV3(
          (path) => makeProxyRequestWithFallback(url, path, token, signal, 'v3'),
          {
            cursorField: 'date',
            cursorType: 'number',
            startCursor: startTimestamp,
            endCursor: endTimestamp,
            limit: maxV3Limit,
            maxPages,
            unwrapPage: unwrapNightscoutV3Entries,
            getCursorFromItem: (item) => getEntryDate(item),
            stopWhen: (nextCursor) => typeof nextCursor === 'number' && nextCursor <= startTimestamp,
            dedupeKey: (item) => {
              const record = isRecord(item) ? item : null;
              const id = record?._id ?? record?.id ?? getEntryDate(item);
              return `${id ?? ''}:${record?.type ?? ''}:${record?.sgv ?? ''}`;
            },
            debugLabel: 'API v3 entries',
            debugLog
          }
        );

        return await pagedFetchV3({ endpoint: '/api/v3/entries', filterStyle: style });
      };

      const fetchV3EntriesWithFallbacks = async () => {
        // 1) Try canonical filter syntax first.
        const filtered = await fetchV3EntriesPaged('filter');
        if (filtered.length > 0) return filtered;

        // 2) Sanity check: do we get *any* data unfiltered? If yes, it's likely query-param incompatibility.
        const unfilteredRaw = await makeProxyRequestWithFallback(url, '/api/v3/entries?limit=5&sort=-date', token, signal, 'v3');
        const unfiltered = unwrapNightscoutV3Entries(unfilteredRaw);
        if (unfiltered.length > 0) {
          debugWarn('⚠️ API v3 entries filter returned empty, but unfiltered returned data. Trying alternate param style...');
          const dollar = await fetchV3EntriesPaged('dollar');
          if (dollar.length > 0) return dollar;

          // 3) Last resort: return unfiltered data (at least non-empty) and let downstream logic work.
          return unfiltered;
        }

        // 4) Nothing returned even unfiltered.
        return unfiltered;
      };

      const getV3TreatmentTimeMs = (treatment: unknown): number | null => {
        if (!isRecord(treatment)) return null;
        const candidate = treatment.created_at ?? treatment.srvCreated ?? treatment.timestamp ?? treatment.mills;
        return toEpochMs(candidate);
      };

      const fetchV3TreatmentsPaged = async (style: V3ParamStyle) => {
        const maxPages = 25;

        const pagedFetchV3 = createPagedFetchV3(
          (path) => makeProxyRequestWithFallback(url, path, token, signal, 'v3'),
          {
            cursorField: 'created_at',
            cursorType: 'iso',
            startCursor: startDate,
            endCursor: endDate,
            limit: maxV3Limit,
            maxPages,
            unwrapPage: unwrapNightscoutV3Treatments,
            getCursorFromItem: (item) => {
              const oldestMs = getV3TreatmentTimeMs(item);
              return oldestMs ? new Date(oldestMs).toISOString() : null;
            },
            stopWhen: (nextCursor) => {
              const ms = Date.parse(String(nextCursor ?? ''));
              return Number.isFinite(ms) && ms <= startTimestamp;
            },
            dedupeKey: (item) => {
              const record = isRecord(item) ? item : null;
              const id = record?._id ?? record?.id;
              return id
                ? String(id)
                : `${record?.eventType ?? ''}:${record?.created_at ?? ''}:${record?.timestamp ?? ''}:${record?.enteredBy ?? ''}`;
            },
            encodeDollarStyleValues: true,
            debugLabel: 'API v3 treatments',
            debugLog
          }
        );

        return await pagedFetchV3({ endpoint: '/api/v3/treatments', filterStyle: style });
      };

      const fetchV3TreatmentsWithFallbacks = async () => {
        // 1) Canonical filter syntax first (paged)
        const filtered = await fetchV3TreatmentsPaged('filter');
        if (filtered.length > 0) return filtered;

        // 2) Sanity check: is there data at all?
        const unfilteredRaw = await makeProxyRequestWithFallback(url, '/api/v3/treatments?limit=5&sort=-created_at', token, signal, 'v3');
        const unfiltered = unwrapNightscoutV3Treatments(unfilteredRaw);
        if (unfiltered.length > 0) {
          debugWarn('⚠️ API v3 treatments filter returned empty, but unfiltered returned data. Trying alternate param style...');
          const alt = await fetchV3TreatmentsPaged('dollar');
          if (alt.length > 0) return alt;
          return unfiltered;
        }

        return unfiltered;
      };

      const fetchV3Profile = async () => {
        try {
          return await makeProxyRequestWithFallback(url, '/api/v3/profile/current', token, signal, 'v3');
        } catch (err) {
          if (err instanceof BadResponseError && err.status === 404) {
            return await makeProxyRequestWithFallback(url, '/api/v3/profile', token, signal, 'v3');
          }
          throw err;
        }
      };

      const fetchV3DeviceStatus = async () => {
        try {
          return await makeProxyRequestWithFallback(url, '/api/v3/devicestatus?limit=1&sort$desc=created_at', token, signal, 'v3');
        } catch (err) {
          if (err instanceof BadResponseError && (err.status === 404 || err.status === 400)) {
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
      const deviceStatusRaw = deviceStatusSettled.status === 'fulfilled' ? deviceStatusSettled.value : [];

      const profileArray = normalizeNightscoutV3ProfileArray(profiles);
      const deviceStatusArray = normalizeNightscoutV3DeviceStatusArray(deviceStatusRaw);

      debugLog(`📋 Entries result: ${Array.isArray(entries) ? entries.length + ' items' : typeof entries}`);
      debugLog(`💊 Treatments result: ${Array.isArray(treatments) ? treatments.length + ' items' : typeof treatments}`);
      
      // `fetchV3EntriesWithFallbacks()` already paginates as needed.
      
      debugLog('✅ Successfully fetched data using API v3 with optimized requests');
      
      const normalizedEntries = parseNightscoutEntries(entries);
      const normalizedTreatments = parseNightscoutTreatments(treatments);
      const normalizedDeviceStatus = parseNightscoutDeviceStatus(deviceStatusArray);
      const parsedProfiles = parseNightscoutProfiles(profileArray);

      // Return the detected API version along with the data
      result = {
        entries: normalizedEntries,
        treatments: normalizedTreatments,
        profile: parsedProfiles,
        deviceStatus: normalizedDeviceStatus,
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


    debugLog(`📊 Processed data summary (${apiVersion.toUpperCase()}):`);
    debugLog(`  - Entries: ${result.entries.length}`);
    debugLog(`  - Treatments: ${result.treatments.length}`);
    debugLog(`  - Profiles: ${result.profile.length}`);
    debugLog(`  - Device Status: ${result.deviceStatus.length}`);

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
    debugError('Data fetch failed:', error);
    
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