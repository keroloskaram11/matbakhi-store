// Shared helpers for the server-rendered pages (Netlify Functions).
// Only PUBLIC data is read, with the public (publishable) key. No private table is touched.
const SUPABASE_URL = (globalThis.process && process.env.SUPABASE_URL) || "https://vezbhmmufmvgquoujylm.supabase.co";
const SUPABASE_KEY = (globalThis.process && process.env.SUPABASE_KEY) || "sb_publishable_I4QL77kVT2kJWz8VfMEAlg_ZwUhvNcj";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const safeUrl = u => (/^https?:\/\//i.test(u || "") ? u : "");
const jsonLd = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const inlineJson = o => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "");
const dec = s => { try { return /%/.test(s) ? decodeURIComponent(s) : s } catch (e) { return s } };

// Reads query params + path params from a standard Request (Netlify Functions v2).
function params(req, ctx) {
  const u = new URL(req.url), p = {};
  u.searchParams.forEach((v, k) => (p[k] = v));
  if (ctx && ctx.params) for (const k of Object.keys(ctx.params)) if (p[k] == null) p[k] = ctx.params[k];
  if (!p.slug) { const m = /^\/[pc]\/([^/?]+)/.exec(u.pathname); if (m) p.slug = m[1] }
  return p;
}
async function rest(path, { count } = {}) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: { apikey: SUPABASE_KEY, ...(count ? { Prefer: "count=exact" } : {}) }
  });
  if (!r.ok) throw new Error("db " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  const m = /\/(\d+)$/.exec(r.headers.get("content-range") || "");
  return count ? { data, total: m ? +m[1] : data.length } : data;
}
async function settings() {
  const rows = await rest("settings?select=key,value");
  const s = {}; rows.forEach(r => (s[r.key] = r.value)); return s;
}
const zones = () => rest("shipping_zones?select=governorate,fee&active=eq.true&order=sort_order.asc");
async function tiersFor(prods) {
  const ids = prods.map(p => String(p.id)); if (!ids.length) return {};
  const rows = await rest("product_price_tiers?select=product_id,min_qty,unit_price,label&order=min_qty.asc&product_id=in.(" + ids.map(i => encodeURIComponent('"' + i + '"')).join(",") + ")");
  const m = {}; rows.forEach(r => (m[r.product_id] = m[r.product_id] || []).push(r)); return m;
}
const categories = () => rest("categories?select=id,name,slug,image_url,description,sort_order&active=eq.true&order=sort_order.asc,name.asc");
const PCOLS = "id,name,slug,description,price,sale_price,image_url,category_id,updated_at,created_at,in_stock,featured,min_order_qty";

function baseUrl(req, S) {
  const u = (S.site_url || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(u)) return u;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") || (/^localhost|127\./.test(host) ? "http" : "https");
  return proto + "://" + host;
}
const pUrl = (b, p) => b + "/p/" + encodeURIComponent(p.slug);
const cUrl = (b, c) => b + "/c/" + encodeURIComponent(c.slug);
const price = p => (p.sale_price != null && +p.sale_price > 0 && +p.sale_price < +p.price ? +p.sale_price : +p.price);
const isSale = p => price(p) < +p.price;

function card(p, first, tiers) {
  const pr = price(p), sale = isSale(p), href = "/p/" + encodeURIComponent(p.slug);
  const img = safeUrl(p.image_url), t = tiers || [], min = p.min_order_qty || 1, out = p.in_stock === false;
  const off = sale ? Math.round((1 - pr / p.price) * 100) : 0;
  const best = t.length ? t[t.length - 1] : null;
  return `<article class="card">${out ? `<span class="badge gr">نفذت الكمية</span>` : sale ? `<span class="badge">خصم ${off}%</span>` : ""}<a href="${esc(href)}" class="imgl">${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" width="400" height="400" ${first ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}>` : `<div class="ph"></div>`}</a>
<div class="in"><h3><a href="${esc(href)}">${esc(p.name)}</a></h3><div class="pr"><span class="price">${fmt(pr)} جنيه</span>${sale ? `<span class="old">${fmt(p.price)}</span>` : ""}</div>
${best ? `<div class="tierhint">جملة: ${fmt(best.unit_price)} جنيه للقطعة عند ${best.min_qty}+</div>` : min > 1 ? `<div class="tierhint">أقل كمية ${min}</div>` : ""}
${out ? `<button class="btn add" disabled>نفذت الكمية</button>` : `<button class="btn add" data-add data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${esc(pr)}" data-image="${esc(img)}" data-slug="${esc(p.slug)}" data-min="${min}" data-tiers="${esc(JSON.stringify(t.map(x => [x.min_qty, +x.unit_price])))}">أضف للسلة</button>`}</div></article>`;
}
const cardsHtml = (list, tm, firstN = 2) => list.map((p, i) => card(p, i < firstN, tm[String(p.id)])).join("");
const trustHtml = S => {
  const items = [["🚚", 2], ["💵", 1], ["🏷️", 3], ["💬", 4]].map(([ic, n]) => [ic, S["trust" + n + "_t"], S["trust" + n + "_d"]]).filter(x => x[1]);
  if (S.return_policy) items.push(["↩️", "سياسة الاسترجاع", L_cut(S.return_policy, 60)]);
  return items.length ? `<section class="trust" aria-label="مميزات المتجر">${items.map(x => `<div><span class="ic">${x[0]}</span><b>${esc(x[1])}</b><small>${esc(x[2] || "")}</small></div>`).join("")}</section>` : "";
};
const L_cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s };

function layout({ req, S, cats, zonesList, title, desc, path, og = {}, ld = [], body, robots, prev, next, currentCat }) {
  const b = baseUrl(req, S), name = S.store_name || "المتجر";
  const canonical = b + path;
  const color = /^#[0-9a-fA-F]{6}$/.test(S.primary_color || "") ? S.primary_color : "#7a3e1d";
  const accent = /^#[0-9a-fA-F]{6}$/.test(S.accent_color || "") ? S.accent_color : "#25a244";
  const logo = safeUrl(S.logo_url), ogImg = safeUrl(og.image) || safeUrl(S.hero_image_url) || logo;
  const publicS = {}; const zs = zonesList || []; ["store_name", "whatsapp", "meta_pixel_id", "tiktok_pixel_id", "ga_id", "shipping_fee", "free_shipping_min", "primary_color", "accent_color"].forEach(k => (publicS[k] = S[k] || ""));
  const chips = (cats || []).length ? `<nav class="cats" aria-label="الأقسام"><a class="chip ${currentCat === "" ? "on" : ""}" href="/products">كل المنتجات</a>${cats.map(c => `<a class="chip ${currentCat === c.slug ? "on" : ""}" href="/c/${esc(encodeURIComponent(c.slug))}">${safeUrl(c.image_url) ? `<img src="${esc(c.image_url)}" alt="" width="22" height="22" loading="lazy">` : ""}${esc(c.name)}</a>`).join("")}</nav>` : "";
  return `<!DOCTYPE html><html lang="ar-EG" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="ar-EG" href="${esc(canonical)}"><link rel="alternate" hreflang="x-default" href="${esc(canonical)}">
${prev ? `<link rel="prev" href="${esc(b + prev)}">` : ""}${next ? `<link rel="next" href="${esc(b + next)}">` : ""}
<meta name="robots" content="${robots || "index,follow,max-image-preview:large"}">
<meta name="geo.region" content="EG"><meta name="geo.placename" content="مصر"><meta name="theme-color" content="${esc(color)}">
<meta property="og:type" content="${esc(og.type || "website")}"><meta property="og:locale" content="ar_EG"><meta property="og:site_name" content="${esc(name)}">
<meta property="og:title" content="${esc(og.title || title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">
${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">` : ""}
<meta name="twitter:card" content="${ogImg ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${esc(og.title || title)}"><meta name="twitter:description" content="${esc(desc)}">
${logo ? `<link rel="icon" href="${esc(logo)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/style.css">
<style>:root{--primary:${color};--accent:${accent}}</style>
${ld.map(jsonLd).join("\n")}
</head><body>
<header class="top"><a class="brand" href="/">${logo ? `<img src="${esc(logo)}" alt="${esc(name)}" width="40" height="40">` : ""}<span class="name">${esc(name)}</span></a><a class="hl" href="/wholesale">طلب جملة</a><button class="cartbtn" id="cartBtn" aria-label="السلة"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6"/></svg><span id="cartCount" class="cnt">0</span></button></header>
${body.afterHeader || ""}
${body.hero || ""}
<main class="wrap"><form class="search" id="sf" action="/" role="search" autocomplete="off"><input id="q" name="q" type="search" placeholder="ابحث عن منتج..." aria-label="بحث" enterkeyhint="search"><div id="sug" class="sug" hidden></div></form>${chips}${body.main}</main>
<footer>${S.footer_text ? `<p>${esc(S.footer_text)}</p>` : `<p>${esc(S.tagline || "")}</p>`}
<p class="fl"><a href="/products">كل المنتجات</a> · <a href="/wholesale">طلب جملة</a>${S.contact_phone ? ` · <a href="tel:${esc(S.contact_phone)}">${esc(S.contact_phone)}</a>` : ""}${S.contact_email ? ` · <a href="mailto:${esc(S.contact_email)}">${esc(S.contact_email)}</a>` : ""}${[["facebook_url", "فيسبوك"], ["instagram_url", "إنستجرام"], ["tiktok_url", "تيك توك"]].filter(x => /^https?:\/\//.test(S[x[0]] || "")).map(x => ` · <a href="${esc(S[x[0]])}" rel="noopener nofollow" target="_blank">${x[1]}</a>`).join("")}</p>
${S.contact_address ? `<p>${esc(S.contact_address)}</p>` : ""}${S.return_policy ? `<details class="rp"><summary>سياسة الاسترجاع</summary><p>${esc(S.return_policy)}</p></details>` : ""}
<p>© ${new Date().getFullYear()} ${esc(name)} - مصر</p></footer>
<a class="fab" id="fab" href="#" target="_blank" rel="noopener" aria-label="واتساب"><svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.3 2.5 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.2 1.3z"/></svg></a>
<script>window.__S=${inlineJson(publicS)};window.SUPABASE_URL=${inlineJson(SUPABASE_URL)};window.SUPABASE_KEY=${inlineJson(SUPABASE_KEY)};window.__Z=${inlineJson(zs)};</script>
<script src="/store.js" defer></script>
</body></html>`;
}

function send(html, cache, type, status) {
  const c = cache || "public, s-maxage=300, stale-while-revalidate=86400";
  // Browser always revalidates; Netlify's CDN keeps the page (so repeat visits do not run the function = save credits).
  return new Response(html, { status: status || 200, headers: { "Content-Type": type || "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": c === "no-store" ? "no-store" : c + ", durable" } });
}
const orgLd = (b, S) => ({
  "@context": "https://schema.org", "@type": "Organization", name: S.store_name || "المتجر", url: b,
  ...(safeUrl(S.logo_url) ? { logo: S.logo_url } : {}),
  areaServed: { "@type": "Country", name: "Egypt" },
  ...(["facebook_url", "instagram_url", "tiktok_url"].map(k => S[k]).filter(u => /^https?:\/\//.test(u || "")).length ? { sameAs: ["facebook_url", "instagram_url", "tiktok_url"].map(k => S[k]).filter(u => /^https?:\/\//.test(u || "")) } : {}),
  ...(S.whatsapp ? { contactPoint: { "@type": "ContactPoint", telephone: "+" + String(S.whatsapp).replace(/\D/g, ""), contactType: "customer service", areaServed: "EG", availableLanguage: "ar" } } : {})
});
const crumbLd = (b, items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it[0], item: b + it[1] })) });
const crumbHtml = items => `<nav class="crumbs" aria-label="مسار التصفح">${items.map((it, i) => i === items.length - 1 ? `<span>${esc(it[0])}</span>` : `<a href="${esc(it[1])}">${esc(it[0])}</a>`).join(" › ")}</nav>`;
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s };
function fail(e) { console.error(e); return send(`<!DOCTYPE html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>خطأ مؤقت</title><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>الموقع يتحدث الآن، حاول بعد دقيقة</h2></body></html>`, "no-store", null, 502) }
function notFound(req, S, cats, what) {
  return send( layout({ req, S, cats, title: "الصفحة غير موجودة | " + (S.store_name || ""), desc: "الصفحة غير موجودة", path: new URL(req.url).pathname, robots: "noindex", body: { main: `<div class="empty"><h1>${esc(what)} غير موجود</h1><p><a class="btn" href="/">الرجوع للرئيسية</a></p></div>` } }), "public, s-maxage=60", null, 404);
}
export { params, zones, tiersFor, cardsHtml, trustHtml, rest, settings, categories, PCOLS, esc, fmt, safeUrl, baseUrl, pUrl, cUrl, price, isSale, card, layout, send, orgLd, crumbLd, crumbHtml, cut, fail, notFound, dec, jsonLd, SUPABASE_URL };
