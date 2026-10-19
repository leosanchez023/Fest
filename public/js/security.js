document.addEventListener('DOMContentLoaded', () => {
  const csrfMeta = document.querySelector('meta[name="csrf-token"]');
  const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : null;

  if (!csrfToken) return;

  const injectHeader = (headers = {}) => ({ ...headers, 'CSRF-Token': csrfToken });

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    this._festRequestMethod = method;
    this._festRequestUrl = url;
    return originalOpen.call(this, method, url, async, user, password);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    if (this._festRequestMethod && !['GET', 'HEAD', 'OPTIONS'].includes(this._festRequestMethod.toUpperCase())) {
      if (body && typeof body === 'string') {
        try {
          const data = JSON.parse(body);
          if (data && typeof data === 'object') {
            data._csrf = csrfToken;
            body = JSON.stringify(data);
          }
        } catch (error) {
          body = `${body}${body && body.length && !body.includes('_csrf=') ? '&' : ''}_csrf=${encodeURIComponent(csrfToken)}`;
        }
      }
      this.setRequestHeader('CSRF-Token', csrfToken);
    }
    return originalSend.call(this, body);
  };

  const originalFetch = window.fetch;
  window.fetch = function(input, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const headers = new Headers(init.headers || {});
      headers.set('CSRF-Token', csrfToken);
      if (init.body && typeof init.body === 'string' && init.body.startsWith('{')) {
        try {
          const parsed = JSON.parse(init.body);
          parsed._csrf = csrfToken;
          init = { ...init, headers, body: JSON.stringify(parsed) };
        } catch (error) {
          const body = new URLSearchParams(init.body);
          body.set('_csrf', csrfToken);
          init = { ...init, headers, body: body.toString() };
        }
      }
      init.headers = headers;
    }
    return originalFetch.call(this, input, init);
  };

  document.querySelectorAll('form').forEach((form) => {
    if (!form.querySelector('input[name="_csrf"]')) {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = '_csrf';
      hidden.value = csrfToken;
      form.appendChild(hidden);
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.method && form.method.toUpperCase() !== 'GET' && form.method.toUpperCase() !== 'HEAD') {
      if (!form.querySelector('input[name="_csrf"]')) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = '_csrf';
        hidden.value = csrfToken;
        form.appendChild(hidden);
      }
    }
  }, true);

  if (window.logoutForm) {
    window.logoutForm = null;
  }
});
