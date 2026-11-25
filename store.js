/* Storefront client: pixels, cart, checkout (cash on delivery), home search.
   Talks to Supabase only through the public key: reads public tables and calls the place_order function. */
(function () {
  const S = window.__S || {};
  const $ = i => document.getElementById(i);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const safeUrl = u => (/^https?:\/\//i.test(u || "") ? u : "");
  const waNum = String(S.whatsapp || window.WHATSAPP || "").replace(/\D/g, "");
  const wa = t => "https://wa.me/" + waNum + (t ? "?text=" + encodeURIComponent(t) : "");

  /* ---------- pixels ---------- */
  function inject(code) { const s = document.createElement("script"); s.textContent = code; document.head.appendChild(s) }
  (function pixels() {
    const m = (S.meta_pixel_id || "").trim(), t = (S.tiktok_pixel_id || "").trim(), g = (S.ga_id || "").trim();
    if (/^\d{5,20}$/.test(m)) inject("!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','" + m + "');fbq('track','PageView');");
    if (/^[A-Za-z0-9]{8,30}$/.test(t)) inject("!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement('script');o.type='text/javascript',o.async=!0,o.src=i+'?sdkid='+e+'&lib='+t;var a=document.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};ttq.load('" + t + "');ttq.page()}(window,document,'ttq');");
    if (/^(G|AW)-[A-Za-z0-9-]{4,20}$/.test(g)) { const s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + g; document.head.appendChild(s); inject("window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','" + g + "');") }
  })();
  // ev: AddToCart | InitiateCheckout | Purchase | Lead ; d: {value, items:[{id,name,price,qty}], order_no}
  function track(ev, d) {
    d = d || {}; const items = d.items || [];
    const ids = items.map(i => String(i.id)), cur = "EGP";
    try { if (window.fbq) {
      const p = { value: d.value, currency: cur };
      if (ev !== "Lead") { p.content_ids = ids; p.content_type = "product"; p.contents = items.map(i => ({ id: String(i.id), quantity: i.qty })); p.num_items = items.reduce((a, i) => a + i.qty, 0) }
      else p.content_name = d.name;
      fbq("track", ev, p) } } catch (e) {}
    try { if (window.ttq) {
      const map = { Purchase: "PlaceAnOrder", Lead: "Contact" };
      ttq.track(map[ev] || ev, { value: d.value, currency: cur, contents: items.map(i => ({ content_id: String(i.id), content_name: i.name, quantity: i.qty, price: i.price })), content_type: "product" }) } } catch (e) {}
    try { if (window.gtag) {
      const map = { AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", Purchase: "purchase", Lead: "generate_lead" };
      gtag("event", map[ev], { value: d.value, currency: cur, ...(d.order_no ? { transaction_id: String(d.order_no) } : {}), items: items.map(i => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.qty })) }) } } catch (e) {}
  }
  window.StoreTrack = track;

  /* ---------- cart (prices shown here are for display; the server re-prices everything) ---------- */
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem("cart") || "[]").filter(i => i && i.id && i.qty > 0) } catch (e) {}
  const save = () => { try { localStorage.setItem("cart", JSON.stringify(cart)) } catch (e) {} };
  const unit = (i, q) => { let p = i.price; (i.tiers || []).forEach(t => { if (q >= t[0] && t[1] < p) p = t[1] }); return p };
  const unitOf = i => unit(i, i.qty);
  const sub = () => cart.reduce((a, i) => a + i.qty * unitOf(i), 0);
  const freeMin = () => parseFloat(S.free_shipping_min) || 0;
  const zones = window.__Z || [];
  const zoneFee = g => { const z = zones.find(z => z.governorate === g); return z ? Number(z.fee) : null };
  const shipFor = g => (freeMin() > 0 && sub() >= freeMin() ? 0 : zoneFee(g));
  function add(it, qty) {
    const min = it.min || 1; qty = Math.max(min, Math.min(5000, parseInt(qty) || min));
    const x = cart.find(c => c.id === it.id); if (x) x.qty = Math.min(5000, x.qty + qty); else cart.push({ ...it, qty });
    save(); render(); track("AddToCart", { value: unit(it, qty) * qty, items: [{ id: it.id, name: it.name, price: unit(it, qty), qty }] }); toast("تمت الإضافة للسلة");
  }
  function toast(t) { let e = $("toast"); if (!e) { e = document.createElement("div"); e.id = "toast"; document.body.appendChild(e) } e.textContent = t; e.className = "show"; clearTimeout(toast.t); toast.t = setTimeout(() => (e.className = ""), 1600) }

  /* ---------- UI ---------- */
  document.body.insertAdjacentHTML("beforeend", `<div id="ov" class="ov" hidden></div><aside id="drawer" class="drawer" hidden role="dialog" aria-label="السلة"><div class="dh"><b id="dtitle">سلة المشتريات</b><button class="gray sm" id="dclose">إغلاق</button></div><div id="dbody"></div></aside><div id="bar" class="bar" hidden></div>`);
  const fab = $("fab"); if (fab) fab.href = wa("");
  function open() { $("ov").hidden = false; $("drawer").hidden = false; view("cart") }
  function close() { $("ov").hidden = true; $("drawer").hidden = true }
  $("ov").onclick = close; $("dclose").onclick = close; $("cartBtn").onclick = open;
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-add]"); if (a) { let tiers = []; try { tiers = JSON.parse(a.dataset.tiers || "[]") } catch (x) {} const pq = $("pq"); add({ id: a.dataset.id, name: a.dataset.name, price: Number(a.dataset.price), image: a.dataset.image, slug: a.dataset.slug, min: parseInt(a.dataset.min) || 1, tiers }, pq && a.closest(".pinfo,.stick") ? pq.value : 0); return }
    const w = e.target.closest("[data-wa]"); if (w) track("Lead", { name: w.dataset.name, value: Number(w.dataset.price) });
  });
  function render() {
    const n = cart.reduce((a, i) => a + i.qty, 0); $("cartCount").textContent = n; $("cartCount").style.display = n ? "flex" : "none";
    const bar = $("bar"); bar.hidden = !n || !$("drawer").hidden || !!$("stick"); bar.innerHTML = n ? `<button class="btn" id="barbtn">عرض السلة (${n}) - ${fmt(sub())} جنيه</button>` : "";
    if (n) $("barbtn").onclick = open;
    if (!$("drawer").hidden && $("dtitle").dataset.v === "cart") view("cart");
  }
  function summary(g) {
    const s = sub(), sh = shipFor(g), minZ = zones.length ? Math.min(...zones.map(z => +z.fee)) : 0, maxZ = zones.length ? Math.max(...zones.map(z => +z.fee)) : 0;
    const shTxt = sh === 0 ? "مجاني" : sh == null ? (zones.length ? `${fmt(minZ)}${maxZ !== minZ ? " - " + fmt(maxZ) : ""} جنيه (حسب المحافظة)` : "حسب المحافظة") : fmt(sh) + " جنيه";
    return `<div class="sum"><div><span>المنتجات</span><b>${fmt(s)} جنيه</b></div><div><span>الشحن</span><b>${shTxt}</b></div><div class="tot"><span>الإجمالي (الدفع عند الاستلام)</span><b>${sh == null ? fmt(s) + " + الشحن" : fmt(s + sh) + " جنيه"}</b></div>${freeMin() > 0 && s < freeMin() ? `<small>أضف ${fmt(freeMin() - s)} جنيه للحصول على شحن مجاني</small>` : ""}</div>` }
  function waCart() { return "عايز أطلب:\n" + cart.map(i => `- ${i.name} × ${i.qty} (${fmt(unitOf(i))} جنيه)`).join("\n") + `\nالمنتجات: ${fmt(sub())} جنيه` }
  function nextTier(i) { const t = (i.tiers || []).filter(t => t[0] > i.qty && t[1] < unitOf(i)).sort((a, b) => a[0] - b[0])[0]; return t ? `<small class="tn">اطلب ${t[0]} قطعة بسعر ${fmt(t[1])} للقطعة</small>` : "" }
  function view(v) {
    $("dtitle").dataset.v = v; const b = $("dbody");
    if (v === "cart") {
      $("dtitle").textContent = "سلة المشتريات";
      if (!cart.length) { b.innerHTML = `<div class="empty">السلة فارغة</div>`; $("bar").hidden = true; return }
      b.innerHTML = cart.map((i, k) => `<div class="li">${safeUrl(i.image) ? `<img src="${esc(i.image)}" alt="" width="56" height="56">` : `<div class="ph s"></div>`}<div class="lt"><a href="/p/${esc(encodeURIComponent(i.slug || ""))}">${esc(i.name)}</a><span>${fmt(unitOf(i))} جنيه ${unitOf(i) < i.price ? "(سعر الجملة)" : ""}</span>${nextTier(i)}</div>
        <div class="qty"><button class="sm gray" data-q="${k}" data-d="-1">-</button><input class="qin" data-qi="${k}" type="number" inputmode="numeric" value="${i.qty}" min="${i.min || 1}"><button class="sm gray" data-q="${k}" data-d="1">+</button></div><button class="sm red" data-rm="${k}" aria-label="حذف">x</button></div>`).join("") + summary("") +
        `<button class="btn full" id="tocheck">إتمام الطلب</button><a class="btn full wa2" id="cartwa" target="_blank" rel="noopener" href="${esc(wa(waCart()))}">أو اطلب عبر واتساب</a>`;
      const setQ = (i, q) => { i.qty = Math.max(i.min || 1, Math.min(5000, parseInt(q) || (i.min || 1))); save(); render() };
      b.querySelectorAll("[data-q]").forEach(x => x.onclick = () => { const i = cart[+x.dataset.q]; setQ(i, i.qty + +x.dataset.d) });
      b.querySelectorAll("[data-qi]").forEach(x => x.onchange = () => setQ(cart[+x.dataset.qi], x.value));
      b.querySelectorAll("[data-rm]").forEach(x => x.onclick = () => { cart.splice(+x.dataset.rm, 1); save(); render() });
      $("tocheck").onclick = () => { track("InitiateCheckout", { value: sub(), items: cart.map(i => ({ id: i.id, name: i.name, price: unitOf(i), qty: i.qty })) }); view("form") };
      $("cartwa").onclick = () => track("Lead", { name: "cart", value: sub() });
    } else if (v === "form") {
      $("dtitle").textContent = "بيانات التوصيل";
      b.innerHTML = `<form id="ck" novalidate><label>الاسم</label><input id="cn" autocomplete="name" required maxlength="80">
        <label>رقم الموبايل</label><input id="cp" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" required>
        <label>المحافظة</label><select id="cg" required><option value="">اختر المحافظة</option>${zones.map(z => `<option value="${esc(z.governorate)}">${esc(z.governorate)}</option>`).join("")}</select>
        <label>العنوان بالتفصيل (المنطقة، الشارع، رقم المبنى)</label><textarea id="ca" rows="3" required maxlength="400"></textarea>
        <label>ملاحظات (اختياري)</label><input id="cnote" maxlength="300">
        <input id="web" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px" aria-hidden="true">
        <div id="csum">${summary("")}</div><p class="msg" id="cerr"></p>
        <button class="btn full" id="csub" type="submit">تأكيد الطلب - الدفع عند الاستلام</button><button class="gray full btn" id="cback" type="button">رجوع للسلة</button></form>`;
      try { const g = localStorage.getItem("gov"); if (g && zoneFee(g) != null) { $("cg").value = g; $("csum").innerHTML = summary(g) } } catch (e) {}
      $("cg").onchange = () => { try { localStorage.setItem("gov", $("cg").value) } catch (e) {} $("csum").innerHTML = summary($("cg").value) };
      $("cback").onclick = () => view("cart"); $("ck").onsubmit = submit;
    } else if (v === "done") { $("dtitle").textContent = "تم استلام طلبك" }
  }
  const fail = m => { $("cerr").textContent = m; $("csub").disabled = false; $("csub").textContent = "تأكيد الطلب - الدفع عند الاستلام" };
  async function submit(e) {
    e.preventDefault(); const btn = $("csub"); $("cerr").textContent = "";
    const name = $("cn").value.trim(), phone = $("cp").value.trim(), addr = $("ca").value.trim();
    if (name.length < 2) return fail("اكتب اسمك"); if (!/^(\+?20|0020|0)?1[0125]\d{8}$/.test(phone.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "").replace(/^/, ""))) return fail("رقم الموبايل غير صحيح (مثال 01001234567)");
    if (!$("cg").value) return fail("اختر المحافظة"); if (addr.length < 8) return fail("اكتب العنوان بالتفصيل");
    btn.disabled = true; btn.textContent = "جاري إرسال الطلب...";
    let key = sessionStorage.getItem("ckey"); if (!key) { key = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)); sessionStorage.setItem("ckey", key) }
    const snapshot = cart.map(i => ({ id: i.id, name: i.name, price: unitOf(i), qty: i.qty }));
    try {
      const r = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/place_order", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ p_name: name, p_phone: phone, p_governorate: $("cg").value, p_address: addr, p_notes: $("cnote").value.trim(), p_items: cart.map(i => ({ product_id: i.id, qty: i.qty })), p_key: key, p_website: $("web").value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return fail(j.message && /[\u0600-\u06FF]/.test(j.message) ? j.message : "تعذر إرسال الطلب، حاول مرة أخرى أو اطلب عبر واتساب");
      sessionStorage.removeItem("ckey"); cart = []; save(); render(); view("done");
      $("dbody").innerHTML = `<div class="done"><div class="tick">&#10003;</div><h3>شكراً ${esc(name)}!</h3>${j.order_no ? `<p>رقم طلبك: <b>#${esc(j.order_no)}</b></p>` : ""}<p>الإجمالي: <b>${fmt(j.total)} جنيه</b> (الدفع عند الاستلام)</p><p>سنتواصل معك على ${esc(phone)} لتأكيد الطلب.</p><button class="btn full" id="dok">متابعة التسوق</button></div>`;
      $("dok").onclick = close;
      if (j.order_no !== 0) track("Purchase", { value: Number(j.total), order_no: j.order_no, items: snapshot });
    } catch (err) { fail("تعذر الاتصال، تحقق من الإنترنت أو اطلب عبر واتساب") }
  }

  /* ---------- search: Arabic-tolerant, suggestions with thumbnails ---------- */
  const norm = t => String(t || "").toLowerCase().replace(/[\u064B-\u065F\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\s+/g, " ").trim();
  window.__norm = norm;
  let all = null, loading = null, tiersAll = {};
  async function loadCatalog() {
    if (all) return; if (loading) return loading;
    loading = (async () => {
      const H = { apikey: window.SUPABASE_KEY }; let out = [];
      for (let from = 0; ; from += 1000) {
        const r = await fetch(window.SUPABASE_URL + "/rest/v1/products?select=id,name,slug,price,sale_price,image_url,in_stock,min_order_qty&active=eq.true&order=created_at.desc", { headers: { ...H, Range: from + "-" + (from + 999) } });
        const d = await r.json(); if (!Array.isArray(d)) break; out = out.concat(d); if (d.length < 1000) break }
      try { const r = await fetch(window.SUPABASE_URL + "/rest/v1/product_price_tiers?select=product_id,min_qty,unit_price&order=min_qty.asc", { headers: H }); (await r.json()).forEach(t => (tiersAll[t.product_id] = tiersAll[t.product_id] || []).push([t.min_qty, +t.unit_price])) } catch (e) {}
      out.forEach(p => (p._n = norm(p.name))); all = out })();
    return loading;
  }
  const effPrice = p => (p.sale_price != null && +p.sale_price > 0 && +p.sale_price < +p.price ? +p.sale_price : +p.price);
  const find = t => { const w = norm(t).split(" ").filter(Boolean); return all.filter(p => w.every(x => p._n.includes(x))) };
  const q = $("q"), sug = $("sug");
  if (q) {
    q.addEventListener("focus", () => loadCatalog());
    let tm; q.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(async () => {
      const t = q.value.trim(); if (norm(t).length < 2) { sug.hidden = true; return }
      await loadCatalog(); const l = find(t).slice(0, 6);
      sug.innerHTML = l.map(p => `<a href="/p/${esc(encodeURIComponent(p.slug))}">${safeUrl(p.image_url) ? `<img src="${esc(p.image_url)}" alt="" width="40" height="40">` : `<span class="ph s"></span>`}<span>${esc(p.name)}</span><b>${fmt(effPrice(p))}</b></a>`).join("") + `<a class="all" href="/?q=${encodeURIComponent(t)}">عرض كل النتائج</a>`;
      sug.hidden = !l.length }, 150) });
    document.addEventListener("click", e => { if (!e.target.closest("#sf")) sug.hidden = true });
    // results grid (home page only)
    if ($("res")) {
      const card = p => { const pr = effPrice(p), img = safeUrl(p.image_url), t = tiersAll[String(p.id)] || [], out = p.in_stock === false;
        return `<article class="card"><a href="/p/${esc(encodeURIComponent(p.slug))}" class="imgl">${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" width="400" height="400" loading="lazy">` : `<div class="ph"></div>`}</a><div class="in"><h3><a href="/p/${esc(encodeURIComponent(p.slug))}">${esc(p.name)}</a></h3><div class="pr"><span class="price">${fmt(pr)} جنيه</span>${pr < +p.price ? `<span class="old">${fmt(p.price)}</span>` : ""}</div>${out ? `<button class="btn add" disabled>نفذت الكمية</button>` : `<button class="btn add" data-add data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${pr}" data-image="${esc(img)}" data-slug="${esc(p.slug)}" data-min="${p.min_order_qty || 1}" data-tiers="${esc(JSON.stringify(t))}">أضف للسلة</button>`}</div></article>` };
      const show = async t => { sug.hidden = true; if (!norm(t)) { $("res").hidden = true; $("secs").hidden = false; return }
        await loadCatalog(); const l = find(t); $("secs").hidden = true; $("res").hidden = false; $("gt").textContent = "نتائج البحث عن: " + t + " (" + l.length + ")";
        $("grid").innerHTML = l.slice(0, 60).map(card).join("") || `<div class="empty">لا توجد نتائج. جرب كلمة أخرى أو <a href="/wholesale">اطلب منتج غير موجود</a></div>` };
      $("sf").addEventListener("submit", e => { e.preventDefault(); history.replaceState(null, "", q.value.trim() ? "/?q=" + encodeURIComponent(q.value.trim()) : "/"); show(q.value.trim()) });
      const m = location.search.match(/[?&]q=([^&]+)/); if (m) { q.value = decodeURIComponent(m[1].replace(/\+/g, " ")); show(q.value) }
    }
  }

  /* ---------- wholesale request form ---------- */
  if ($("wf")) $("wf").onsubmit = async e => {
    e.preventDefault(); const err = $("werr"); err.textContent = ""; const btn = $("wsub");
    if ($("wn").value.trim().length < 2) return (err.textContent = "اكتب اسمك");
    if ($("wm").value.trim().length < 5) return (err.textContent = "اكتب المنتجات والكميات المطلوبة");
    btn.disabled = true; btn.textContent = "جاري الإرسال...";
    try {
      const r = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/submit_wholesale", { method: "POST", headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ p_name: $("wn").value.trim(), p_phone: $("wp").value.trim(), p_business: $("wb").value.trim(), p_governorate: $("wg").value, p_message: $("wm").value.trim(), p_website: $("wweb").value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { err.textContent = j.message && /[\u0600-\u06FF]/.test(j.message) ? j.message : "تعذر الإرسال، حاول مرة أخرى"; btn.disabled = false; btn.textContent = "إرسال الطلب"; return }
      track("Lead", { name: "wholesale" }); $("wf").hidden = true; $("wdone").hidden = false;
    } catch (x) { err.textContent = "تعذر الاتصال"; btn.disabled = false; btn.textContent = "إرسال الطلب" }
  };
  render();
})();

// product gallery: click a thumbnail to swap the main image
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#thumbs button"); if (!b) return;
  const m = document.getElementById("gmain"); if (!m) return;
  m.src = b.dataset.src; document.querySelectorAll("#thumbs button").forEach(x => x.classList.toggle("on", x === b));
});

// hero slider: fade, auto-advance, pause on touch/hover/hidden tab, swipe, dots
(function () {
  document.querySelectorAll("[data-hs]").forEach(root => {
    const sl = [...root.querySelectorAll(".hs-slide")], dots = [...root.querySelectorAll(".hs-dots button")];
    if (sl.length < 2) return;
    const hold = Math.max(1000, +root.dataset.ms || 2000), still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0, t = null, paused = false;
    const show = n => { i = (n + sl.length) % sl.length; sl.forEach((s, k) => s.classList.toggle("on", k === i)); dots.forEach((d, k) => d.classList.toggle("on", k === i)) };
    const stop = () => { clearTimeout(t); t = null };
    const loop = () => { stop(); if (paused || still || document.hidden) return; t = setTimeout(() => { show(i + 1); loop() }, hold + 900) };
    dots.forEach((d, k) => d.addEventListener("click", () => { show(k); loop() }));
    let x0 = null, resume = null;
    root.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; paused = true; stop(); clearTimeout(resume) }, { passive: true });
    root.addEventListener("touchend", e => { const dx = (e.changedTouches[0].clientX - x0); if (Math.abs(dx) > 40) show(i + (dx > 0 ? 1 : -1)); x0 = null; resume = setTimeout(() => { paused = false; loop() }, 3000) }, { passive: true });
    root.addEventListener("mouseenter", () => { paused = true; stop() });
    root.addEventListener("mouseleave", () => { paused = false; loop() });
    document.addEventListener("visibilitychange", loop);
    loop();
  });
})();
