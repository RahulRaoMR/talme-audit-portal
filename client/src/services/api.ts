const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const tokenStorageKey = "talme_auth_token";

type RequestOptions = RequestInit & {
  token?: string | null;
};

export function getStoredToken() {
  return localStorage.getItem(tokenStorageKey);
}

export function setStoredToken(token: string) {
  localStorage.setItem(tokenStorageKey, token);
}

export function clearStoredToken() {
  localStorage.removeItem(tokenStorageKey);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.token ?? getStoredToken();
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const payload = (await response.json().catch(() => null)) as { message?: string } | T | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const token = getStoredToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Download failed");
  }

  return response.blob();
}
