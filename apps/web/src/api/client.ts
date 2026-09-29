export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

export class ApiException extends Error {
  public code: string;
  public status: number;
  public requestId?: string;
  public details?: unknown;

  constructor(status: number, errorData: ApiError) {
    super(errorData.message || 'API request failed');
    this.name = 'ApiException';
    this.status = status;
    this.code = errorData.code || 'UNKNOWN_ERROR';
    this.requestId = errorData.requestId;
    this.details = errorData.details;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    'Accept': 'application/json',
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('dogfood_session_token') : null;
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && options.body) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include HttpOnly session cookies
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    },
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let errorData: ApiError = {
      code: `HTTP_${response.status}`,
      message: response.statusText,
    };

    if (contentType.includes('application/json')) {
      try {
        const json = await response.json();
        if (json.error) {
          errorData = json.error;
        }
      } catch {
        // Fallback to status text
      }
    } else {
      const text = await response.text();
      if (text) {
        errorData.message = text;
      }
    }

    throw new ApiException(response.status, errorData);
  }

  if (contentType.includes('text/csv')) {
    return (await response.text()) as unknown as T;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return await response.json();
}

export const apiClient = {
  get: <T = any>(endpoint: string, options: RequestInit = {}) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options: RequestInit = {}) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T = any>(endpoint: string, body?: any, options: RequestInit = {}) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T = any>(endpoint: string, body?: any, options: RequestInit = {}) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = any>(endpoint: string, options: RequestInit = {}) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

