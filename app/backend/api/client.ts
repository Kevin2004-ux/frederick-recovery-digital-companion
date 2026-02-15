// app/frontend/src/api/client.ts

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// Looks for VITE_API_URL in .env, defaults to localhost:4000
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      errorData = { message: res.statusText };
    }
    // Throw our custom error so the UI catches it
    throw new ApiError(res.status, errorData.message || "Something went wrong", errorData);
  }

  // Handle 204 No Content (empty success response)
  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

// Export the 'api' object that your pages are looking for
export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  
  post: <T>(endpoint: string, body: any) => 
    request<T>(endpoint, { method: "POST", body: JSON.stringify(body) }),
    
  put: <T>(endpoint: string, body: any) => 
    request<T>(endpoint, { method: "PUT", body: JSON.stringify(body) }),
    
  delete: <T>(endpoint: string) => 
    request<T>(endpoint, { method: "DELETE" }),
};