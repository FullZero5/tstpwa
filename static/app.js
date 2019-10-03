'use strict';

console.log('JavaScript has loaded');

const registerServiceWorker = () => {
  if (!Reflect.has(navigator, 'serviceWorker')) {
    console.log('Service workers are not supported');
    return;
  }
  const { serviceWorker } = navigator;
  serviceWorker.register('/worker.js').then(registration => {
    if (registration.installing) {
      console.log('Service worker installing');
      console.log(registration.installing);
      return;
    }
    if (registration.waiting) {
      console.log('Service worker installed');
      console.log(registration.waiting);
      return;
    }
    if (registration.active) {
      console.log('Service worker active');
      console.log(registration.active);
      return;
    }
  }).catch(error => {
    console.log('Registration failed');
    console.log(error);
  });
};

window.addEventListener('load', () => {
  console.log('The page has loaded');
  registerServiceWorker();
});

window.addEventListener('beforeinstallprompt', event => {
  console.log('Installing PWA');
  console.dir({ beforeinstallprompt: event });
});

window.addEventListener('appinstalled', event => {
  console.log('PWA installed');
  console.dir({ appinstalled: event });
});

// AJAX API Builder

const buildAPI = methods => {
  const api = {};
  for (const method of methods) {
    api[method] = (...args) => new Promise((resolve, reject) => {
      const url = `/api/${method}`;
      console.log(url, args);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      }).then(res => {
        const { status } = res;
        if (status !== 200) {
          reject(new Error(`Status Code: ${status}`));
          return;
        }
        resolve(res.json());
      });
    });
  }
  return api;
};
