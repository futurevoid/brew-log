// Offline support: the site's own files are fetched fresh when online and served from cache when
// not; the 9 MB OpenCV.js file is versioned, so it is cached once and served from cache after that.
var CACHE="brewlog-v1";
var CV_URL="https://docs.opencv.org/4.10.0/opencv.js";
var SHELL=["./","index.html","grind.html","style.css","script.js","grind.js","grind-worker.js","grind-analyze.js","grind-translate.js","grinders.js","micron.js"];

self.addEventListener("install",function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL).catch(function(){})}).then(function(){return self.skipWaiting()}));
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==CACHE}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}));
});
self.addEventListener("fetch",function(e){
  var req=e.request;if(req.method!=="GET")return;
  var url=new URL(req.url);
  if(req.url===CV_URL){
    e.respondWith(caches.open(CACHE).then(function(c){return c.match(req).then(function(hit){
      return hit||fetch(req).then(function(r){if(r.ok||r.type==="opaque")c.put(req,r.clone());return r});
    })}));
    return;
  }
  if(url.origin!==self.location.origin)return;
  e.respondWith(fetch(req).then(function(r){
    if(r.ok){var copy=r.clone();caches.open(CACHE).then(function(c){c.put(req,copy)})}
    return r;
  }).catch(function(){return caches.match(req,{ignoreSearch:true})}));
});
