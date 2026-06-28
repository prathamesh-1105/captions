export function getApiBase(): string {
  // 1. Check if user configured a custom backend url (e.g., on mobile)
  const saved = localStorage.getItem('backend_url');
  if (saved) return saved;

  // 2. Check if a build-time env variable is defined
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  const hostname = window.location.hostname;

  // 3. Local dev server
  if (hostname === 'localhost') {
    return 'http://localhost:5001';
  }

  // 4. Dynamic IP resolution: If accessing the site on a local IP (e.g., 192.168.x.x),
  // automatically route requests to the same local IP on port 5001
  const isLocalIp = /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname);
  if (isLocalIp) {
    return `http://${hostname}:5001`;
  }

  // 5. Cloud deployment fallback: use relative paths so they resolve to the same hosted domain
  return '';
}
