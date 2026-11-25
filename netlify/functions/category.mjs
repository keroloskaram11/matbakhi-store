import * as L from "../lib/lib.mjs";
const PER = 48;
export default async (req, context) => {
  try {
    const u = { searchParams: { get: k => L.params(req, context)[k] ?? null } };
    const slug = L.dec(u.searchParams.get("slug") || "");
    const page = Math.max(1, parseInt(u.searchParams.get("page")) || 1);
    const [S, cats, Z] = await Promise.all([L.settings(), L.categories(), L.zones()]);
    const b = L.baseUrl(req, S), name = S.store_name || "المتجر";
    let cat = null;
    if (slug) { cat = cats.find(c => c.slug === slug); if (!cat) return L.notFound(req, S, cats, "القسم") }
    const num = v => { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : null };
    const mn = num(u.searchParams.get("min")), mx = num(u.searchParams.get("max")), stock = u.searchParams.get("stock") === "1";
    const sort = ["price_asc", "price_desc"].includes(u.searchParams.get("sort")) ? u.searchParams.get("sort") : "new";
    const filtered = mn !== null || mx !== null || stock || sort !== "new";
    const filter = (cat ? `&category_id=eq.${encodeURIComponent(cat.id)}` : "") + (mn !== null ? `&price=gte.${mn}` : "") + (mx !== null ? `&price=lte.${mx}` : "") + (stock ? "&in_stock=eq.true" : "");
    const order = sort === "price_asc" ? "price.asc" : sort === "price_desc" ? "price.desc" : "created_at.desc";
    const fq = [mn !== null ? "min=" + mn : "", mx !== null ? "max=" + mx : "", stock ? "stock=1" : "", sort !== "new" ? "sort=" + sort : ""].filter(Boolean);
    const { data: prods, total } = await L.rest(`products?select=${L.PCOLS}&active=eq.true${filter}&order=${order}&limit=${PER}&offset=${(page - 1) * PER}`, { count: true });
    const pages = Math.max(1, Math.ceil(total / PER));
    const tm = await L.tiersFor(prods);
    if (page > pages) return L.notFound(req, S, cats, "الصفحة");
    const base = cat ? "/c/" + encodeURIComponent(cat.slug) : "/products";
    const path = base + (page > 1 ? "?page=" + page : "");
    const qsOf = pg => { const p = [...fq, pg > 1 ? "page=" + pg : ""].filter(Boolean); return base + (p.length ? "?" + p.join("&") : "") };
    const label = cat ? cat.name : "كل المنتجات";
    const crumbs = [["الرئيسية", "/"], ...(cat ? [[cat.name, base]] : [["كل المنتجات", base]])];
    const title = `${label}${page > 1 ? " - صفحة " + page : ""} | ${name}`;
    const desc = L.cut((cat && cat.description) || `تسوق ${label} من ${name} بأفضل الأسعار مع التوصيل لجميع محافظات مصر والدفع عند الاستلام.`, 160);
    const pager = pages > 1 ? `<nav class="pager">${page > 1 ? `<a class="btn gray" href="${L.esc(qsOf(page - 1))}">السابق</a>` : ""}<span>صفحة ${page} من ${pages}</span>${page < pages ? `<a class="btn gray" href="${L.esc(qsOf(page + 1))}">التالي</a>` : ""}</nav>` : "";
    const main = `${L.crumbHtml(crumbs)}<h1 class="sec">${L.esc(label)}</h1>
<details class="filters" ${filtered ? "open" : ""}><summary>تصفية وترتيب</summary><form method="get" action="${L.esc(base)}"><div class="row"><div><label>السعر من</label><input name="min" type="number" inputmode="numeric" min="0" value="${mn ?? ""}"></div><div><label>إلى</label><input name="max" type="number" inputmode="numeric" min="0" value="${mx ?? ""}"></div></div><label>الترتيب</label><select name="sort"><option value="new" ${sort === "new" ? "selected" : ""}>الأحدث</option><option value="price_asc" ${sort === "price_asc" ? "selected" : ""}>السعر: الأقل أولاً</option><option value="price_desc" ${sort === "price_desc" ? "selected" : ""}>السعر: الأعلى أولاً</option></select><label class="chk"><input type="checkbox" name="stock" value="1" ${stock ? "checked" : ""}>المتوفر فقط</label><button class="btn" type="submit">تطبيق</button> <a class="btn gray" href="${L.esc(base)}">مسح</a></form></details>${cat && cat.description ? `<p class="lead">${L.esc(cat.description)}</p>` : ""}
<div class="grid">${L.cardsHtml(prods, tm) || `<div class="empty">لا توجد منتجات</div>`}</div>${pager}`;
    const ld = [L.crumbLd(b, crumbs), { "@context": "https://schema.org", "@type": "CollectionPage", name: label, url: b + path, inLanguage: "ar-EG", mainEntity: { "@type": "ItemList", itemListElement: prods.map((p, i) => ({ "@type": "ListItem", position: (page - 1) * PER + i + 1, url: L.pUrl(b, p), name: p.name })) } }];
    return L.send(L.layout({ req, S, cats, zonesList: Z, robots: filtered ? "noindex,follow" : undefined, title, desc, path, ld, body: { main }, currentCat: cat ? cat.slug : "", prev: page > 1 ? qsOf(page - 1) : null, next: page < pages ? qsOf(page + 1) : null, og: { image: prods[0] && prods[0].image_url } }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/products","/c/:slug"] };
