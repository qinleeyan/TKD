export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

export function getAuthToken() {
  return typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers);
  const token = getAuthToken();

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Token ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Handle logout or redirect to login
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
    }
  }

  return response;
}
