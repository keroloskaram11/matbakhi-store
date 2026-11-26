import * as L from "../lib/lib.mjs";
// Landing pages built in the dashboard. Rows live in landing_pages (public only when published).
const link = u => { u = String(u || "").trim(); return /^\/[^\/\\]/.test(u) || /^https?:\/\//i.test(u) ? u : "" };
const para = t => String(t || "").split(/\n{2,}/).map(x => x.trim()).filter(Boolean).map(x => `<p>${L.esc(x).replace(/\n/g, "<br>")}</p>`).join("");
export default async (req, context) => {
  try {
    const [S, cats] = await Promise.all([L.settings(), L.categories()]);
    const slug = decodeURIComponent(new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop() || "");
    if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) return L.notFound(req, S, cats, "الصفحة");
    const rows = await L.rest(`landing_pages?select=title,seo_desc,blocks&slug=eq.${slug}&published=eq.true&limit=1`);
    const pg = rows && rows[0];
    if (!pg || !Array.isArray(pg.blocks)) return L.notFound(req, S, cats, "الصفحة");
    const ids = [...new Set(pg.blocks.filter(b => b && b.t === "products").flatMap(b => Array.isArray(b.ids) ? b.ids : []).filter(i => /^[0-9a-f-]{36}$/i.test(i)))].slice(0, 60);
    let prods = [];
    if (ids.length) prods = await L.rest(`products?select=${L.PCOLS}&listed=eq.true&id=in.(${ids.join(",")})`);
    const tm = prods.length ? await L.tiersFor(prods) : {};
    const out = pg.blocks.slice(0, 40).map(b => {
      if (!b) return "";
      const e = L.esc;
      if (b.t === "hero") { const im = L.safeUrl(b.image), ln = link(b.link);
        return `<section class="box" style="text-align:center;padding:36px 18px;${im ? `background:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url('${e(im)}') center/cover;color:#fff;` : ""}"><h1 style="margin:0 0 10px">${e(b.title)}</h1>${b.sub ? `<p style="font-size:1.1em">${e(b.sub)}</p>` : ""}${ln && b.btn ? `<a class="btn" href="${e(ln)}">${e(b.btn)}</a>` : ""}</section>` }
      if (b.t === "text") return `<section class="box legal">${b.title ? `<h2>${e(b.title)}</h2>` : ""}${para(b.body)}</section>`;
      if (b.t === "products") { const list = (b.ids || []).map(i => prods.find(p => String(p.id) === String(i))).filter(Boolean);
        return list.length ? `<section>${b.title ? `<h2 class="sec">${e(b.title)}</h2>` : ""}<div class="grid">${L.cardsHtml(list, tm)}</div></section>` : "" }
      if (b.t === "cta") { const ln = link(b.link);
        return `<section class="box" style="text-align:center;padding:24px"><h2>${e(b.title)}</h2>${ln && b.btn ? `<a class="btn" href="${e(ln)}">${e(b.btn)}</a>` : ""}</section>` }
      return "" }).join("\n");
    const name = S.store_name || "المتجر";
    const main = `${L.crumbHtml([["الرئيسية", "/"], [pg.title, "/lp/" + slug]])}${out}`;
    return L.send(L.layout({ req, S, cats, title: `${pg.title} | ${name}`, desc: L.cut(pg.seo_desc || pg.title, 160), path: "/lp/" + slug, body: { main } }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/lp/*"] };
