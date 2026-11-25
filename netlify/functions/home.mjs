import * as L from "../lib/lib.mjs";
const DEFAULT = [{ k: "trust", on: true }, { k: "categories", on: true }, { k: "featured", on: true }, { k: "latest", on: true }, { k: "about", on: true }];
export default async (req, context) => {
  try {
    const [S, cats, Z, latest, featured] = await Promise.all([L.settings(), L.categories(), L.zones(),
      L.rest(`products?select=${L.PCOLS}&active=eq.true&order=created_at.desc&limit=24`),
      L.rest(`products?select=${L.PCOLS}&active=eq.true&featured=eq.true&order=created_at.desc&limit=12`)]);
    const tm = await L.tiersFor([...latest, ...featured].filter((p, i, a) => a.findIndex(x => x.id === p.id) === i));
    const b = L.baseUrl(req, S), name = S.store_name || "المتجر";
    const title = name + (S.tagline ? " | " + S.tagline : "");
    const desc = L.cut(S.seo_description || S.tagline || name, 160);
    const hi = L.safeUrl(S.hero_image_url);
    const cta = /^(\/|https?:\/\/)/.test(S.hero_cta_link || "") && S.hero_cta_text ? `<a class="btn heroBtn" href="${L.esc(S.hero_cta_link)}">${L.esc(S.hero_cta_text)}</a>` : "";
    const hero = `<section class="hero ${hi ? "img" : ""}" ${hi ? `style="background-image:url('${L.esc(hi.replace(/'/g, "%27"))}')"` : ""}><h1>${L.esc(S.hero_title || name)}</h1><p>${L.esc(S.hero_subtitle || "")}</p>${cta}</section>`;
    let layoutCfg = DEFAULT; try { const j = JSON.parse(S.home_layout || ""); if (Array.isArray(j) && j.length) layoutCfg = j } catch (e) {}
    const sec = {
      trust: () => L.trustHtml(S),
      categories: () => cats.length ? `<section><h2 class="sec">تسوق حسب القسم</h2><div class="catgrid">${cats.map(c => `<a class="cc" href="/c/${L.esc(encodeURIComponent(c.slug))}">${L.safeUrl(c.image_url) ? `<img src="${L.esc(c.image_url)}" alt="${L.esc(c.name)}" width="120" height="120" loading="lazy">` : `<span class="ci">${L.esc(c.name.slice(0, 1))}</span>`}<b>${L.esc(c.name)}</b></a>`).join("")}</div></section>` : "",
      featured: () => featured.length ? `<section><h2 class="sec">منتجات مميزة</h2><div class="grid">${L.cardsHtml(featured, tm)}</div></section>` : "",
      latest: () => `<section><h2 class="sec">أحدث المنتجات</h2><div class="grid">${L.cardsHtml(latest, tm)}</div><p style="text-align:center"><a class="btn gray" href="/products">عرض كل المنتجات</a></p></section>`,
      about: () => `<section class="about"><h2>عن ${L.esc(name)}</h2><p>${L.esc(S.seo_description || "")} نوصل لجميع محافظات مصر والدفع عند الاستلام. نبيع جملة وقطاعي، <a href="/wholesale">اطلب عرض سعر جملة</a>.</p></section>`
    };
    const main = `<div id="secs">${layoutCfg.filter(x => x.on && sec[x.k]).map(x => sec[x.k]()).join("")}</div>
<section id="res" hidden><h2 class="sec" id="gt"></h2><div id="grid" class="grid"></div></section>`;
    return L.send(L.layout({
      req, S, cats, zonesList: Z, title, desc, path: "/", currentCat: null,
      ld: [L.orgLd(b, S), { "@context": "https://schema.org", "@type": "WebSite", name, url: b, inLanguage: "ar-EG", potentialAction: { "@type": "SearchAction", target: b + "/?q={search_term_string}", "query-input": "required name=search_term_string" } }],
      body: { hero, main }
    }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/"] };
