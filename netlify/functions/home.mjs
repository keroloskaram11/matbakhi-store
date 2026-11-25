import * as L from "../lib/lib.mjs";
const DEFAULT = [{ k: "intro", on: true }, { k: "reviews", on: true }, { k: "catsecs", on: true }, { k: "trust", on: true }, { k: "categories", on: true }, { k: "featured", on: true }, { k: "latest", on: true }, { k: "about", on: true }];
export default async (req, context) => {
  try {
    const [S, cats, Z, latest, featured] = await Promise.all([L.settings(), L.categories(), L.zones(),
      L.rest(`products?select=${L.PCOLS}&active=eq.true&order=created_at.desc&limit=24`),
      L.rest(`products?select=${L.PCOLS}&active=eq.true&featured=eq.true&order=created_at.desc&limit=12`)]);
    const tm = await L.tiersFor([...latest, ...featured].filter((p, i, a) => a.findIndex(x => x.id === p.id) === i));
    const homeCats = cats.filter(c => c.show_home !== false);
    const b = L.baseUrl(req, S), name = S.store_name || "المتجر";
    const title = name + (S.tagline ? " | " + S.tagline : "");
    const desc = L.cut(S.seo_description || S.tagline || name, 160);
    const hi = L.safeUrl(S.hero_image_url);
    const cta = /^(\/|https?:\/\/)/.test(S.hero_cta_link || "") && S.hero_cta_text ? `<a class="btn heroBtn" href="${L.esc(S.hero_cta_link)}">${L.esc(S.hero_cta_text)}</a>` : "";
    const slider = L.heroSliderHtml(S, name);
    const hero = slider || `<section class="hero ${hi ? "img" : ""}" ${hi ? `style="background-image:url('${L.esc(hi.replace(/'/g, "%27"))}')"` : ""}><h1>${L.esc(S.hero_title || name)}</h1><p>${L.esc(S.hero_subtitle || "")}</p>${cta}</section>`;
    let layoutCfg = DEFAULT; try { const j = JSON.parse(S.home_layout || ""); if (Array.isArray(j) && j.length) layoutCfg = j } catch (e) {}
    ["catsecs", "reviews", "intro"].forEach(k => { if (!layoutCfg.some(x => x.k === k)) layoutCfg = [{ k, on: true }, ...layoutCfg] });
    if (!layoutCfg.some(x => x.k === "track")) { const ti = layoutCfg.findIndex(x => x.k === "trust"); layoutCfg = [...layoutCfg.slice(0, ti >= 0 ? ti + 1 : 1), { k: "track", on: true }, ...layoutCfg.slice(ti >= 0 ? ti + 1 : 1)]; }
    let cs = []; try { cs = JSON.parse(S.home_cat_sections || "[]") } catch (e) {}
    cs = (Array.isArray(cs) ? cs : []).filter(x => x && x.on !== false).map(x => ({ c: cats.find(c => c.slug === x.slug), n: Math.min(12, Math.max(2, Number(x.n) || 8)) })).filter(x => x.c).slice(0, 10);
    const csData = await Promise.all(cs.map(x => L.rest(`products?select=${L.PCOLS}&active=eq.true&category_id=eq.${encodeURIComponent(x.c.id)}&order=created_at.desc&limit=${x.n}`).catch(() => [])));
    const csTm = await L.tiersFor(csData.flat().filter((p, i, a) => a.findIndex(y => y.id === p.id) === i));
    const sec = {
      intro: () => L.introHtml(S),
      reviews: () => L.reviewsHtml(S),
      catsecs: () => cs.map((x, i) => csData[i].length ? `<section class="csec"><div class="csec-h"><h2 class="sec">${L.esc(x.c.name)}</h2><a class="csec-m" href="/c/${L.esc(encodeURIComponent(x.c.slug))}">عرض الكل</a></div><div class="grid">${L.cardsHtml(csData[i], csTm)}</div></section>` : "").join(""),
      trust: () => L.trustHtml(S),
      track: () => "",
      categories: () => homeCats.length ? `<section><h2 class="sec">تسوق حسب القسم</h2><div class="catgrid">${homeCats.map(c => `<a class="cc" href="/c/${L.esc(encodeURIComponent(c.slug))}">${L.safeUrl(c.image_url) ? `<img src="${L.esc(c.image_url)}" alt="${L.esc(c.name)}" width="120" height="120" loading="lazy">` : `<span class="ci">${L.esc(c.name.slice(0, 1))}</span>`}<b>${L.esc(c.name)}</b></a>`).join("")}</div></section>` : "",
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
