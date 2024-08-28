export function newBaseUrl(url: string): string {
  const result = new URL(url);
  if (!result.pathname.endsWith('/')) {
    result.pathname += '/';
  }
  return result.href;
}

export function newUrlFromBase(pathname: string, baseUrl: string): string {
  const result = new URL(pathname, baseUrl);
  return result.href;
}
