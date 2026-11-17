'use strict';

// Naikkan angka versi ini setiap kali kamu mengubah file aplikasi.
const VERSI = 'keuangan-v1';
const FILE_INTI = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSI).then(c => c.addAll(FILE_INTI)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(daftar => Promise.all(daftar.filter(k => k !== VERSI).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Jaringan dulu supaya versi terbaru selalu tampil; cache hanya sebagai cadangan saat offline.
// Permintaan ke server Apps Script (beda alamat) tidak pernah disentuh atau disimpan.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const ambil = req.mode === 'navigate' ? fetch(req) : fetch(req.url, { cache: 'no-cache' });
  e.respondWith(
    ambil
      .then(res => {
        if (res && res.ok && res.type === 'basic') {
          const salinan = res.clone();
          caches.open(VERSI).then(c => c.put(req, salinan));
        }
        return res;
      })
      .catch(async () =>
        (await caches.match(req)) ||
        (req.mode === 'navigate' && (await caches.match('./index.html'))) ||
        Response.error()
      )
  );
});
