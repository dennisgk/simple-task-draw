const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export { fetchJson };
