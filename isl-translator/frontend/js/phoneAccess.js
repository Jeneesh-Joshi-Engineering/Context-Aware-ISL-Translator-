export function phoneOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost'
      || url.hostname.endsWith('.localhost') || url.hostname === '[::1]' || /^127\./.test(url.hostname)) {
    throw new Error('Enter a trusted HTTPS address reachable from the phone, not localhost.');
  }
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Enter only the HTTPS base address, without a page, query or fragment.');
  return url.origin;
}
export function counterLink(counterId, pageUrl, sharedOrigin = '') {
  const page = new URL(pageUrl);
  const base = sharedOrigin ? phoneOrigin(sharedOrigin) : page.origin;
  const url = new URL('/index.html', base); url.searchParams.set('counter', counterId);
  let phoneReady = false;
  try { phoneOrigin(base); phoneReady = true; } catch { /* A local desktop link is still useful. */ }
  return { url: url.href, phoneReady };
}
