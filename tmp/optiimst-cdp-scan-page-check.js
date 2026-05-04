const http = require('http');

const baseUrl = 'http://jarvis-test.local';
const username = 'codex-optiimst-test';
const password = 'OptiimstTest-2026!';
const port = 9224;

function requestJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForChrome() {
  for (let i = 0; i < 40; i += 1) {
    try {
      await requestJson('/json/version');
      return;
    } catch (error) {
      await delay(250);
    }
  }
  throw new Error('Chrome remote debugging endpoint did not become available.');
}

async function main() {
  await waitForChrome();
  let pages = await requestJson('/json');
  if (!pages.find((item) => item.type === 'page')) {
    await requestJson('/json/new');
    pages = await requestJson('/json');
  }
  const page = pages.find((item) => item.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let id = 0;

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const callbacks = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        callbacks.reject(new Error(message.error.message || 'CDP command failed'));
      } else {
        callbacks.resolve(message.result || {});
      }
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(`exception: ${message.params?.exceptionDetails?.text || 'runtime exception'}`);
    }
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) {
      const text = (message.params?.args || []).map((arg) => arg.value || arg.description || '').join(' ');
      errors.push(`console ${message.params.type}: ${text}`);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: `${baseUrl}/wp-login.php` });
  await delay(1500);
  await send('Runtime.evaluate', {
    expression: `
      document.querySelector('#user_login').value = ${JSON.stringify(username)};
      document.querySelector('#user_pass').value = ${JSON.stringify(password)};
      document.querySelector('#wp-submit').click();
    `,
  });
  await delay(2500);
  await send('Page.navigate', { url: `${baseUrl}/wp-admin/admin.php?page=optivra-image-studio-scan#optivra-scan-results` });
  await delay(5000);

  const state = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const root = document.querySelector('[data-optivra-scan-results]');
      const tpl = root ? root.querySelector('[data-optiimst-scan-products-json], [data-optivra-scan-products-json]') : null;
      const text = tpl ? ((tpl.content && tpl.content.textContent) || tpl.textContent || tpl.getAttribute('data-products') || '') : '';
      let parsed = null;
      let parseError = '';
      try { parsed = tpl ? JSON.parse(text || '[]') : null; } catch (e) { parseError = String(e && e.message || e); }
      return {
        title: document.title,
        hasRoot: !!root,
        templateTextLength: text.length,
        templateStart: text.slice(0, 80),
        parsedIsArray: Array.isArray(parsed),
        parsedCount: Array.isArray(parsed) ? parsed.length : null,
        rowCount: document.querySelectorAll('[data-optivra-product-row]').length,
        bodyHtmlLength: (() => { const body = document.querySelector('[data-optivra-results-body]'); return body ? body.innerHTML.length : 0; })(),
        showingText: (() => { const n = document.querySelector('[data-optivra-results-showing]'); return n ? n.textContent : ''; })(),
        emptyHidden: (() => { const n = document.querySelector('[data-optivra-results-empty]'); return n ? n.hidden : null; })(),
        parseError,
        bodyText: document.body ? document.body.innerText.slice(0, 500) : ''
      };
    })()`,
  });

  ws.close();
  console.log(JSON.stringify({ errors, state: state.result?.value || null }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
