document.querySelector('#access').addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.querySelector('#status');
  status.textContent = 'Checking access…';
  try {
    const response = await fetch('/api/access', {method: 'POST', headers: {'X-ISL-Access-Code': document.querySelector('#code').value}});
    if (!response.ok) throw new Error('The access code was not accepted.');
    const next = new URL(new URLSearchParams(location.search).get('next') || '/official.html', location.origin);
    location.assign(next.origin === location.origin && !next.pathname.startsWith('/access') ? next.href : '/official.html');
  } catch (error) { status.textContent = error.message || 'Unable to connect. Please try again.'; }
});
