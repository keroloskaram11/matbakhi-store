/* Storefront marketing apps: Social Proof (real recent orders) and Cross Selling (cart suggestions). Controlled from the dashboard section "أدوات التسويق". */
(function () {
  const U = window.SUPABASE_URL, K = window.SUPABASE_KEY; if (!U || !K) return;
  const H = { apikey: K, "Content-Type": "application/json" };
  const fmt = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  fetch(U + "/rest/v1/settings?select=key,value&key=like.mkt_*", { headers: H }).then(r => r.json()).then(rows => {
    const M = {}; (rows || []).forEach(r => (M[r.key] = r.value));
    if (M.mkt_proof_on === "1") proof(M);
    if (M.mkt_cross_on === "1") cross(M);
  }).catch(() => {});
  function ago(t) { const m = Math.max(1, Math.round((Date.now() - new Date(t).getTime()) / 60000)); if (m < 60) return "من " + m + " دقيقة"; const h = Math.round(m / 60); if (h < 24) return "من " + h + " ساعة"; return "من " + Math.round(h / 24) + " يوم" }
  async function proof(M) {
    if (/^\/admin/.test(location.pathname)) return;
    let list = []; try { const r = await fetch(U + "/rest/v1/rpc/recent_sales", { method: "POST", headers: H, body: JSON.stringify({ p_days: parseInt(M.mkt_proof_days) || 7, p_limit: 20 }) }); list = await r.json() } catch (e) {}
    if (!Array.isArray(list) || list.length < 3) return;
    const secs = Math.max(8, Math.min(120, parseInt(M.mkt_proof_secs) || 20)), names = M.mkt_proof_names !== "0";
    const box = document.createElement("div"); box.id = "sproof"; box.setAttribute("dir", "rtl");
    box.style.cssText = "position:fixed;left:12px;bottom:84px;z-index:9;max-width:270px;background:#fff;border:1px solid #e6dccf;border-radius:12px;box-shadow:0 6px 22px #0002;padding:10px 12px;font-size:13px;line-height:1.6;color:#2b2118;opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s;pointer-events:none";
    document.body.appendChild(box);
    let i = 0, shown = 0; const max = 6;
    const tick = () => {
      if (shown >= max || document.hidden) { if (shown < max) setTimeout(tick, secs * 1000); return }
      const o = list[i++ % list.length]; const nm = names && o.name ? o.name : "عميل";
      const p = String(o.product || "").slice(0, 46) + (String(o.product || "").length > 46 ? "..." : "");
      box.textContent = nm + (o.gov ? " من " + o.gov : "") + " طلب " + p + " " + ago(o.at);
      box.style.opacity = "1"; box.style.transform = "none"; shown++;
      setTimeout(() => { box.style.opacity = "0"; box.style.transform = "translateY(8px)" }, 6000);
      setTimeout(tick, secs * 1000);
    };
    setTimeout(tick, 8000);
  }
  function cross(M) {
    const n = Math.max(2, Math.min(6, parseInt(M.mkt_cross_n) || 3)); let busy = false;
    const run = async () => {
      const b = document.getElementById("dbody"), t = document.getElementById("dtitle"); if (!b || !t || t.dataset.v !== "cart" || busy || b.querySelector("#xsell")) return;
      let cart = []; try { cart = JSON.parse(localStorage.getItem("cart") || "[]") } catch (e) {} if (!cart.length) return;
      busy = true;
      try {
        const ids = cart.map(c => c.id).filter(Boolean);
        const pr = await (await fetch(U + "/rest/v1/products?select=category_id&id=in.(" + ids.map(encodeURIComponent).join(",") + ")", { headers: H })).json();
        const cats = [...new Set((pr || []).map(p => p.category_id).filter(Boolean))]; if (!cats.length) return;
        const rows = await (await fetch(U + "/rest/v1/products?select=id,name,slug,price,sale_price,image_url,min_order_qty&listed=eq.true&in_stock=eq.true&category_id=in.(" + cats.join(",") + ")&id=not.in.(" + ids.join(",") + ")&order=created_at.desc&limit=" + n, { headers: H })).json();
        if (!Array.isArray(rows) || !rows.length || b.querySelector("#xsell")) return;
        const box = document.createElement("div"); box.id = "xsell"; box.style.cssText = "margin:14px 0;padding:10px;border:1px solid #ead9c6;border-radius:12px;background:#faf5ee";
        const h = document.createElement("b"); h.textContent = "مكمّل طلبك"; h.style.display = "block"; h.style.marginBottom = "8px"; box.appendChild(h);
        rows.forEach(p => {
          const pr2 = Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price) ? Number(p.sale_price) : Number(p.price);
          const row = document.createElement("div"); row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px";
          if (/^https?:\/\//.test(p.image_url || "")) { const im = document.createElement("img"); im.src = p.image_url; im.width = 44; im.height = 44; im.alt = ""; im.style.cssText = "border-radius:8px;object-fit:cover"; row.appendChild(im) }
          const tx = document.createElement("div"); tx.style.cssText = "flex:1;font-size:12.5px;line-height:1.5"; const nm = document.createElement("div"); nm.textContent = String(p.name).slice(0, 60); const pc = document.createElement("b"); pc.textContent = fmt(pr2) + " جنيه"; tx.appendChild(nm); tx.appendChild(pc); row.appendChild(tx);
          const bt = document.createElement("button"); bt.type = "button"; bt.className = "btn sm"; bt.textContent = "أضف"; bt.setAttribute("data-add", ""); bt.dataset.id = p.id; bt.dataset.name = p.name; bt.dataset.price = pr2; bt.dataset.image = p.image_url || ""; bt.dataset.slug = p.slug; bt.dataset.min = p.min_order_qty || 1; bt.dataset.tiers = "[]"; row.appendChild(bt); box.appendChild(row);
        });
        const tc = b.querySelector("#tocheck"); if (tc) b.insertBefore(box, tc); else b.appendChild(box);
      } catch (e) {} finally { busy = false }
    };
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true }); run();
  }
})();
