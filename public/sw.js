// Remove only this worker's obsolete app cache; preserve unrelated cache namespaces.
self.addEventListener("activate", event => event.waitUntil(caches.delete("rentfray-pwa-v1")));
// Network-only documents. Never cache customer data or queue offline writes.
// Default lifecycle: no skipWaiting, claim, forced reload, or background sync.
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET"||event.request.mode!=="navigate")return;
 event.respondWith(fetch(event.request,{cache:"no-store"}).catch(()=>new Response(
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RentFray is offline</title></head><body><main><h1>You are offline</h1><p>Reconnect to view current information and your dashboard. Changes and payments cannot be submitted offline.</p><p><a href="/">Try RentFray again</a></p></main></body></html>',
  {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow","Content-Security-Policy":"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'","Referrer-Policy":"no-referrer"}}
 )));
});
