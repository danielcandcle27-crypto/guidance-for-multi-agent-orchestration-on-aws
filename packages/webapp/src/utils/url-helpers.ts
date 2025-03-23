export function normalizeUrl(url: string): string {
  if (!url) {
    return '';
  }
  
  // Remove any duplicate 'https://' occurrences
  let normalizedUrl = url.replace(/https:\/\/(https:\/\/)?/, 'https://');
  
  // Ensure no trailing slash that might cause issues
  normalizedUrl = normalizedUrl.replace(/\/+$/, '');
  
  return normalizedUrl;
}