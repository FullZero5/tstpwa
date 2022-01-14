'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

Sentry.init({
  environment: "product", // product local
  dsn: "https://10edc1af966e4b51b954dbdb45506e04@o384159.ingest.sentry.io/6150182",
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
  tracesSampleRate: 1.0,
});

const transaction = Sentry.startTransaction({
  op: "resume",
  name: "My app resume",
});

Sentry.configureScope(scope => {
  scope.setSpan(transaction);
});

const STATIC_PATH = path.join(process.cwd(), './static');
const API_PATH = './api/';
const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  html: 'text/html; charset=UTF-8',
  js: 'application/javascript; charset=UTF-8',
  css: 'text/css',
  png: 'image/png',
  ico: 'image/x-icon',
  json: 'application/json',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  txt: 'text/*',
};

const serveFile = name => {
  const filePath = path.join(STATIC_PATH, name);
  if (!filePath.startsWith(STATIC_PATH)) return null;
  return fs.createReadStream(filePath);
};

const api = new Map();

const receiveArgs = async req => new Promise(resolve => {
  const body = [];
  req.on('data', chunk => {
    body.push(chunk);
  }).on('end', async () => {
    const data = body.join('');
    const args = JSON.parse(data);
    resolve(args);
  });
});

const cacheFile = name => {
  const filePath = API_PATH + name;
  const key = path.basename(filePath, '.js');
  try {
    const libPath = require.resolve(filePath);
    delete require.cache[libPath];
  } catch (e) {
    return;
  }
  try {
    const method = require(filePath);
    api.set(key, method);
  } catch (e) {
    api.delete(name);
  }
};

const cacheFolder = path => {
  fs.readdir(path, (err, files) => {
    if (err) return;
    files.forEach(cacheFile);
  });
};

const watch = path => {
  fs.watch(path, (event, file) => {
    cacheFile(file);
  });
};

cacheFolder(API_PATH);
watch(API_PATH);

const httpError = (res, status, message) => {
  res.statusCode = status;
  res.end(`"${message}"`);
};
//TODO refactor function 
const onRequest = async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const [first, second] = url.substring(1).split('/');
  if (first === 'api') {
    const method = api.get(second);
    const args = await receiveArgs(req);
    try {
      const result = await method(...args);
      if (!result) {
        httpError(res, 500, 'Server error');
        Sentry.captureException(result);
        return;
      }
      res.end(JSON.stringify(result));
    } catch (err) {
      console.dir({ err });
      Sentry.captureException(err);
      httpError(res, 500, 'Server error');
    }
    finally {
      transaction.finish();
    }
  } else {
    try {
      const fileExt = path.extname(url).substring(1);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[fileExt] });
      const stream = serveFile(url);
      if (stream) stream.pipe(res);
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
      const stream = serveFile('404.html');
      Sentry.captureMessage("Ошибка 404 запрос", url);
      if (stream) stream.pipe(res);
    }
    finally {
      transaction.finish();
    }
  }
};

http.createServer(onRequest).listen(PORT);
