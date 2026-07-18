export function getApiBase(): string {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost') {
    return 'http://localhost:5001';
  }

  // Always fall back to the desktop's active local IP address for mobile and cloud web access
  return 'http://192.168.1.108:5001';
}
