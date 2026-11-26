import * as L from "../netlify/lib/lib.mjs";
import home from "../netlify/functions/home.mjs";
import category from "../netlify/functions/category.mjs";
import product from "../netlify/functions/product.mjs";
import wholesale from "../netlify/functions/wholesale.mjs";
import legal from "../netlify/functions/legal.mjs";
import landing from "../netlify/functions/landing.mjs";
import track from "../netlify/functions/track.mjs";
import sitemap from "../netlify/functions/sitemap.mjs";
import robots from "../netlify/functions/robots.mjs";
import llms from "../netlify/functions/llms.mjs";
import feed from "../netlify/functions/feed.mjs";

export const onRequest = async (c) => {
  const u0 = new URL(c.request.url);
  const cacheable = c.request.method === "GET" && !u0.search && /^\/($|products$|c\/|p\/|wholesale$|track$|legal\/|lp\/)/.test(u0.pathname);
  if (!cacheable) return handle(c);
  const ck = new Request(u0.origin + u0.pathname, { method: "GET" });
  const getCv = async () => { try { const r = await L.rest("settings?select=value&key=eq.cache_v"); return (r && r[0] && r[0].value) || "0" } catch (e) { return null } };
  const tag = (r, s) => { const o = new Response(r.body, r); o.headers.set("Cache-Control", "public, max-age=0, must-revalidate"); o.headers.set("X-Cache", s); return o };
  const hit = await caches.default.match(ck);
  if (hit) {
    const age = Date.now() - Number(hit.headers.get("X-Cts") || 0);
    if (age < 15000) return tag(hit, "HIT");
    const cv = await getCv();
    if (cv !== null && cv === hit.headers.get("X-Cv") && age < 900000) {
      const re = new Response(hit.clone().body, hit); re.headers.set("X-Cts", String(Date.now())); c.waitUntil(caches.default.put(ck, re));
      return tag(hit, "HIT-REVALIDATED");
    }
  }
  const cv0 = await getCv();
  const res = await handle(c);
  if (cv0 !== null && res.status === 200 && (res.headers.get("content-type") || "").includes("text/html")) {
    const st = new Response(res.clone().body, res);
    st.headers.set("Cache-Control", "public, max-age=900"); st.headers.set("X-Cv", cv0); st.headers.set("X-Cts", String(Date.now())); st.headers.delete("netlify-cdn-cache-control");
    c.waitUntil(caches.default.put(ck, st));
    return tag(res, "MISS");
  }
  return res;
};

const handle = async (c) => {
  const p = new URL(c.request.url).pathname.replace(/\/+$/, "") || "/";
  if (p === "/google9e1317c29e841629.html") return new Response("google-site-verification: google9e1317c29e841629.html", { headers: { "content-type": "text/html; charset=utf-8" } });
  if (!/^\/(sitemap\.xml|robots\.txt|llms\.txt|feed\/|api\/)/.test(p)) { try { const S = await L.settings(); if (S.maintenance_on === "1") { const wa = String(S.whatsapp || "").replace(/\D/g, ""), msg = String(S.maintenance_msg || "المتجر في صيانة قصيرة ونرجع لك قريباً. شكراً لصبرك.").slice(0, 400), nm = String(S.store_name || "المتجر"); return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${L.esc(nm)}</title><style>body{font-family:system-ui,sans-serif;background:#f8f4ef;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center;color:#333}div{max-width:460px;padding:24px}a{display:inline-block;margin-top:14px;background:#25d366;color:#fff;padding:10px 22px;border-radius:22px;text-decoration:none}</style></head><body><div><h1>${L.esc(nm)}</h1><p>${L.esc(msg)}</p>${wa ? `<a href="https://wa.me/${wa}">كلمنا على واتساب</a>` : ""}</div></body></html>`, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "Retry-After": "600", "Cache-Control": "no-store" } }) } } catch (e) {} }
  let h = null;
  if (p === "/") h = home;
  else if (p === "/products" || p.startsWith("/c/")) h = category;
  else if (p.startsWith("/p/")) h = product;
  else if (p === "/wholesale") h = wholesale;
  else if (p === "/track") h = track;
  else if (p.startsWith("/legal/")) h = legal;
  else if (p.startsWith("/lp/")) h = landing;
  else if (p === "/sitemap.xml") h = sitemap;
  else if (p === "/robots.txt") h = robots;
  else if (p === "/llms.txt") h = llms;
  else if (p === "/feed/google.xml" || p === "/feed/meta.csv") h = feed;
  if (!h) return c.next();
  const r = await h(c.request, c);
  const n = new Response(r.body, r);
  n.headers.set("X-Content-Type-Options", "nosniff");
  n.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  n.headers.set("X-Frame-Options", "SAMEORIGIN");
  n.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  n.headers.set("Strict-Transport-Security", "max-age=31536000");
  return n;
};
