const http = require('http');

const baseUrl = 'http://jarvis-test.local';
const username = 'codex-optiimst-test';
const password = 'OptiimstTest-2026!';
const port = 9223;

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

async function getPageWebSocket() {
  let pages = await requestJson('/json');
  let page = pages.find((item) => item.type === 'page');
  if (!page) {
    await requestJson('/json/new');
    pages = await requestJson('/json');
    page = pages.find((item) => item.type === 'page');
  }
  if (!page || !page.webSocketDebuggerUrl) {
    throw new Error('Could not find a Chrome page websocket.');
  }
  return page.webSocketDebuggerUrl;
}

async function main() {
  await waitForChrome();
  const wsUrl = await getPageWebSocket();
  const ws = new WebSocket(wsUrl);
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
    if (message.method === 'Log.entryAdded') {
      const entry = message.params?.entry || {};
      if (['error', 'warning'].includes(entry.level)) {
        errors.push(`log ${entry.level}: ${entry.text || ''}`);
      }
    }
    if (message.method === 'Runtime.consoleAPICalled') {
      if (['error', 'warning'].includes(message.params?.type)) {
        const text = (message.params?.args || []).map((arg) => arg.value || arg.description || '').join(' ');
        errors.push(`console ${message.params.type}: ${text}`);
      }
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
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
  await send('Page.navigate', { url: `${baseUrl}/wp-admin/admin.php?page=optivra-image-studio` });
  for (let i = 0; i < 20; i += 1) {
    const ready = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `!!document.querySelector('.optivra-admin-app') || document.readyState === 'complete'`,
    });
    if (ready.result?.value) {
      break;
    }
    await delay(1000);
  }
  await delay(1000);
  const pageState = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `({
      title: document.title,
      readyState: document.readyState,
      hasOptivra: !!document.querySelector('.optivra-admin-app'),
      bodyClass: document.body ? document.body.className : '',
      bodyTextStart: document.body ? document.body.innerText.slice(0, 160) : ''
    })`,
  });

  ws.close();
  console.log(JSON.stringify({ errors, page: pageState.result?.value || null }));
  if (errors.length > 0 || !pageState.result?.value?.hasOptivra) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
