const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=i=>document.getElementById(i);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dmy=iso=>/^\d{4}-\d\d-\d\d/.test(iso||"")?iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4):"";
const pdmy=t=>{const m=/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/.exec(String(t||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim());return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):""};
const dIn=(id,v)=>`<input id="${id}" type="text" inputmode="numeric" dir="ltr" placeholder="DD/MM/YYYY" maxlength="10" autocomplete="off" value="${esc(v)}">`;
const imgOf=i=>{const p=D.products.find(x=>String(x.id)===String(i.product_id));const u=p&&p.image_url;return /^https?:\/\//.test(u||"")?u:""};
const fmt=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:2});
const num=v=>{const n=parseFloat(String(v).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)));return isNaN(n)?0:n};
const today=()=>new Date().toISOString().slice(0,10);
const D={products:[],costs:{},tiers:{},cats:[],statuses:[],orders:[],settings:{},zones:[],wholesale:[]};
const NAV=[["home","الرئيسية"],["products","المنتجات"],["cats","الأقسام"],["orders","الطلبات"],["customers","العملاء"],["abandoned","سلات متروكة"],["reports","التقارير والأرباح"],["look","مظهر المتجر"],["shipping","الشحن"],["coupons","العروض وكوبونات الخصم"],["settings","الإعدادات"]];
const V={};let tab="home";
async function fetchAll(build){let out=[],from=0;for(;;){const {data,error}=await build().range(from,from+999);if(error)throw error;out=out.concat(data);if(data.length<1000)break;from+=1000}return out}
const flash=(id,t,ok)=>{const e=$(id);if(e){e.textContent=t;e.className=ok?"ok":"msg"}};
const setting=(k,d="")=>D.settings[k]??d;
function csv(name,rows){const t="\ufeff"+rows.map(r=>r.map(c=>{c=String(c??"");return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(",")).join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type:"text/csv;charset=utf-8"}));a.download=name;a.click()}

/* ---------- auth + shell ---------- */
async function login(){const {error}=await sb.auth.signInWithPassword({email:$("em").value.trim(),password:$("pw").value});if(error){$("err").textContent="خطأ في الدخول: "+error.message;return}start()}
$("loginBtn").onclick=login;$("pw").onkeydown=e=>{if(e.key==="Enter")login()};
$("lo").onclick=async()=>{await sb.auth.signOut();location.reload()};
$("menu").onclick=()=>document.body.classList.toggle("open");$("shade").onclick=()=>document.body.classList.remove("open");
async function start(){
 const {data}=await sb.auth.getSession();if(!data.session)return;
 $("login").style.display="none";$("app").style.display="flex";$("view").innerHTML="جاري التحميل...";
 try{await loadAll()}catch(e){$("view").innerHTML=`<div class="box msg">تعذر تحميل البيانات: ${esc(e.message)}<br>تأكد أنك دخلت بحساب المدير وأنك شغلت ملفات SQL (المرحلة 1 ثم 2).</div>`;return}
 const h=location.hash.slice(1);go(NAV.some(n=>n[0]===h)?h:"home");
}
async function loadAll(){
 const [products,costs,tiers,orders,wh,cats,sts,set,zones,vars]=await Promise.all([
  fetchAll(()=>sb.from("products").select("*").order("created_at",{ascending:false})),
  fetchAll(()=>sb.from("product_costs").select("*")),
  fetchAll(()=>sb.from("product_price_tiers").select("*").order("min_qty")),
  fetchAll(()=>sb.from("orders").select("*,order_items(*)").order("created_at",{ascending:false})),
  fetchAll(()=>sb.from("wholesale_requests").select("*").order("created_at",{ascending:false})),
  sb.from("categories").select("*").order("sort_order").order("name"),
  sb.from("order_statuses").select("*").order("sort_order"),
  sb.from("settings").select("key,value"),
  sb.from("shipping_zones").select("*").order("sort_order"),
  fetchAll(()=>sb.from("product_variants").select("*").order("sort_order").order("created_at"))]);
 for(const r of [cats,sts,set,zones])if(r.error)throw r.error;
 D.products=products;D.costs={};costs.forEach(c=>D.costs[c.product_id]=c.cost);D.tiers={};tiers.forEach(t=>(D.tiers[t.product_id]=D.tiers[t.product_id]||[]).push(t));
 D.vars={};vars.forEach(v=>(D.vars[v.product_id]=D.vars[v.product_id]||[]).push(v));D.orders=orders;D.wholesale=wh;D.cats=cats.data;D.statuses=sts.data;D.zones=zones.data;D.settings={};set.data.forEach(r=>D.settings[r.key]=r.value);
}
const newStatusId=()=>(D.statuses[0]||{}).id;
const newOrders=()=>D.orders.filter(o=>o.status_id===newStatusId()).length;
const newWh=()=>D.wholesale.filter(w=>w.status==="جديد").length;
function drawNav(){const bd={orders:newOrders()+newWh()};$("nav").innerHTML=NAV.map(n=>`<button data-t="${n[0]}" class="${n[0]===tab?"on":""}">${n[1]}${bd[n[0]]?`<span class="bd">${bd[n[0]]}</span>`:""}</button>`).join("");$("nav").querySelectorAll("button").forEach(b=>b.onclick=()=>go(b.dataset.t))}
function go(t){tab=t;if(t==="look")lookSub=null;location.hash=t;document.body.classList.remove("open");$("ptitle").textContent=NAV.find(n=>n[0]===t)[1];drawNav();V[t]();scrollTo(0,0)}
async function upload(file,prefix){const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-zA-Z0-9]/g,"").slice(0,5)||"jpg";const path=(prefix?prefix+"/":"")+Date.now()+"-"+Math.random().toString(36).slice(2,8)+"."+ext;
 const {error}=await sb.storage.from("product-images").upload(path,file,{contentType:file.type||undefined});if(error)throw error;return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl}
const catName=id=>(D.cats.find(c=>c.id===id)||{}).name||"";
const catOpts=sel=>`<option value="">بدون تصنيف</option>`+D.cats.map(c=>`<option value="${esc(c.id)}" ${c.id===sel?"selected":""}>${esc(c.name)}</option>`).join("");
const stOf=id=>D.statuses.find(s=>s.id===id);
const itemsCost=o=>(o.order_items||[]).reduce((a,i)=>a+i.qty*Number(i.unit_cost),0);
const orderProfit=o=>Number(o.total)-itemsCost(o)-Number(o.shipping_cost);
const tierPrice=(p,q)=>{let pr=p.sale_price&&p.sale_price<p.price?p.sale_price:p.price;(D.tiers[String(p.id)]||[]).forEach(t=>{if(q>=t.min_qty&&Number(t.unit_price)<pr)pr=Number(t.unit_price)});return pr};

/* ---------- generic settings form ---------- */
function F(list){return list.map(f=>{const [k,l,t]=f;const v=D.settings[k]??"";
 if(t==="color")return `<div><label>${l}</label><input type="color" data-k="${k}" value="${esc(v||(k==="bg_color"?"#faf7f2":k==="ticker_fg"?"#ffffff":"#7a3e1d"))}"></div>`;
 if(t==="area")return `<label>${l}</label><textarea data-k="${k}" rows="3">${esc(v)}</textarea>`;
 if(t==="img")return `<div><label>${l} ${v?`<img src="${esc(v)}" height="36" alt="">`:""}</label><input type="file" accept="image/*" data-up="${k}"></div>`;
 return `<label>${l}</label><input data-k="${k}" value="${esc(v)}" ${t==="ltr"?'dir="ltr"':""} ${t==="num"?'inputmode="decimal"':""}>`}).join("")}
async function saveBlock(root,msg,extra){
 flash(msg,"جاري الحفظ...",true);
 try{
  const rows=[...root.querySelectorAll("[data-k]")].map(i=>({key:i.dataset.k,value:i.value.trim()}));
  for(const f of root.querySelectorAll("[data-up]"))if(f.files[0])rows.push({key:f.dataset.up,value:await upload(f.files[0],"site")});
  const g=k=>rows.find(r=>r.key===k);
  if(g("site_url")){g("site_url").value=g("site_url").value.replace(/\/+$/,"");if(g("site_url").value&&!/^https?:\/\/[^\s\/]+$/.test(g("site_url").value))return flash(msg,"عنوان الموقع لازم يبدأ بـ https:// بدون مسار")}
  if(g("meta_pixel_id")&&g("meta_pixel_id").value&&!/^\d{5,20}$/.test(g("meta_pixel_id").value))return flash(msg,"Meta Pixel ID لازم يكون أرقام فقط");
  if(g("ga_id")&&g("ga_id").value&&!/^(G|AW)-[A-Za-z0-9-]{4,20}$/.test(g("ga_id").value))return flash(msg,"رقم Google Analytics لازم يبدأ بـ G-");
  if(g("whatsapp"))g("whatsapp").value=g("whatsapp").value.replace(/\D/g,"");
  for(const k of ["free_shipping_min","courier_cost","shipping_fee"])if(g(k))g(k).value=String(Math.max(0,num(g(k).value)));
  for(const k of ["facebook_url","instagram_url","tiktok_url","youtube_url","x_url","telegram_url","whatsapp_url"])if(g(k)&&g(k).value&&!/^https:\/\//.test(g(k).value))return flash(msg,"روابط التواصل لازم تبدأ بـ https://");
  if(extra)rows.push(...extra());{const m=new Map();rows.forEach(r=>m.set(r.key,r));rows.length=0;rows.push(...m.values())}
  const {error}=await sb.from("settings").upsert(rows.map(r=>({...r,updated_at:new Date().toISOString()})));if(error)throw error;
  rows.forEach(r=>D.settings[r.key]=r.value);flash(msg,"تم الحفظ",true);return true;
 }catch(e){flash(msg,"خطأ: "+e.message)}
}

/* ---------- home ---------- */
V.home=()=>{
 const m=today().slice(0,7),ok=o=>(stOf(o.status_id)||{counts_in_profit:true}).counts_in_profit;
 const td=D.orders.filter(o=>o.order_date===today()&&ok(o)),mo=D.orders.filter(o=>o.order_date.slice(0,7)===m&&ok(o));
 const noCost=D.products.filter(p=>D.costs[String(p.id)]==null).length,noCat=D.products.filter(p=>!p.category_id).length,oos=D.products.filter(p=>p.in_stock===false).length;
 const todos=[];
 if(newOrders())todos.push(`عندك ${newOrders()} طلب جديد <button class="sm" data-g="orders">افتح الطلبات</button>`);
 if(newWh())todos.push(`${newWh()} طلب جملة جديد <button class="sm" data-g="orders">افتح</button>`);
 if(!setting("site_url"))todos.push(`لم تكتب عنوان الموقع الرسمي (مهم للسيو) <button class="sm" data-g="settings">الإعدادات</button>`);
 if(!setting("return_policy"))todos.push(`لم تكتب سياسة الاسترجاع <button class="sm" data-g="settings">الإعدادات</button>`);
 if(noCost)todos.push(`${noCost} منتج بدون سعر تكلفة (الربح لن يحسب صح) <button class="sm" data-g="products">المنتجات</button>`);
 if(noCat)todos.push(`${noCat} منتج بدون قسم <button class="sm" data-g="products">المنتجات</button>`);
 if(oos)todos.push(`${oos} منتج نفذت كميته`);
 $("view").innerHTML=`${todos.map(t=>`<div class="todo">${t}</div>`).join("")}
 <div class="stat"><div>طلبات جديدة<b>${newOrders()}</b></div><div>مبيعات اليوم<b>${fmt(td.reduce((a,o)=>a+Number(o.total),0))}</b></div><div>ربح اليوم<b>${fmt(td.reduce((a,o)=>a+orderProfit(o),0))}</b></div><div>ربح الشهر<b>${fmt(mo.reduce((a,o)=>a+orderProfit(o),0))}</b></div><div>المنتجات<b>${D.products.length}</b></div></div>
 <div class="box" style="margin-top:14px"><h3>آخر الطلبات</h3>${D.orders.slice(0,6).map(o=>`<div class="ord"><b>#${o.order_no} ${esc(o.customer_name)}</b> ${o.source==="web"?`<span class="pill" style="background:#0891b2">من الموقع</span>`:""} <span class="pill" style="background:${esc((stOf(o.status_id)||{}).color||"#999")}">${esc((stOf(o.status_id)||{}).name||"")}</span> - ${fmt(o.total)} جنيه</div>`).join("")||"لا توجد طلبات بعد"}</div>
 <div class="box"><h3>اختصارات</h3><div class="grid2"><button data-g="products">+ منتج</button><button data-g="orders">+ طلب</button><button data-g="look">تعديل الصفحة الرئيسية</button><button data-g="shipping">أسعار الشحن</button></div></div>`;
 document.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>go(b.dataset.g));
};

/* ---------- products ---------- */
let editP=null,lim=100,gal=[];
const galOf=p=>{const a=Array.isArray(p.images)?p.images.filter(Boolean):[];return a.length?a.slice():(p.image_url?[p.image_url]:[])};
async function shrink(file){ // resize big photos in the browser (max 1400px, JPEG) so the store loads fast and storage lasts
 try{if(!/^image\/(jpeg|png|webp)$/.test(file.type))return file;const bm=await createImageBitmap(file);const k=Math.min(1,1400/Math.max(bm.width,bm.height));if(k===1&&file.size<400000)return file;
  const c=document.createElement("canvas");c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext("2d").drawImage(bm,0,0,c.width,c.height);
  const b=await new Promise(r=>c.toBlob(r,"image/jpeg",0.85));return b&&b.size<file.size?new File([b],file.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}):file}catch(e){return file}}
const RT=[["عريض","<b>","</b>"],["عنوان","<h3>","</h3>"],["قائمة","<ul>\n<li>","</li>\n<li></li>\n</ul>"],["رابط",'<a href="https://">',"</a>"],["صورة",'<img src="https://" alt="">',""],["فاصل","<hr>",""],["لون أحمر",'<span style="color:#c0392b">',"</span>"],["صندوق ملون",'<div style="background:#fff4e5;border:1px solid #f5c98b;border-radius:10px;padding:12px">',"</div>"],["جدول",'<table>\n<tr><th>الخاصية</th><th>القيمة</th></tr>\n<tr><td></td><td></td></tr>\n</table>',""]];
function drawGal(){const g=$("gal");if(!g)return;g.innerHTML=gal.map((u,i)=>`<div class="gi"><img src="${esc(u)}" alt=""><span>${i===0?"<b>الرئيسية</b>":""}</span><div><button type="button" class="sm gray" data-gm="${i}" title="قبل">▶</button><button type="button" class="sm gray" data-gn="${i}" title="بعد">◀</button><button type="button" class="sm red" data-gx="${i}">x</button></div></div>`).join("")||'<p class="hint">لا توجد صور بعد</p>';
 g.querySelectorAll("[data-gm]").forEach(b=>b.onclick=()=>{const i=+b.dataset.gm;if(i>0){[gal[i-1],gal[i]]=[gal[i],gal[i-1]];drawGal()}});
 g.querySelectorAll("[data-gn]").forEach(b=>b.onclick=()=>{const i=+b.dataset.gn;if(i<gal.length-1){[gal[i+1],gal[i]]=[gal[i],gal[i+1]];drawGal()}});
 g.querySelectorAll("[data-gx]").forEach(b=>b.onclick=()=>{gal.splice(+b.dataset.gx,1);drawGal()})}
const tierRow=t=>`<div class="tier"><div><label>من كمية</label><input class="t-q" type="number" inputmode="numeric" min="2" value="${esc(t.min_qty??"")}"></div><div><label>سعر القطعة</label><input class="t-p" type="number" inputmode="decimal" value="${esc(t.unit_price??"")}"></div><div><label>اسم (اختياري: جملة، كرتونة)</label><input class="t-l" value="${esc(t.label)}"></div><button class="sm red t-x" type="button">x</button></div>`;
V.products=()=>{
 if(typeof impMode!=="undefined"&&impMode)return V.import();
 const q=($("ps")||{}).value||"",fc=($("pc")||{}).value||"";
 const list=D.products.filter(p=>(!q||(p.name||"").includes(q))&&(!fc||(fc==="none"?!p.category_id:p.category_id===fc)));
 const p=editP||{};const ts=editP?(D.tiers[String(p.id)]||[]):[];
 $("view").innerHTML=`<div class="box" id="pform"><button class="sm gray" id="impopen" style="float:left">استيراد من Excel / CSV</button><h3>${editP?"تعديل منتج":"منتج جديد"}</h3>
 <label>الاسم</label><input id="pn" value="${esc(p.name)}"><label>الوصف (نص عادي أو HTML للتنسيق، الأكواد الخطيرة تُحذف تلقائياً)</label>
 <div class="rtb">${RT.map((t,i)=>`<button type="button" class="sm gray" data-rt="${i}">${t[0]}</button>`).join("")}</div><textarea id="pd" rows="7" dir="auto">${esc(p.description)}</textarea>
 <details class="rprev"><summary>معاينة الوصف كما سيظهر</summary><div id="pdprev" class="desc rich"></div></details>
 <div class="row"><div><label>سعر البيع (قطاعي)</label><input id="pp" type="number" inputmode="decimal" value="${esc(p.price)}"></div><div><label>سعر الخصم (اختياري)</label><input id="psl" type="number" inputmode="decimal" value="${esc(p.sale_price)}"></div><div><label>سعر التكلفة (سري)</label><input id="pcost" type="number" inputmode="decimal" value="${esc(editP?D.costs[String(p.id)]??"":"")}"></div></div>
 <div class="row"><div><label>التصنيف</label><select id="pcat">${catOpts(p.category_id)}</select></div><div><label>أقل كمية للطلب</label><input id="pmoq" type="number" inputmode="numeric" min="1" value="${esc(p.min_order_qty||1)}"></div></div>
 <h4>أسعار الجملة حسب الكمية (اختياري)</h4><p class="hint">مثال: من 10 قطع سعر القطعة 90، من 24 (كرتونة) سعر القطعة 80. السلة تحسب السعر تلقائياً حسب الكمية.</p>
 <div id="tiers">${ts.map(tierRow).join("")}</div><button class="sm gray" id="tadd" type="button">+ شريحة سعر</button>
 <h4>الخيارات (متغيرات: اللون / المقاس / ...) اختياري</h4><p class="hint">لو ضفت خيارات، العميل لازم يختار واحد قبل الإضافة للسلة. اكتب اسم الخيار زي "أحمر / كبير". السعر فاضي = نفس سعر المنتج. الخيار المتوقف مش بيظهر للشراء.</p>
 <div id="vrows">${((editP&&D.vars[String(editP.id)])||[]).map(varRow).join("")}</div><button class="sm gray" id="vadd" type="button">+ خيار</button>
 <h4>المواصفات (خصائص المنتج) اختياري</h4><p class="hint">مثال: الخامة: ستانلس ستيل، البلد: مصر. بتظهر جدول في صفحة المنتج.</p>
 <div id="arows">${(Array.isArray(p.attributes)?p.attributes:[]).map(attrRow).join("")}</div><button class="sm gray" id="aadd" type="button">+ خاصية</button>
 <label style="margin-top:10px">صور المنتج (حتى 12، الأولى هي الرئيسية)</label><div id="gal" class="gal"></div><input id="pfs" type="file" accept="image/*" multiple><span id="gm" class="msg"></span>
 <div class="row"><label><input type="checkbox" id="pa" ${editP?(p.active?"checked":""):"checked"}>ظاهر في المتجر</label><label><input type="checkbox" id="pst" ${editP?(p.in_stock!==false?"checked":""):"checked"}>متوفر</label><label><input type="checkbox" id="pfe" ${p.featured?"checked":""}>منتج مميز (يظهر في الرئيسية)</label></div>
 <button id="psave">حفظ</button> <button class="gray" id="pcancel">إلغاء</button> <span id="pm"></span></div>
 <div class="box"><div class="row"><input id="ps" placeholder="بحث في المنتجات" value="${esc(q)}"><select id="pc"><option value="">كل التصنيفات</option><option value="none" ${fc==="none"?"selected":""}>بدون تصنيف</option>${D.cats.map(c=>`<option value="${esc(c.id)}" ${fc===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
 <p>عدد المنتجات: ${list.length} <button class="sm gray" id="pexp" type="button">تصدير المنتجات CSV</button> <button class="sm gray" id="ptpl" type="button">تحميل قالب فاضي</button></p><div class="scroll"><table><tr><th></th><th>الاسم</th><th>القسم</th><th>البيع</th><th>التكلفة</th><th>الربح</th><th>حالة</th><th></th></tr>
 ${list.slice(0,lim).map(x=>{const c=D.costs[String(x.id)],pr=x.sale_price??x.price;return `<tr><td>${x.image_url?`<img loading="lazy" src="${esc(x.image_url)}" alt="">`:""}</td><td>${esc(x.name)}${(D.tiers[String(x.id)]||[]).length?` <span class="pill2">جملة</span>`:""}${x.featured?` <span class="pill2">مميز</span>`:""}</td><td>${esc(catName(x.category_id))}</td><td>${fmt(pr)}</td><td>${c==null?"-":fmt(c)}</td><td>${c==null?"-":fmt(pr-c)}</td><td>${x.active?"ظاهر":"مخفي"}${x.in_stock===false?" / نفذ":""}</td>
 <td><button class="sm" data-e="${esc(x.id)}">تعديل</button> <button class="sm gray" data-tg="${esc(x.id)}">${x.active?"إخفاء":"إظهار"}</button> <button class="sm red" data-d="${esc(x.id)}">حذف</button></td></tr>`}).join("")}</table></div>
 ${list.length>lim?`<button class="gray" id="pmore" style="display:block;margin:12px auto">عرض المزيد</button>`:""}</div>`;
 $("ps").oninput=()=>{lim=100;const pos=$("ps").selectionStart;V.products();$("ps").focus();$("ps").setSelectionRange(pos,pos)};$("pc").onchange=()=>{lim=100;V.products()};
 const PH=["Handle","Title","Description","SKU","Quantity","Regular Price","Sale Price","Cost","Images","Status","Collections"];
 $("pexp").onclick=()=>csv("products-"+today()+".csv",[PH].concat(list.map(x=>{const im=Array.isArray(x.images)&&x.images.length?x.images:(x.image_url?[x.image_url]:[]);const c=D.costs[String(x.id)];return [x.slug||"",x.name,x.description||"",x.sku||"",x.in_stock===false?"out of stock":"available",x.price,x.sale_price??"",c??"",im.join(" "),x.active?"ACTIVE":"DRAFT",catName(x.category_id)==="-"?"":catName(x.category_id)]})));
 $("ptpl").onclick=()=>csv("products-template.csv",[PH,["example-product","اسم المنتج","وصف المنتج","","available","100","","60","https://example.com/image1.jpg","ACTIVE","اسم القسم"]]);
 if($("pmore"))$("pmore").onclick=()=>{lim+=100;V.products()};
 const wireV=()=>{document.querySelectorAll(".v-x").forEach(b=>b.onclick=()=>b.closest(".vrow").remove());document.querySelectorAll(".a-x").forEach(b=>b.onclick=()=>b.closest(".arow").remove())};wireV();
 $("vadd").onclick=()=>{$("vrows").insertAdjacentHTML("beforeend",varRow({in_stock:true}));wireV()};$("aadd").onclick=()=>{$("arows").insertAdjacentHTML("beforeend",attrRow({}));wireV()};
 const wireT=()=>document.querySelectorAll(".t-x").forEach(b=>b.onclick=()=>b.closest(".tier").remove());wireT();
 $("tadd").onclick=()=>{$("tiers").insertAdjacentHTML("beforeend",tierRow({}));wireT()};
 drawGal();$("impopen").onclick=()=>{impMode=true;V.import()};
 $("pfs").onchange=async()=>{const fs=[...$("pfs").files];for(const f of fs){if(gal.length>=12){flash("gm","الحد الأقصى 12 صورة");break}try{flash("gm","جاري رفع "+f.name+"...",true);gal.push(await upload(await shrink(f)));drawGal()}catch(e){flash("gm","خطأ في الرفع: "+e.message);return}}flash("gm","تم الرفع",true);$("pfs").value=""};
 const prev=()=>{$("pdprev").innerHTML=window.sanitizeHtml($("pd").value)};$("pd").oninput=prev;prev();
 document.querySelectorAll("[data-rt]").forEach(b=>b.onclick=()=>{const t=RT[+b.dataset.rt],ta=$("pd"),a=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.slice(a,e);ta.value=ta.value.slice(0,a)+t[1]+sel+t[2]+ta.value.slice(e);ta.focus();prev()});
 $("psave").onclick=saveProduct;$("pcancel").onclick=()=>{editP=null;gal=[];V.products()};
 const find=id=>D.products.find(x=>String(x.id)===id);
 document.querySelectorAll("#view [data-e]").forEach(b=>b.onclick=()=>{editP=find(b.dataset.e);gal=galOf(editP);V.products();scrollTo(0,0)});
 document.querySelectorAll("#view [data-tg]").forEach(b=>b.onclick=async()=>{const x=find(b.dataset.tg);const {error}=await sb.from("products").update({active:!x.active}).eq("id",x.id);if(error)return alert(error.message);x.active=!x.active;V.products()});
 document.querySelectorAll("#view [data-d]").forEach(b=>b.onclick=async()=>{const x=find(b.dataset.d);if(!confirm("حذف المنتج: "+x.name+"؟"))return;const {error}=await sb.from("products").delete().eq("id",x.id);if(error)return alert(error.message);const k=String(x.id);await sb.from("product_costs").delete().eq("product_id",k);await sb.from("product_price_tiers").delete().eq("product_id",k);D.products=D.products.filter(y=>y!==x);V.products()});
};
const varRow=v=>`<div class="vrow row" data-id="${esc(v.id||"")}"><div><label>اسم الخيار</label><input class="v-l" maxlength="60" value="${esc(v.label)}"></div><div><label>السعر (اختياري)</label><input class="v-p" type="number" inputmode="decimal" value="${esc(v.price)}"></div><div><label>سعر الخصم (اختياري)</label><input class="v-s" type="number" inputmode="decimal" value="${esc(v.sale_price)}"></div><label><input type="checkbox" class="v-i" style="width:auto" ${v.in_stock!==false?"checked":""}> متوفر</label><button class="sm red v-x" type="button">حذف</button></div>`;
const attrRow=a=>`<div class="arow row"><div><label>الخاصية</label><input class="a-k" maxlength="60" value="${esc(a.k)}"></div><div><label>القيمة</label><input class="a-v" maxlength="200" value="${esc(a.v)}"></div><button class="sm red a-x" type="button">حذف</button></div>`;
async function saveProduct(){
 flash("pm","جاري الحفظ...",true);
 try{
  if(gal.length>12)return flash("pm","الحد الأقصى 12 صورة");
  const row={name:$("pn").value.trim(),description:$("pd").value,price:num($("pp").value),sale_price:$("psl").value?num($("psl").value):null,image_url:gal[0]||null,images:gal.slice(),category_id:$("pcat").value||null,active:$("pa").checked,in_stock:$("pst").checked,featured:$("pfe").checked,min_order_qty:Math.max(1,parseInt($("pmoq").value)||1),attributes:[...document.querySelectorAll(".arow")].map(r=>({k:r.querySelector(".a-k").value.trim(),v:r.querySelector(".a-v").value.trim()})).filter(a=>a.k&&a.v)};
  if(!row.name||!row.price)return flash("pm","الاسم والسعر مطلوبين");
  const tiers=[...document.querySelectorAll(".tier")].map(r=>({min_qty:parseInt(r.querySelector(".t-q").value),unit_price:num(r.querySelector(".t-p").value),label:r.querySelector(".t-l").value.trim()||null})).filter(t=>t.min_qty>=2&&t.unit_price>0);
  if(new Set(tiers.map(t=>t.min_qty)).size!==tiers.length)return flash("pm","كمية مكررة في شرائح الأسعار");
  const r=editP?await sb.from("products").update(row).eq("id",editP.id).select().single():await sb.from("products").insert(row).select().single();
  if(r.error)throw r.error;const pid=String(r.data.id);
  if($("pcost").value!==""){const {error}=await sb.from("product_costs").upsert({product_id:pid,cost:num($("pcost").value),updated_at:new Date().toISOString()});if(error)throw error;D.costs[pid]=num($("pcost").value)}
  const del=await sb.from("product_price_tiers").delete().eq("product_id",pid);if(del.error)throw del.error;
  if(tiers.length){const {data,error}=await sb.from("product_price_tiers").insert(tiers.map(t=>({...t,product_id:pid}))).select();if(error)throw error;D.tiers[pid]=data.sort((a,b)=>a.min_qty-b.min_qty)}else delete D.tiers[pid];
  const vr=[...document.querySelectorAll(".vrow")].map((r,i)=>({id:r.dataset.id||null,label:r.querySelector(".v-l").value.trim(),price:r.querySelector(".v-p").value!==""?num(r.querySelector(".v-p").value):null,sale_price:r.querySelector(".v-s").value!==""?num(r.querySelector(".v-s").value):null,in_stock:r.querySelector(".v-i").checked,sort_order:i})).filter(v=>v.label);
  if(new Set(vr.map(v=>v.label)).size!==vr.length)return flash("pm","اسم خيار مكرر");
  const keep=vr.filter(v=>v.id).map(v=>v.id),old=(D.vars[pid]||[]).map(v=>v.id).filter(id=>!keep.includes(id));
  if(old.length){const {error}=await sb.from("product_variants").delete().in("id",old);if(error)throw error}
  const ups=vr.filter(v=>v.id).map(v=>({...v,product_id:pid})),ins=vr.filter(v=>!v.id).map(v=>({label:v.label,price:v.price,sale_price:v.sale_price,in_stock:v.in_stock,sort_order:v.sort_order,product_id:pid}));
  if(ups.length){const {error}=await sb.from("product_variants").upsert(ups);if(error)throw error}
  if(ins.length){const {error}=await sb.from("product_variants").insert(ins);if(error)throw error}
  {const {data,error}=await sb.from("product_variants").select("*").eq("product_id",pid).order("sort_order");if(error)throw error;if(data.length)D.vars[pid]=data;else delete D.vars[pid]}
  if(editP)Object.assign(editP,r.data);else D.products.unshift(r.data);
  editP=null;gal=[];V.products();flash("pm","تم الحفظ",true);
 }catch(e){flash("pm","خطأ: "+e.message)}
}

/* ---------- customers (built from orders, grouped by phone) ---------- */
let custQ="",custOpen=null;
const normPh=p=>{p=String(p||"").replace(/[\u0660-\u0669]/g,d=>d.charCodeAt(0)-0x660).replace(/\D/g,"");return p.length>=10?p.slice(-10):p};
function buildCustomers(){const m=new Map();
 D.orders.forEach(o=>{const k=normPh(o.phone)||("n:"+o.customer_name);let c=m.get(k);if(!c){c={key:k,name:o.customer_name,phone:o.phone,gov:o.governorate,orders:[],spend:0,cnt:0,first:o.created_at,last:o.created_at};m.set(k,c)}
  c.orders.push(o);const st=stOf(o.status_id)||{counts_in_profit:true};if(st.counts_in_profit){c.spend+=Number(o.total)||0;c.cnt++}
  if(o.created_at>c.last){c.last=o.created_at;c.name=o.customer_name;c.gov=o.governorate||c.gov}if(o.created_at<c.first)c.first=o.created_at});
 return [...m.values()].sort((a,b)=>b.spend-a.spend||(b.last>a.last?1:-1))}
V.customers=()=>{
 const all=buildCustomers(),q=custQ.trim().toLowerCase(),list=all.filter(c=>!q||(c.name||"").toLowerCase().includes(q)||String(c.phone||"").includes(q));
 const tot=all.reduce((a,c)=>a+c.spend,0),rep=all.filter(c=>c.orders.length>1).length;
 $("view").innerHTML=`<div class="box"><div class="stat"><div>عدد العملاء<b>${all.length}</b></div><div>عملاء كرروا الشراء<b>${rep}</b></div></div>
 <p class="hint">العملاء بيتجمعوا من الطلبات بنفس رقم الموبايل. إجمالي الإنفاق بيحسب الطلبات اللي حالتها بتدخل في الأرباح (غير الملغية). إجمالي الكل: ${fmt(tot)} جنيه.</p>
 <div class="row"><input id="cq" placeholder="بحث بالاسم أو الموبايل" value="${esc(custQ)}"> <button class="sm gray" id="ccsv" type="button" style="width:auto;align-self:center;padding:8px 14px">تصدير العملاء CSV</button></div>
 <p>عدد النتائج: ${list.length}</p><div class="scroll"><table><tr><th>العميل</th><th>الموبايل</th><th>المحافظة</th><th>الطلبات</th><th>إجمالي الإنفاق</th><th>آخر طلب</th><th></th></tr>
 ${list.slice(0,200).map(c=>`<tr><td>${esc(c.name)}</td><td dir="ltr">${esc(c.phone)}</td><td>${esc(c.gov||"")}</td><td>${c.orders.length}</td><td>${fmt(c.spend)}</td><td>${dmy(c.last)}</td><td><button class="sm" data-c="${esc(c.key)}">${custOpen===c.key?"إخفاء":"الطلبات"}</button></td></tr>${custOpen===c.key?`<tr><td colspan="7"><div class="oact" style="flex-direction:column;align-items:stretch">${c.orders.map(o=>`<div class="ord"><b>#${o.order_no}</b> ${dmy(o.created_at)} - ${esc((stOf(o.status_id)||{}).name||"")} - ${fmt(o.total)} جنيه${o.payment_method&&o.payment_status&&o.payment_status!=="cod"?" - "+esc(o.payment_method)+(o.payment_status==="paid"?" (مدفوع)":" (بانتظار تأكيد الدفع)"):""}</div>`).join("")}</div></td></tr>`:""}`).join("")}</table></div>${list.length>200?"<p class='hint'>أول 200 نتيجة، استخدم البحث.</p>":""}</div>`;
 $("cq").oninput=()=>{custQ=$("cq").value;const p=$("cq").selectionStart;V.customers();$("cq").focus();$("cq").setSelectionRange(p,p)};
 document.querySelectorAll("#view [data-c]").forEach(b=>b.onclick=()=>{custOpen=custOpen===b.dataset.c?null:b.dataset.c;V.customers()});
 $("ccsv").onclick=()=>csv("customers-"+today()+".csv",[["الاسم","الموبايل","المحافظة","عدد الطلبات","إجمالي الإنفاق","أول طلب","آخر طلب"]].concat(list.map(c=>[c.name,c.phone,c.gov||"",c.orders.length,c.spend,c.first.slice(0,10),c.last.slice(0,10)])));
};

/* ---------- abandoned checkouts ---------- */
V.abandoned=async()=>{
 $("view").innerHTML="جاري التحميل...";
 const {data,error}=await sb.from("abandoned_checkouts").select("*").order("updated_at",{ascending:false}).limit(500);
 if(error){$("view").innerHTML=`<div class="box msg">تعذر التحميل: ${esc(error.message)}</div>`;return}
 const byPh=new Map();D.orders.forEach(o=>{const k=normPh(o.phone);(byPh.get(k)||byPh.set(k,[]).get(k)).push(o)});
 const rows=data.map(a=>{const k=normPh(a.phone),done=(byPh.get(k)||[]).some(o=>o.created_at>=a.created_at);return {...a,done,mins:Math.round((Date.now()-new Date(a.updated_at))/60000)}});
 const open=rows.filter(r=>!r.done),wait=r=>r.mins<30;
 const ago=m=>m<60?m+" دقيقة":m<1440?Math.round(m/60)+" ساعة":Math.round(m/1440)+" يوم";
 const wa=r=>{const p="2"+String(r.phone).replace(/^0/,"");const t=`أهلاً ${r.name||""}، لاحظنا إنك بدأت طلب من مطبخي بالجملة ومكملتوش. تحب نساعدك تكمله؟`;return "https://wa.me/"+p+"?text="+encodeURIComponent(t)};
 $("view").innerHTML=`<div class="box"><p class="hint">بيتسجل الطلب هنا لما العميل يكتب رقم موبايل صحيح في صفحة إتمام الطلب ويسيبها من غير ما يؤكد. أي طلب اتأكد بنفس الرقم بعد كده بيتشال من القايمة تلقائياً. الرسالة بتتبعت بضغطتك إنت على زرار واتساب، مفيش رسايل بتتبعت أوتوماتيك.</p>
 <div class="stat"><div>سلات متروكة<b>${open.filter(r=>!wait(r)).length}</b></div><div>قيد الإتمام (أقل من 30 دقيقة)<b>${open.filter(wait).length}</b></div><div>قيمتها<b>${fmt(open.reduce((a,r)=>a+Number(r.total),0))}</b></div></div>
 ${open.length?`<div class="scroll"><table><tr><th>العميل</th><th>الموبايل</th><th>المحافظة</th><th>المنتجات</th><th>القيمة</th><th>من</th><th></th></tr>${open.map(r=>`<tr><td>${esc(r.name||"-")}</td><td dir="ltr">${esc(r.phone)}</td><td>${esc(r.governorate||"")}</td><td>${(r.items||[]).map(i=>esc(i.name)+" ×"+esc(i.qty)).join("<br>")}</td><td>${fmt(r.total)}</td><td>${wait(r)?"قيد الإتمام":ago(r.mins)}</td><td><a class="sm" target="_blank" rel="noopener" href="${esc(wa(r))}">واتساب</a> <button class="sm red" data-ab="${esc(r.id)}">حذف</button></td></tr>`).join("")}</table></div>`:"<p>مفيش سلات متروكة دلوقتي.</p>"}
 ${rows.some(r=>r.done)?`<button class="sm gray" id="abclean" type="button">مسح اللي اتأكدت طلباتها (${rows.filter(r=>r.done).length})</button>`:""}</div>`;
 document.querySelectorAll("#view [data-ab]").forEach(b=>b.onclick=async()=>{if(!confirm("حذف السجل ده؟"))return;const {error}=await sb.from("abandoned_checkouts").delete().eq("id",b.dataset.ab);if(error)return alert(error.message);V.abandoned()});
 if($("abclean"))$("abclean").onclick=async()=>{const ids=rows.filter(r=>r.done).map(r=>r.id);const {error}=await sb.from("abandoned_checkouts").delete().in("id",ids);if(error)return alert(error.message);V.abandoned()};
};

/* ---------- categories ---------- */
let editC=null;
V.cats=()=>{
 const c=editC||{};
 $("view").innerHTML=`<div class="box"><h3>${editC?"تعديل قسم":"قسم جديد"} (مثال: منظفات، أجهزة كهربائية، أدوات مطبخ)</h3>
 <label>الاسم</label><input id="cn" value="${esc(c.name)}"><label>وصف القسم (يظهر في صفحة القسم ويفيد محركات البحث)</label><textarea id="cd">${esc(c.description)}</textarea>
 <label>صورة (اختياري، تظهر في الرئيسية)</label><input id="cf" type="file" accept="image/*">
 <label><input type="checkbox" id="ca" ${editC?(c.active?"checked":""):"checked"}>ظاهر في المتجر (تعطيله يخفيه تماماً)</label>
 <p class="hint">أماكن ظهور القسم:</p><div class="row"><label><input type="checkbox" id="cH" ${editC&&c.show_home===false?"":"checked"}>الصفحة الرئيسية</label><label><input type="checkbox" id="cM" ${editC&&c.show_menu===false?"":"checked"}>شريط الأقسام العلوي</label><label><input type="checkbox" id="cF" ${editC&&c.show_footer?"checked":""}>الفوتر</label></div>
 <button id="csave">حفظ</button> <button class="gray" id="ccancel">إلغاء</button> <span id="cm"></span></div>
 <div class="box"><p class="hint">استخدم الأسهم لترتيب الأقسام كما تظهر في المتجر.</p><div class="scroll"><table><tr><th>ترتيب</th><th>الاسم</th><th>الرابط</th><th>المنتجات</th><th>ظاهر</th><th>الرئيسية</th><th>الشريط</th><th>الفوتر</th><th></th></tr>
 ${D.cats.map((x,i)=>`<tr><td><button class="sm gray" data-u="${i}">▲</button> <button class="sm gray" data-w="${i}">▼</button></td><td>${esc(x.name)}</td><td dir="ltr">/c/${esc(x.slug||"")}</td><td>${D.products.filter(p=>p.category_id===x.id).length}</td><td>${x.active?"نعم":"لا"}</td>${[["show_home",x.show_home!==false],["show_menu",x.show_menu!==false],["show_footer",x.show_footer===true]].map(f=>`<td><input type="checkbox" class="pl" data-pl="${f[0]}" data-id="${esc(x.id)}" ${f[1]?"checked":""}></td>`).join("")}<td><button class="sm" data-e="${esc(x.id)}">تعديل</button> <button class="sm red" data-d="${esc(x.id)}">حذف</button></td></tr>`).join("")||"<tr><td colspan=9>لا توجد أقسام</td></tr>"}</table></div></div>`;
 $("ccancel").onclick=()=>{editC=null;V.cats()};
 $("csave").onclick=async()=>{try{
  let img=editC?editC.image_url:null;const f=$("cf").files[0];if(f)img=await upload(f,"cats");
  const row={name:$("cn").value.trim(),description:$("cd").value.trim()||null,active:$("ca").checked,show_home:$("cH").checked,show_menu:$("cM").checked,show_footer:$("cF").checked,image_url:img};if(!editC)row.sort_order=D.cats.length*10+10;
  if(!row.name)return flash("cm","الاسم مطلوب");
  const {error}=editC?await sb.from("categories").update(row).eq("id",editC.id):await sb.from("categories").insert(row);
  if(error)throw error;editC=null;await reloadCats();
 }catch(e){flash("cm","خطأ: "+e.message)}};
 document.querySelectorAll("#view .pl").forEach(b=>b.onchange=async()=>{const x=D.cats.find(y=>y.id===b.dataset.id);const {error}=await sb.from("categories").update({[b.dataset.pl]:b.checked}).eq("id",x.id);if(error){b.checked=!b.checked;return alert(error.message)}x[b.dataset.pl]=b.checked});
 const move=async(i,d)=>{const j=i+d;if(j<0||j>=D.cats.length)return;const a=D.cats.slice();[a[i],a[j]]=[a[j],a[i]];
  for(let k=0;k<a.length;k++){const {error}=await sb.from("categories").update({sort_order:(k+1)*10}).eq("id",a[k].id);if(error)return alert(error.message)}await reloadCats()};
 document.querySelectorAll("[data-u]").forEach(b=>b.onclick=()=>move(+b.dataset.u,-1));document.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>move(+b.dataset.w,1));
 document.querySelectorAll("#view [data-e]").forEach(b=>b.onclick=()=>{editC=D.cats.find(x=>x.id===b.dataset.e);V.cats();scrollTo(0,0)});
 document.querySelectorAll("#view [data-d]").forEach(b=>b.onclick=async()=>{const x=D.cats.find(y=>y.id===b.dataset.d);if(!confirm("حذف القسم "+x.name+"؟ المنتجات تبقى بدون قسم."))return;const {error}=await sb.from("categories").delete().eq("id",x.id);if(error)return alert(error.message);D.products.forEach(p=>{if(p.category_id===x.id)p.category_id=null});await reloadCats()});
};
async function reloadCats(){const {data,error}=await sb.from("categories").select("*").order("sort_order").order("name");if(error)return alert(error.message);D.cats=data;V.cats()}

/* ---------- orders (+ wholesale requests) ---------- */
let editO=null,showForm=false,totalManual=false,otab="orders";
function itemRow(i={}){return `<div class="item"><div><label>المنتج</label><input class="in-name" list="plist" value="${esc(i.product_name)}" data-pid="${esc(i.product_id||"")}"></div>
 <div><label>الكمية</label><input class="in-qty" type="number" inputmode="numeric" min="1" value="${esc(i.qty||1)}"></div>
 <div><label>سعر القطعة</label><input class="in-price" type="number" inputmode="decimal" value="${esc(i.unit_price??"")}"></div>
 <div><label>التكلفة</label><input class="in-cost" type="number" inputmode="decimal" value="${esc(i.unit_cost??"")}"></div>
 <button class="sm red in-del" type="button">x</button></div>`}
const sumItems=()=>[...document.querySelectorAll(".item")].reduce((s,r)=>s+num(r.querySelector(".in-qty").value)*num(r.querySelector(".in-price").value),0);
const recalc=()=>{if(!totalManual)$("ot").value=sumItems()};
function wireItems(){document.querySelectorAll(".item").forEach(r=>{
 const auto=()=>{const p=D.products.find(x=>String(x.id)===r.querySelector(".in-name").dataset.pid);if(p&&!r.querySelector(".in-price").dataset.m)r.querySelector(".in-price").value=tierPrice(p,num(r.querySelector(".in-qty").value)||1)};
 r.querySelector(".in-name").onchange=e=>{const p=D.products.find(x=>x.name===e.target.value);if(p){e.target.dataset.pid=String(p.id);delete r.querySelector(".in-price").dataset.m;const c=D.costs[String(p.id)];r.querySelector(".in-cost").value=c??"";auto()}else e.target.dataset.pid="";recalc()};
 r.querySelector(".in-qty").oninput=()=>{auto();recalc()};r.querySelector(".in-price").oninput=e=>{e.target.dataset.m=1;recalc()};r.querySelector(".in-cost").oninput=recalc;
 r.querySelector(".in-del").onclick=()=>{r.remove();recalc()}})}
V.orders=()=>{
 $("view").innerHTML=`<div class="sub"><button data-s="orders" class="${otab==="orders"?"on":""}">الطلبات (${D.orders.length})</button><button data-s="wh" class="${otab==="wh"?"on":""}">طلبات الجملة ${newWh()?`(${newWh()} جديد)`:`(${D.wholesale.length})`}</button></div><div id="sv"></div>`;
 document.querySelectorAll(".sub [data-s]").forEach(b=>b.onclick=()=>{otab=b.dataset.s;V.orders()});(otab==="orders"?ordersView:whView)();
};
function payBlock(x){const st=x.payment_status;if(!st||st==="cod")return "";
 return `<div class="opay"><b>الدفع:</b> ${esc(x.payment_method||"")} ${st==="paid"?`<span class="pill" style="background:#16a34a">تم تأكيد الدفع</span>`:`<span class="pill" style="background:#d97706">بانتظار تأكيد الدفع</span>`}${x.payment_ref?`<div dir="ltr">رقم العملية: ${esc(x.payment_ref)}</div>`:""}<div class="oact">${x.payment_proof?`<button class="sm gray" type="button" data-proof="${esc(x.payment_proof)}">عرض صورة التحويل</button>`:""}${st==="paid"?`<button class="sm gray" type="button" data-pay="${esc(x.id)}">إلغاء تأكيد الدفع</button>`:`<button class="sm" type="button" data-pay="${esc(x.id)}">تأكيد استلام الدفع</button>`}</div></div>`}
function filteredOrders(){const fs=($("of")||{}).value||"",q=($("oq")||{}).value||"",d1=($("od1")||{}).value||"",d2=($("od2")||{}).value||"",fg=($("og")||{}).value||"";
 return D.orders.filter(o=>(!fs||o.status_id===fs)&&(!fg||o.governorate===fg)&&(!pdmy(d1)||o.order_date>=pdmy(d1))&&(!pdmy(d2)||o.order_date<=pdmy(d2))&&(!q||[o.customer_name,o.phone,o.address,String(o.order_no)].some(v=>(v||"").includes(q))))}
function ordersView(){
 const fs=($("of")||{}).value||"",q=($("oq")||{}).value||"",d1=($("od1")||{}).value||"",d2=($("od2")||{}).value||"",fg=($("og")||{}).value||"";
 const list=filteredOrders();const o=editO||{};const govs=D.zones.map(z=>z.governorate);
 $("sv").innerHTML=`<datalist id="plist">${D.products.map(p=>`<option value="${esc(p.name)}">`).join("")}</datalist>
 <button id="onew">+ طلب جديد</button>
 <div class="box" id="oform" style="display:${showForm?"block":"none"};margin-top:12px"><h3>${editO?"تعديل طلب رقم "+o.order_no:"طلب جديد"}</h3>
  <div class="row"><div><label>اسم العميل</label><input id="oc" value="${esc(o.customer_name)}"></div><div><label>الموبايل</label><input id="oph" type="tel" value="${esc(o.phone)}"></div></div>
  <div class="row"><div><label>المحافظة</label><select id="ogv"><option value="">-</option>${govs.map(g=>`<option ${g===o.governorate?"selected":""}>${esc(g)}</option>`).join("")}</select></div><div><label>الحالة</label><select id="os">${D.statuses.map(s=>`<option value="${esc(s.id)}" ${(o.status_id||newStatusId())===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select></div><div><label>تاريخ الطلب</label>${dIn("odt",dmy(o.order_date||today()))}</div></div>
  <label>العنوان</label><textarea id="oa">${esc(o.address)}</textarea>
  <h4>المنتجات</h4><div id="items">${(o.order_items&&o.order_items.length?o.order_items:[{}]).map(itemRow).join("")}</div><button class="sm gray" id="oadd" type="button">+ إضافة منتج</button>
  <div class="row" style="margin-top:10px"><div><label>الإجمالي المطلوب من العميل (شامل الشحن)</label><input id="ot" type="number" inputmode="decimal" value="${esc(o.total??0)}"></div><div><label>تكلفة الشحن علينا</label><input id="osh" type="number" inputmode="decimal" value="${esc(o.shipping_cost??setting("courier_cost",0))}"></div></div>
  <label>ملاحظات العميل</label><input id="on" value="${esc(o.notes)}"><label>ملاحظاتي على الطلب (داخلية)</label><textarea id="oan" rows="2">${esc(o.admin_notes)}</textarea>
  <button id="osave">حفظ الطلب</button> <button class="gray" id="ocancel">إلغاء</button> <span id="om"></span></div>
 <div class="box"><div class="row"><select id="of"><option value="">كل الحالات</option>${D.statuses.map(s=>`<option value="${esc(s.id)}" ${fs===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select><select id="og"><option value="">كل المحافظات</option>${govs.map(g=>`<option ${fg===g?"selected":""}>${esc(g)}</option>`).join("")}</select><input id="oq" placeholder="بحث: اسم / موبايل / رقم الطلب" value="${esc(q)}"><div><label>من</label>${dIn("od1",d1)}</div><div><label>إلى</label>${dIn("od2",d2)}</div></div>
 <p>عدد الطلبات: ${list.length} <button class="sm gray" id="ocsv">تصدير Excel/CSV</button></p>
 ${list.slice(0,100).map(x=>{const s=stOf(x.status_id)||{},its=x.order_items||[],sub=its.reduce((a,i)=>a+Number(i.qty)*Number(i.unit_price),0),ship=Math.max(0,Number(x.total)-sub);return `<div class="oc"><div class="oh"><div><b class="on0">#${x.order_no}</b> <b>${esc(x.customer_name)}</b>${x.source==="web"?` <span class="pill" style="background:#0891b2">من الموقع</span>`:""}</div><span class="odate" dir="ltr">${esc(dmy(x.order_date))}</span></div>
  <div class="ocu"><div>${esc(x.phone)} ${x.phone?`<a href="https://wa.me/${esc(String(x.phone).replace(/\D/g,"").replace(/^0/,"20"))}" target="_blank" rel="noopener">واتساب</a>`:""}</div><div>${esc(x.governorate?x.governorate+" - ":"")}${esc(x.address)}</div></div>
  <div class="oi">${its.map(i=>`<div class="ol">${imgOf(i)?`<img src="${esc(imgOf(i))}" alt="" loading="lazy">`:`<span class="noimg"></span>`}<div class="oln">${esc(i.product_name)}</div><div class="olq" dir="ltr">${i.qty} × ${fmt(i.unit_price)}</div><div class="olt">${fmt(Number(i.qty)*Number(i.unit_price))}</div></div>`).join("")}</div>
  ${x.notes?`<div class="hint">ملاحظة العميل: ${esc(x.notes)}</div>`:""}${x.admin_notes?`<div class="hint">ملاحظتي: ${esc(x.admin_notes)}</div>`:""}
  ${payBlock(x)}
  <div class="osum"><div><span>ثمن المنتجات</span><b>${fmt(sub)} جنيه</b></div><div><span>الشحن على العميل</span><b>${fmt(ship)} جنيه</b></div><div class="tt"><span>الإجمالي</span><b>${fmt(x.total)} جنيه</b></div></div>
  <div class="oact"><select class="st" data-id="${esc(x.id)}" style="border-color:${esc(s.color)}">${D.statuses.map(t=>`<option value="${esc(t.id)}" ${t.id===x.status_id?"selected":""}>${esc(t.name)}</option>`).join("")}</select>
  <button class="sm" data-inv="${esc(x.id)}">تحميل الفاتورة PDF</button><button class="sm gray" data-e="${esc(x.id)}">تعديل</button><button class="sm red" data-d="${esc(x.id)}">حذف</button></div></div>`}).join("")||"<p>لا توجد طلبات</p>"}
 ${list.length>100?`<p>يظهر أحدث 100 طلب. استخدم الفلاتر أو التصدير.</p>`:""}</div>`;
 wireItems();totalManual=!!editO;$("ot").oninput=()=>{totalManual=true};
 $("onew").onclick=()=>{editO=null;showForm=true;ordersView();scrollTo(0,0)};
 $("oadd").onclick=()=>{$("items").insertAdjacentHTML("beforeend",itemRow());wireItems()};
 $("ocancel").onclick=()=>{editO=null;showForm=false;ordersView()};$("osave").onclick=saveOrder;
 ["of","og","od1","od2"].forEach(i=>$(i).onchange=ordersView);$("oq").oninput=()=>{const pos=$("oq").selectionStart;ordersView();$("oq").focus();$("oq").setSelectionRange(pos,pos)};
 $("ocsv").onclick=()=>csv("orders-"+today()+".csv",[["رقم","التاريخ","العميل","الموبايل","المحافظة","العنوان","المنتجات","الإجمالي","تكلفة المنتجات","الشحن علينا","الربح","الحالة","المصدر","ملاحظات"],...filteredOrders().map(x=>[x.order_no,dmy(x.order_date),x.customer_name,x.phone,x.governorate,x.address,(x.order_items||[]).map(i=>i.product_name+" × "+i.qty).join(" | "),x.total,itemsCost(x),x.shipping_cost,orderProfit(x),(stOf(x.status_id)||{}).name,x.source,[x.notes,x.admin_notes].filter(Boolean).join(" / ")])]);
 document.querySelectorAll(".st").forEach(s=>s.onchange=async()=>{const {error}=await sb.from("orders").update({status_id:s.value}).eq("id",s.dataset.id);if(error)return alert(error.message);D.orders.find(x=>x.id===s.dataset.id).status_id=s.value;drawNav();ordersView()});
 document.querySelectorAll("#sv [data-inv]").forEach(b=>b.onclick=async()=>{const x=D.orders.find(y=>y.id===b.dataset.inv),t0=b.textContent;b.disabled=true;b.textContent="جاري تجهيز الفاتورة...";try{const {data}=await sb.auth.getSession();const r=await fetch("/api/notify-order",{method:"POST",headers:{Authorization:"Bearer "+data.session.access_token,"Content-Type":"application/json"},body:JSON.stringify({order_id:x.id})});if(!r.ok)throw new Error("فشل تجهيز الفاتورة ("+r.status+")");const u=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=u;a.download="invoice-"+x.order_no+".pdf";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}catch(e){alert(e.message||"فشل")}b.disabled=false;b.textContent=t0});
 document.querySelectorAll("#sv [data-pay]").forEach(b=>b.onclick=async()=>{const x=D.orders.find(y=>y.id===b.dataset.pay),v=x.payment_status==="paid"?"pending":"paid";if(v==="paid"&&!confirm("تأكيد إنك استلمت مبلغ الطلب #"+x.order_no+" ("+fmt(x.total)+" جنيه)؟"))return;const {error}=await sb.from("orders").update({payment_status:v}).eq("id",x.id);if(error)return alert(error.message);x.payment_status=v;ordersView()});
 document.querySelectorAll("#sv [data-proof]").forEach(b=>b.onclick=async()=>{const {data,error}=await sb.storage.from("payment-proofs").createSignedUrl(b.dataset.proof,600);if(error)return alert("تعذر فتح الصورة: "+error.message);b.closest(".oact").insertAdjacentHTML("afterend",`<a href="${esc(data.signedUrl)}" target="_blank" rel="noopener"><img class="proof" src="${esc(data.signedUrl)}" alt="صورة التحويل"></a>`);b.remove()});
 document.querySelectorAll("#sv [data-e]").forEach(b=>b.onclick=()=>{editO=D.orders.find(x=>x.id===b.dataset.e);showForm=true;ordersView();scrollTo(0,0)});
 document.querySelectorAll("#sv [data-d]").forEach(b=>b.onclick=async()=>{const x=D.orders.find(y=>y.id===b.dataset.d);if(!confirm("حذف الطلب #"+x.order_no+"؟"))return;const {error}=await sb.from("orders").delete().eq("id",x.id);if(error)return alert(error.message);D.orders=D.orders.filter(y=>y!==x);drawNav();ordersView()});
}
async function saveOrder(){
 flash("om","جاري الحفظ...",true);
 try{
  const items=[...document.querySelectorAll(".item")].map(r=>({product_id:r.querySelector(".in-name").dataset.pid||null,product_name:r.querySelector(".in-name").value.trim(),qty:Math.max(1,parseInt(r.querySelector(".in-qty").value)||1),unit_price:num(r.querySelector(".in-price").value),unit_cost:num(r.querySelector(".in-cost").value)})).filter(i=>i.product_name);
  const row={customer_name:$("oc").value.trim(),phone:$("oph").value.trim(),governorate:$("ogv").value||null,address:$("oa").value.trim(),notes:$("on").value.trim(),admin_notes:$("oan").value.trim()||null,status_id:$("os").value||null,order_date:pdmy($("odt").value)||today(),total:num($("ot").value),shipping_cost:num($("osh").value)};
  if(!row.customer_name)return flash("om","اسم العميل مطلوب");if(!items.length)return flash("om","أضف منتج واحد على الأقل");
  let id,oldIds=[];
  if(editO){id=editO.id;oldIds=(editO.order_items||[]).map(i=>i.id);const {error}=await sb.from("orders").update(row).eq("id",id);if(error)throw error}
  else{const {data,error}=await sb.from("orders").insert(row).select("id").single();if(error)throw error;id=data.id}
  const {error:ie}=await sb.from("order_items").insert(items.map(i=>({...i,order_id:id})));if(ie)throw ie;
  if(oldIds.length){const {error}=await sb.from("order_items").delete().in("id",oldIds);if(error)throw error}
  const {data:fresh,error:fe}=await sb.from("orders").select("*,order_items(*)").eq("id",id).single();if(fe)throw fe;
  const k=D.orders.findIndex(x=>x.id===id);if(k>=0)D.orders[k]=fresh;else D.orders.unshift(fresh);
  editO=null;showForm=false;drawNav();ordersView();
 }catch(e){flash("om","خطأ: "+e.message)}
}
const WST=["جديد","تم التواصل","تم الاتفاق","مرفوض"];
function whView(){
 $("sv").innerHTML=`<div class="box">${D.wholesale.map(w=>`<div class="ord"><div class="h"><b>${esc(w.name)}</b><span>${esc(String(w.created_at).slice(0,10))}</span></div><div>${esc(w.phone)} <a href="https://wa.me/${esc(w.phone.replace(/\D/g,"").replace(/^0/,"20"))}" target="_blank" rel="noopener">واتساب</a> ${w.business?" - "+esc(w.business):""} ${w.governorate?" - "+esc(w.governorate):""}</div><div style="white-space:pre-wrap">${esc(w.message)}</div>
 <div class="row" style="margin-top:6px"><select data-ws="${esc(w.id)}">${WST.map(s=>`<option ${s===w.status?"selected":""}>${s}</option>`).join("")}</select><input data-wn="${esc(w.id)}" placeholder="ملاحظاتي" value="${esc(w.notes)}"><button class="sm red" data-wd="${esc(w.id)}">حذف</button></div></div>`).join("")||"<p>لا توجد طلبات جملة بعد. الصفحة: /wholesale</p>"}</div>`;
 const upd=async(id,v)=>{const {error}=await sb.from("wholesale_requests").update(v).eq("id",id);if(error)return alert(error.message);Object.assign(D.wholesale.find(x=>x.id===id),v);drawNav()};
 document.querySelectorAll("[data-ws]").forEach(s=>s.onchange=()=>upd(s.dataset.ws,{status:s.value}).then(V.orders));
 document.querySelectorAll("[data-wn]").forEach(s=>s.onchange=()=>upd(s.dataset.wn,{notes:s.value}));
 document.querySelectorAll("[data-wd]").forEach(b=>b.onclick=async()=>{if(!confirm("حذف الطلب؟"))return;const {error}=await sb.from("wholesale_requests").delete().eq("id",b.dataset.wd);if(error)return alert(error.message);D.wholesale=D.wholesale.filter(x=>x.id!==b.dataset.wd);drawNav();V.orders()});
}

/* ---------- reports ---------- */
let rf="",rt="",rinit=false;const monthStart=()=>today().slice(0,8)+"01";
V.reports=()=>{
 if(!rinit){rf=monthStart();rt=today();rinit=true}
 const ok=D.orders.filter(o=>(stOf(o.status_id)||{counts_in_profit:true}).counts_in_profit&&(!rf||o.order_date>=rf)&&(!rt||o.order_date<=rt));
 const rev=ok.reduce((a,o)=>a+Number(o.total),0),cost=ok.reduce((a,o)=>a+itemsCost(o),0),ship=ok.reduce((a,o)=>a+Number(o.shipping_cost),0),profit=rev-cost-ship;
 const grp=kf=>{const m={};ok.forEach(o=>{const k=kf(o),g=m[k]||(m[k]={n:0,rev:0,pf:0});g.n++;g.rev+=Number(o.total);g.pf+=orderProfit(o)});return Object.entries(m).sort((a,b)=>b[0].localeCompare(a[0]))};
 const pm={};ok.forEach(o=>(o.order_items||[]).forEach(i=>{const k=i.product_id||i.product_name,g=pm[k]||(pm[k]={name:i.product_name,q:0,rev:0,pf:0});g.q+=i.qty;g.rev+=i.qty*Number(i.unit_price);g.pf+=i.qty*(Number(i.unit_price)-Number(i.unit_cost))}));
 const pl=Object.values(pm),tbl=(rows,h)=>`<div class="scroll"><table><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr>${rows.join("")||`<tr><td colspan=${h.length}>لا توجد بيانات</td></tr>`}</table></div>`;
 const days=grp(o=>o.order_date),months=grp(o=>o.order_date.slice(0,7));
 $("view").innerHTML=`<div class="box"><div class="row"><div><label>من</label>${dIn("rf",dmy(rf))}</div><div><label>إلى</label>${dIn("rt",dmy(rt))}</div></div>
 <button class="sm gray" id="r1">هذا الشهر</button> <button class="sm gray" id="r2">آخر 30 يوم</button> <button class="sm gray" id="r3">الكل</button> <button class="sm" id="rcsv">تصدير التقرير CSV</button>
 <p class="hint">الربح = إجمالي الطلب - تكلفة المنتجات - تكلفة الشحن. الحالات غير المحسوبة: ${esc(D.statuses.filter(s=>!s.counts_in_profit).map(s=>s.name).join("، "))||"لا يوجد"} (من الإعدادات).</p></div>
 <div class="stat"><div>الطلبات<b>${ok.length}</b></div><div>المبيعات<b>${fmt(rev)}</b></div><div>التكلفة<b>${fmt(cost)}</b></div><div>الشحن<b>${fmt(ship)}</b></div><div>صافي الربح<b class="${profit>=0?"pos":"neg"}">${fmt(profit)}</b></div></div>
 <div class="box" style="margin-top:14px"><h3>حسب اليوم</h3>${tbl(days.slice(0,60).map(([k,g])=>`<tr><td dir="ltr">${dmy(k)}</td><td>${g.n}</td><td>${fmt(g.rev)}</td><td>${fmt(g.pf)}</td></tr>`),["اليوم","الطلبات","المبيعات","الربح"])}</div>
 <div class="box"><h3>حسب الشهر</h3>${tbl(months.map(([k,g])=>`<tr><td>${k}</td><td>${g.n}</td><td>${fmt(g.rev)}</td><td>${fmt(g.pf)}</td></tr>`),["الشهر","الطلبات","المبيعات","الربح"])}</div>
 <div class="box"><h3>الأكثر مبيعاً</h3>${tbl(pl.slice().sort((a,b)=>b.q-a.q).slice(0,10).map(g=>`<tr><td>${esc(g.name)}</td><td>${g.q}</td><td>${fmt(g.rev)}</td><td>${fmt(g.pf)}</td></tr>`),["المنتج","الكمية","المبيعات","الربح"])}</div>
 <div class="box"><h3>الأكثر ربحاً</h3>${tbl(pl.slice().sort((a,b)=>b.pf-a.pf).slice(0,10).map(g=>`<tr><td>${esc(g.name)}</td><td>${g.q}</td><td>${fmt(g.rev)}</td><td>${fmt(g.pf)}</td></tr>`),["المنتج","الكمية","المبيعات","الربح"])}</div>`;
 const set=(a,b)=>{rf=a;rt=b;V.reports()};
 $("rf").onchange=()=>set(pdmy($("rf").value),pdmy($("rt").value));$("rt").onchange=()=>set(pdmy($("rf").value),pdmy($("rt").value));
 $("r1").onclick=()=>set(monthStart(),today());$("r2").onclick=()=>set(new Date(Date.now()-30*864e5).toISOString().slice(0,10),today());$("r3").onclick=()=>set("","");
 $("rcsv").onclick=()=>csv("report-"+today()+".csv",[["ملخص","الطلبات",ok.length,"المبيعات",rev,"التكلفة",cost,"الشحن",ship,"الربح",profit],[],["اليوم","الطلبات","المبيعات","الربح"],...days.map(([k,g])=>[dmy(k),g.n,g.rev,g.pf]),[],["الشهر","الطلبات","المبيعات","الربح"],...months.map(([k,g])=>[k,g.n,g.rev,g.pf]),[],["المنتج","الكمية","المبيعات","الربح"],...pl.sort((a,b)=>b.q-a.q).map(g=>[g.name,g.q,g.rev,g.pf])]);
};

/* ---------- store look (everything on the home page) ---------- */
const SECS={intro:"شريط التعريف بالمتجر",reviews:"آراء العملاء",catsecs:"أقسام المنتجات (التي تختارها)",trust:"شريط المميزات (الدفع عند الاستلام...)",categories:"الأقسام",featured:"المنتجات المميزة",latest:"أحدث المنتجات",about:"نبذة عن المتجر"};
let layout=null;
const getLayout=()=>{if(layout)return layout;let j=[];try{j=JSON.parse(setting("home_layout"))}catch(e){}const keys=Object.keys(SECS);j=(Array.isArray(j)?j:[]).filter(x=>SECS[x.k]);const NEWK=["intro","reviews","catsecs"],front=[];keys.forEach(k=>{if(!j.some(x=>x.k===k))(NEWK.includes(k)?front:j).push({k,on:true})});j=[...front,...j];return layout=j};
let lookSub=null;
const INTRO_DEF="متخصصون في توفير جميع أدوات ورفايع المطبخ العصرية بأسعار الجملة الحقيقية من أول قطعة، نجمع لك بين الجودة والخامات والتوفير العالي بدون حد أدنى للشراء.";
const LK=[["logo","🏷️","اللوجو","رفع اللوجو، حجمه، أيقونة المتجر"],["colors","🎨","الألوان","ألوان المتجر والأزرار والخلفية"],["fonts","🔤","الخطوط","اختر خطاً عربياً مع معاينة"],["ticker","📢","شريط الإعلانات","الشريط المتحرك أعلى الموقع"],["hero","🖼️","سلايدر البانر","صور متعددة وأزرار بنصك"],["product","🛍️","عرض المنتجات والقائمة","شكل الكروت وقائمة الأقسام"],["home","🏠","أقسام الصفحة الرئيسية","التعريف، آراء العملاء، أقسام المنتجات، المميزات"],["footer","📄","الفوتر","نص أسفل الموقع"],["contact","📞","بيانات التواصل","واتساب، هاتف، إيميل، عنوان"],["social","🔗","شبكات التواصل","فيسبوك، إنستجرام، تيك توك..."]];
const jparse=(k)=>{try{const a=JSON.parse(D.settings[k]||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}};
const mvArr=(a,i,d)=>{const j=i+d;if(j<0||j>=a.length)return false;[a[i],a[j]]=[a[j],a[i]];return true};
const wire=(root,sel,fn)=>root.querySelectorAll(sel).forEach(fn);
let lkTab="order",lkTabs="";
const homeTabs=cur=>{lkTab=cur;lkTabs=`<div class="sub">${[["order","الترتيب"],["intro","شريط التعريف"],["reviews","آراء العملاء"],["cats","أقسام المنتجات"],["trust","المميزات"]].map(t=>`<button type="button" data-ht="${t[0]}" class="${t[0]===cur?"on":""}">${t[1]}</button>`).join("")}</div>`};
function lkPage(title,inner,init,extra,save){
 $("view").innerHTML=`<div id="lk"><p><button class="sm gray" id="lkback" type="button">← رجوع لمظهر المتجر</button></p><h2 style="margin:6px 0 12px">${title}</h2>${lkTabs}${inner}<button id="lsave">${save||"حفظ"}</button> <span id="lm"></span></div>`;
 lkTabs="";wire($("lk"),"[data-ht]",b=>b.onclick=()=>{lkTab=b.dataset.ht;V.look()});
 $("lkback").onclick=()=>{lookSub=null;V.look()};
 init&&init();
 $("lsave").onclick=()=>{const chk=extra&&extra.check&&extra.check();if(chk)return flash("lm",chk);saveBlock($("lk"),"lm",extra&&extra.rows).then(ok=>{if(ok&&extra&&extra.after)extra.after()})};
}
V.look=()=>{
 if(!lookSub){layout=null;lkTab="order";$("view").innerHTML=`<p class="hint">اختر الجزء الذي تريد تعديله. كل جزء له صفحته وزر حفظ خاص به.</p><div class="grid2">${LK.map(c=>`<button class="box lkc" data-lk="${c[0]}" type="button" style="text-align:right;cursor:pointer;background:#fff;color:inherit;border:1px solid var(--line);margin:0"><div style="font-size:28px">${c[1]}</div><b>${c[2]}</b><div class="hint" style="margin:4px 0 0">${c[3]}</div></button>`).join("")}</div>`;
  wire($("view"),"[data-lk]",b=>b.onclick=()=>{lookSub=b.dataset.lk;V.look();scrollTo(0,0)});return}
 LKP[lookSub]();
};
const LKP={
 ticker(){
  const TK=jparse("ticker_items").map(String);if(!TK.length)TK.push("");
  lkPage("شريط الإعلانات المتحرك",`<div class="box"><p class="hint">رسائل تتحرك باستمرار فوق الهيدر من اليمين لليسار، وتتوقف عند اللمس. اكتب ما تريد بنفسك. الشريط متوقف افتراضياً حتى تفعّله.</p>
  <label><input type="checkbox" id="tkon" ${D.settings.ticker_on==="1"?"checked":""} style="width:auto"> تشغيل الشريط</label>
  <div id="tkl"></div><button class="sm gray" id="tkadd" type="button">+ رسالة جديدة</button>
  <div class="row"><div><label>السرعة</label><select data-k="ticker_speed">${[["1","بطيئة"],["2","متوسطة"],["3","سريعة"]].map(o=>`<option value="${o[0]}" ${(D.settings.ticker_speed||"2")===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select></div>${F([["ticker_bg","لون الخلفية","color"],["ticker_fg","لون النص","color"]])}</div>
  <label><input type="checkbox" id="tkdef" style="width:auto" ${D.settings.ticker_bg?"":"checked"}> استخدام ألوان المتجر الأساسية بدل الألوان أعلاه</label></div>`,
  ()=>{const draw=()=>{$("tkl").innerHTML=TK.map((t,i)=>`<div class="lay"><input data-tk="${i}" value="${esc(t)}" maxlength="140" placeholder="اكتب رسالة الشريط هنا"><button class="sm gray" data-tu="${i}" type="button">▲</button><button class="sm gray" data-td="${i}" type="button">▼</button><button class="sm red" data-tx="${i}" type="button">حذف</button></div>`).join("");
    wire($("tkl"),"[data-tk]",e=>e.oninput=()=>{TK[+e.dataset.tk]=e.value});
    wire($("tkl"),"[data-tu]",b=>b.onclick=()=>{if(mvArr(TK,+b.dataset.tu,-1))draw()});wire($("tkl"),"[data-td]",b=>b.onclick=()=>{if(mvArr(TK,+b.dataset.td,1))draw()});
    wire($("tkl"),"[data-tx]",b=>b.onclick=()=>{TK.splice(+b.dataset.tx,1);draw()})};
   $("tkadd").onclick=()=>{TK.push("");draw()};draw()},
  {rows:()=>{const r=[{key:"ticker_items",value:JSON.stringify(TK.map(t=>t.trim()).filter(Boolean))},{key:"ticker_on",value:$("tkon").checked?"1":"0"}];if($("tkdef").checked)r.push({key:"ticker_bg",value:""},{key:"ticker_fg",value:""});return r}})},
 hero(){
  const SL=jparse("hero_slides").map(x=>({img:x.img||"",img2:x.img2||"",alt:x.alt||"",btns:(x.btns||[]).slice(0,2).map(b=>({text:b.text||"",link:b.link||""}))}));
  const isKnown=v=>v==="/"||v==="/products"||v==="/wholesale"||D.cats.some(c=>c.slug&&"/c/"+c.slug===v);
  const linkOpts=sel=>{const base=[["/","الصفحة الرئيسية"],["/products","كل المنتجات"],["/wholesale","طلب جملة"]].concat(D.cats.filter(c=>c.slug).map(c=>["/c/"+c.slug,"قسم: "+c.name]));
   const known=base.some(o=>o[0]===sel);return base.map(o=>`<option value="${esc(o[0])}" ${o[0]===sel?"selected":""}>${esc(o[1])}</option>`).join("")+`<option value="__custom" ${sel&&!known?"selected":""}>رابط آخر...</option>`};
  lkPage("سلايدر البانر",`<div class="box"><p class="hint">كل شريحة: صورة + زر أو زرين بنص من اختيارك ووجهة تختارها. تتحرك تلقائياً وتتوقف عند اللمس، ويمكن سحبها بالإصبع. الصورة الأساسية مربعة للموبايل (يفضّل 1080×1080)، وصورة الكمبيوتر العريضة اختيارية (يفضّل 1920×720).</p><div id="hsl"></div><button class="sm gray" id="hsadd" type="button">+ شريحة جديدة</button>
   <div class="row"><div><label>ثواني بقاء كل شريحة (1 إلى 10)</label><input data-k="hero_interval" inputmode="decimal" value="${esc(D.settings.hero_interval||"2")}"></div></div></div>
   <div class="box"><h3>البانر البسيط (يظهر فقط عند عدم وجود شرائح)</h3>${F([["hero_title","العنوان"],["hero_subtitle","النص"]])}<div class="row">${F([["hero_cta_text","نص الزر"],["hero_cta_link","رابط الزر (مثال /products)","ltr"],["hero_image_url","صورة البانر","img"]])}</div></div>`,
  ()=>{const draw=()=>{$("hsl").innerHTML=SL.map((s,i)=>`<div class="lay" style="display:block"><div class="row" style="align-items:center"><b>شريحة ${i+1}</b><span>${s.img?`<img src="${esc(s.img)}" height="44" alt="">`:"بدون صورة"}</span><button class="sm gray" data-su="${i}" type="button">▲</button><button class="sm gray" data-sd="${i}" type="button">▼</button><button class="sm red" data-sx="${i}" type="button">حذف</button></div>
    <label>الصورة (مربعة للموبايل)</label><input type="file" accept="image/*" data-si="${i}">
    <label>صورة الكمبيوتر العريضة (اختيارية) ${s.img2?`<img src="${esc(s.img2)}" height="30" alt=""> <button class="sm gray" data-s2x="${i}" type="button">إزالة</button>`:""}</label><input type="file" accept="image/*" data-s2="${i}">
    ${[0,1].map(j=>{const b=s.btns[j];if(!b)return j===0||s.btns[0]?`<button class="sm gray" data-sb="${i}" type="button">+ إضافة زر</button>`:"";
     const known=isKnown(b.link)||!b.link;return `<div class="row"><div><label>نص الزر ${j+1}</label><input data-bt="${i}:${j}" value="${esc(b.text)}" maxlength="40"></div><div><label>الوجهة</label><select data-bl="${i}:${j}">${linkOpts(b.link||"/products")}</select><input data-bc="${i}:${j}" dir="ltr" placeholder="/page أو https://..." value="${known?"":esc(b.link)}" style="${known?"display:none":""}"></div><button class="sm red" data-bx="${i}:${j}" type="button">×</button></div>`}).join("")}</div>`).join("")||'<p class="hint">لا توجد شرائح بعد.</p>';
   const q=(s,f)=>wire($("hsl"),s,f);
   q("[data-su]",b=>b.onclick=()=>{if(mvArr(SL,+b.dataset.su,-1))draw()});q("[data-sd]",b=>b.onclick=()=>{if(mvArr(SL,+b.dataset.sd,1))draw()});
   q("[data-sx]",b=>b.onclick=()=>{SL.splice(+b.dataset.sx,1);draw()});q("[data-s2x]",b=>b.onclick=()=>{SL[+b.dataset.s2x].img2="";draw()});
   q("[data-sb]",b=>b.onclick=()=>{SL[+b.dataset.sb].btns.push({text:"",link:"/products"});draw()});
   q("[data-bx]",b=>b.onclick=()=>{const [i,j]=b.dataset.bx.split(":").map(Number);SL[i].btns.splice(j,1);draw()});
   q("[data-bt]",e=>e.oninput=()=>{const [i,j]=e.dataset.bt.split(":").map(Number);SL[i].btns[j].text=e.value});
   q("[data-bl]",e=>{const [i,j]=e.dataset.bl.split(":").map(Number);if(e.value!=="__custom"&&!SL[i].btns[j].link)SL[i].btns[j].link=e.value;
    e.onchange=()=>{const c=document.querySelector(`#hsl [data-bc="${i}:${j}"]`);if(e.value==="__custom"){c.style.display="";SL[i].btns[j].link=c.value}else{c.style.display="none";SL[i].btns[j].link=e.value}}});
   q("[data-bc]",e=>e.oninput=()=>{const [i,j]=e.dataset.bc.split(":").map(Number);SL[i].btns[j].link=e.value.trim()});
   const up=(attr,field)=>q("["+attr+"]",e=>e.onchange=async()=>{const f=e.files[0];if(!f)return;flash("lm","جاري رفع الصورة...",true);try{const sm=await shrink(f);SL[+e.getAttribute(attr)][field]=await upload(sm,"hero");draw();flash("lm","تم رفع الصورة. اضغط حفظ.",true)}catch(x){flash("lm","فشل رفع الصورة")}});
   up("data-si","img");up("data-s2","img2")};
   $("hsadd").onclick=()=>{SL.push({img:"",img2:"",alt:"",btns:[]});draw()};draw()},
  {check:()=>{for(const [i,s] of SL.entries()){if(!s.img)return "الشريحة "+(i+1)+" بدون صورة. ارفع صورة أو احذفها.";
     for(const b of s.btns){if(!b.text.trim()||!b.link)return "الشريحة "+(i+1)+": اكتب نص الزر أو احذفه.";if(!/^(\/(?!\/)|https:\/\/)/.test(b.link))return "الشريحة "+(i+1)+": الرابط لازم يبدأ بـ / أو https://"}}
    const e=$("lk").querySelector('[data-k="hero_interval"]');e.value=String(Math.min(10,Math.max(1,num(e.value)||2)))},
   rows:()=>[{key:"hero_slides",value:JSON.stringify(SL.map(s=>({img:s.img,img2:s.img2,alt:s.alt,btns:s.btns.map(b=>({text:b.text.trim(),link:b.link}))})))}]})},
 intro(){
  homeTabs("intro");lkPage("شريط التعريف بالمتجر",`<div class="box"><p class="hint">شريط ملوّن متحرك تحت البانر. عدّل النص كما تريد أو أوقفه.</p><label><input type="checkbox" id="ion" ${D.settings.intro_on==="0"?"":"checked"} style="width:auto"> إظهار الشريط</label>
   <label>النص</label><textarea data-k="intro_text" rows="4" maxlength="400">${esc(D.settings.intro_text===undefined?INTRO_DEF:D.settings.intro_text)}</textarea></div>`,null,{rows:()=>[{key:"intro_on",value:$("ion").checked?"1":"0"}]})},
 reviews(){
  homeTabs("reviews");const RV=jparse("reviews").map(x=>({img:x.img||"",name:x.name||"",text:x.text||""}));
  lkPage("آراء العملاء",`<div class="box"><p class="hint">ارفع صور محادثات واتساب أو أي صور، أو اكتب الرأي بنفسك. تظهر كشرائط قابلة للسحب. لا يوجد أي رأي جاهز، والقسم يختفي إن كان فارغاً.</p>
   <label>عنوان القسم</label><input data-k="reviews_title" value="${esc(D.settings.reviews_title===undefined?"آراء عملائنا":D.settings.reviews_title)}" maxlength="80"><div id="rvl"></div><button class="sm gray" id="rvadd" type="button">+ رأي جديد</button></div>`,
  ()=>{const draw=()=>{$("rvl").innerHTML=RV.map((r,i)=>`<div class="lay" style="display:block"><div class="row" style="align-items:center"><b>${i+1}</b><span>${r.img?`<img src="${esc(r.img)}" height="56" alt="">`:""}</span><button class="sm gray" data-ru="${i}" type="button">▲</button><button class="sm gray" data-rd="${i}" type="button">▼</button><button class="sm red" data-rx="${i}" type="button">حذف</button></div>
    <label>صورة (اختيارية) ${r.img?`<button class="sm gray" data-rix="${i}" type="button">إزالة الصورة</button>`:""}</label><input type="file" accept="image/*" data-ri="${i}">
    <label>اسم العميل (اختياري)</label><input data-rn="${i}" value="${esc(r.name)}" maxlength="60"><label>نص الرأي (اختياري)</label><textarea data-rt="${i}" rows="2" maxlength="500">${esc(r.text)}</textarea></div>`).join("")||'<p class="hint">لا توجد آراء بعد.</p>';
   const q=(s,f)=>wire($("rvl"),s,f);
   q("[data-ru]",b=>b.onclick=()=>{if(mvArr(RV,+b.dataset.ru,-1))draw()});q("[data-rd]",b=>b.onclick=()=>{if(mvArr(RV,+b.dataset.rd,1))draw()});
   q("[data-rx]",b=>b.onclick=()=>{RV.splice(+b.dataset.rx,1);draw()});q("[data-rix]",b=>b.onclick=()=>{RV[+b.dataset.rix].img="";draw()});
   q("[data-rn]",e=>e.oninput=()=>{RV[+e.dataset.rn].name=e.value});q("[data-rt]",e=>e.oninput=()=>{RV[+e.dataset.rt].text=e.value});
   q("[data-ri]",e=>e.onchange=async()=>{const f=e.files[0];if(!f)return;flash("lm","جاري رفع الصورة...",true);try{const sm=await shrink(f);RV[+e.dataset.ri].img=await upload(sm,"reviews");draw();flash("lm","تم رفع الصورة. اضغط حفظ.",true)}catch(x){flash("lm","فشل رفع الصورة")}})};
   $("rvadd").onclick=()=>{RV.push({img:"",name:"",text:""});draw()};draw()},
  {check:()=>{const i=RV.findIndex(r=>!r.img&&!r.text.trim());if(i>=0)return "الرأي "+(i+1)+" فارغ. أضف صورة أو نصاً أو احذفه."},rows:()=>[{key:"reviews",value:JSON.stringify(RV.map(r=>({img:r.img,name:r.name.trim(),text:r.text.trim()})))}]})},
 home(){({order:LKP.h_order,trust:LKP.h_trust,intro:LKP.intro,reviews:LKP.reviews,cats:LKP.h_cats}[lkTab]||LKP.h_order)()},
 h_order(){
  homeTabs("order");layout=null;const Ly=getLayout();
  lkPage("ترتيب أقسام الصفحة الرئيسية",`<div class="box"><p class="hint">أظهر/أخفِ ورتّب. ترتيب الصفحة من أعلى: الشريط المتحرك، الهيدر، البانر، ثم هذه الأقسام بالترتيب الذي تختاره.</p><div id="lay"></div></div>`,
  ()=>{const draw=()=>{$("lay").innerHTML=Ly.map((x,i)=>`<div class="lay"><input type="checkbox" data-on="${i}" ${x.on?"checked":""}><span>${SECS[x.k]}</span><button class="sm gray" data-u="${i}" type="button">▲</button><button class="sm gray" data-w="${i}" type="button">▼</button></div>`).join("");
    wire($("lay"),"[data-on]",c=>c.onchange=()=>{Ly[+c.dataset.on].on=c.checked});wire($("lay"),"[data-u]",b=>b.onclick=()=>{if(mvArr(Ly,+b.dataset.u,-1))draw()});wire($("lay"),"[data-w]",b=>b.onclick=()=>{if(mvArr(Ly,+b.dataset.w,1))draw()})};draw()},
  {rows:()=>[{key:"home_layout",value:JSON.stringify(Ly)}],after:()=>{layout=null}})},
 h_cats(){
  homeTabs("cats");
  let CS=jparse("home_cat_sections").filter(x=>x&&D.cats.some(c=>c.slug===x.slug)).map(x=>({slug:x.slug,on:true,n:+x.n||8}));
  D.cats.filter(c=>c.slug&&!CS.some(x=>x.slug===c.slug)).forEach(c=>CS.push({slug:c.slug,on:false,n:8}));
  lkPage("أقسام المنتجات في الرئيسية",`<div class="box"><p class="hint">اختر الأقسام (مطبخ، الأكثر رواجاً، تنظيف، أجهزة كهربائية...) التي تظهر منتجاتها في الصفحة الرئيسية، ورتّبها، وحدد عدد المنتجات لكل قسم. تُضاف الأقسام من شاشة "الأقسام".</p><div id="csl"></div></div>`,
  ()=>{const nm=s=>(D.cats.find(c=>c.slug===s)||{}).name||s;
   const d2=()=>{$("csl").innerHTML=CS.map((x,i)=>`<div class="lay"><input type="checkbox" data-co="${i}" ${x.on?"checked":""}><span>${esc(nm(x.slug))}</span><select data-cn="${i}" style="width:auto;margin:0">${[4,6,8,12].map(n=>`<option ${n===x.n?"selected":""}>${n}</option>`).join("")}</select><button class="sm gray" data-cu="${i}" type="button">▲</button><button class="sm gray" data-cd="${i}" type="button">▼</button></div>`).join("")||'<p class="hint">أضف أقساماً من شاشة الأقسام أولاً.</p>';
    wire($("csl"),"[data-co]",c=>c.onchange=()=>{CS[+c.dataset.co].on=c.checked});wire($("csl"),"[data-cn]",c=>c.onchange=()=>{CS[+c.dataset.cn].n=+c.value});
    wire($("csl"),"[data-cu]",b=>b.onclick=()=>{if(mvArr(CS,+b.dataset.cu,-1))d2()});wire($("csl"),"[data-cd]",b=>b.onclick=()=>{if(mvArr(CS,+b.dataset.cd,1))d2()})};d2()},
  {rows:()=>[{key:"home_cat_sections",value:JSON.stringify(CS.filter(x=>x.on).map(x=>({slug:x.slug,n:x.n})))}]})},
 h_trust(){
  homeTabs("trust");
  lkPage("شريط المميزات",`<div class="box"><p class="hint">مربعات صغيرة في الصفحة الرئيسية. اترك العنوان فارغاً لإخفاء المربع. اكتب فقط ما هو صحيح فعلاً في متجرك.</p>${[1,2,3,4].map(n=>`<div class="row"><div>${F([["trust"+n+"_t","عنوان "+n]])}</div><div>${F([["trust"+n+"_d","وصف "+n]])}</div></div>`).join("")}</div>`)},
 logo(){
  lkPage("اللوجو",`<div class="box">${F([["logo_url","اللوجو (يظهر في أعلى المتجر)","img"]])}
   <label>حجم اللوجو</label><select data-k="logo_size">${[["s","صغير"],["m","متوسط"],["l","كبير"]].map(o=>`<option value="${o[0]}" ${(D.settings.logo_size||"m")===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select>
   ${F([["favicon_url","أيقونة المتجر (تظهر في تبويب المتصفح، مربعة، يفضّل 256×256)","img"]])}
   <p class="hint">إن لم ترفع أيقونة يُستخدم اللوجو. اسم المتجر والشعار النصي يُعدّلان من الإعدادات.</p>${F([["store_name","اسم المتجر"],["tagline","شعار نصي قصير"]])}</div>`)},
 colors(){
  lkPage("ألوان المتجر",`<div class="box"><div class="row">${F([["primary_color","اللون الأساسي (الهيدر والعناوين)","color"],["accent_color","لون الأزرار","color"],["bg_color","لون خلفية الصفحات","color"]])}</div>
   <label><input type="checkbox" id="bgdef" style="width:auto" ${D.settings.bg_color?"":"checked"}> استخدام خلفية المتجر الافتراضية الدافئة</label></div>`,null,{rows:()=>$("bgdef").checked?[{key:"bg_color",value:""}]:[]})},
 fonts(){
  const FN=[["Cairo","Cairo"],["Tajawal","Tajawal"],["Almarai","Almarai"],["IBM Plex Sans Arabic","IBM Plex Sans Arabic"],["Noto Kufi Arabic","Noto Kufi Arabic"],["Changa","Changa"]];
  if(!document.getElementById("fontprev")){const l=document.createElement("link");l.id="fontprev";l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?"+["Cairo:wght@400;700","Tajawal:wght@400;700","Almarai:wght@400;700","IBM+Plex+Sans+Arabic:wght@400;700","Noto+Kufi+Arabic:wght@400;700","Changa:wght@400;700"].map(f=>"family="+f).join("&")+"&display=swap";document.head.appendChild(l)}
  const cur=FN.some(f=>f[0]===D.settings.font_family)?D.settings.font_family:"Cairo";
  lkPage("الخطوط",`<div class="box"><p class="hint">اختر الخط الذي يناسب متجرك. المعاينة بالأسفل بنفس شكل الخط، واضغط حفظ ليظهر في المتجر.</p>${FN.map(f=>`<label class="lay" style="cursor:pointer;display:block"><input type="radio" name="ff" value="${esc(f[0])}" ${f[0]===cur?"checked":""} style="width:auto"> <b>${esc(f[1])}</b><div style="font-family:'${esc(f[0])}',sans-serif;font-size:20px;margin-top:6px;line-height:1.7">أدوات مطبخ عصرية بأسعار الجملة الحقيقية<br><span style="font-size:15px">طقم أواني ١٢٣٤٥٦ - توصيل لجميع المحافظات</span></div></label>`).join("")}</div>`,null,{rows:()=>[{key:"font_family",value:document.querySelector('input[name=ff]:checked').value}]})},
 product(){
  const sel=(k,list,def)=>`<select data-k="${k}">${list.map(o=>`<option value="${o[0]}" ${(D.settings[k]||def)===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select>`;
  const NX=jparse("nav_extra").map(x=>({text:x.text||"",link:x.link||""}));
  lkPage("عرض المنتجات والقائمة الرئيسية",`<div class="box"><h3>شكل كروت المنتجات</h3>
   <label>عدد المنتجات في الصف على الموبايل</label>${sel("product_cols_mobile",[["2","منتجان بجانب بعض"],["1","منتج واحد كبير"]],"2")}
   <label>شكل صورة المنتج</label>${sel("card_img",[["sq","مربعة"],["tall","طولية (4:5)"]],"sq")}
   <label>حواف الكرت</label>${sel("card_radius",[["m","متوسطة"],["l","دائرية أكثر"],["s","حادة"]],"m")}
   <label>شارة نسبة الخصم</label>${sel("card_badge",[["1","إظهار"],["0","إخفاء"]],"1")}
   <label>سطر سعر الجملة / أقل كمية تحت السعر</label>${sel("card_tier",[["1","إظهار"],["0","إخفاء"]],"1")}</div>
   <div class="box"><h3>القائمة الرئيسية (شريط الأقسام)</h3><p class="hint">أقسام الشريط تُحدَّد من شاشة "الأقسام" (أماكن ظهور القسم). هنا التحكم العام وروابط إضافية.</p>
   <label>شريط الأقسام تحت البحث</label>${sel("nav_chips",[["1","إظهار"],["0","إخفاء"]],"1")}
   <label>رابط "طلب جملة" في الهيدر</label>${sel("nav_wholesale",[["1","إظهار"],["0","إخفاء"]],"1")}
   <label>روابط إضافية في الشريط (حتى 8)</label><div id="nxl"></div><button class="sm gray" id="nxadd" type="button">+ رابط</button></div>`,
  ()=>{const lo=sel=>{const base=[["/","الصفحة الرئيسية"],["/products","كل المنتجات"],["/wholesale","طلب جملة"]].concat(D.cats.filter(c=>c.slug).map(c=>["/c/"+c.slug,"قسم: "+c.name]));return base.map(o=>`<option value="${esc(o[0])}" ${o[0]===sel?"selected":""}>${esc(o[1])}</option>`).join("")};
   const d=()=>{$("nxl").innerHTML=NX.map((x,i)=>`<div class="lay"><input data-nt="${i}" value="${esc(x.text)}" maxlength="30" placeholder="النص"><select data-nl="${i}" style="margin:0">${lo(x.link||"/products")}</select><button class="sm red" data-nx="${i}" type="button">حذف</button></div>`).join("");
    wire($("nxl"),"[data-nt]",e=>e.oninput=()=>{NX[+e.dataset.nt].text=e.value});wire($("nxl"),"[data-nl]",e=>{if(!NX[+e.dataset.nl].link)NX[+e.dataset.nl].link=e.value;e.onchange=()=>{NX[+e.dataset.nl].link=e.value}});wire($("nxl"),"[data-nx]",b=>b.onclick=()=>{NX.splice(+b.dataset.nx,1);d()})};
   $("nxadd").onclick=()=>{if(NX.length<8){NX.push({text:"",link:"/products"});d()}};d()},
  {check:()=>NX.some(x=>!x.text.trim())?"اكتب نص كل رابط إضافي أو احذفه.":"",rows:()=>[{key:"nav_extra",value:JSON.stringify(NX.map(x=>({text:x.text.trim(),link:x.link})))}]})},
 footer(){
  lkPage("الفوتر",`<div class="box">${F([["footer_text","نص الفوتر"]])}<p class="hint">يظهر أسفل كل الصفحات مع الأقسام التي فعّلت لها "الفوتر" وبيانات التواصل وروابط السوشيال.</p></div>`)},
 contact(){
  lkPage("بيانات التواصل",`<div class="box">${F([["whatsapp","رقم الواتساب (دولي بدون +، مثال 201001234567)","ltr"],["contact_phone","رقم الهاتف (يظهر في الفوتر)","ltr"],["contact_email","الإيميل","ltr"],["contact_address","العنوان"]])}</div>`)},
 social(){
  lkPage("شبكات التواصل",`<div class="box"><p class="hint">تظهر في الفوتر كأيقونات. اترك الحقل فارغاً لإخفاء المنصة. الرابط لازم يبدأ بـ https://</p>${F([["facebook_url","فيسبوك","ltr"],["instagram_url","إنستجرام","ltr"],["tiktok_url","تيك توك","ltr"],["youtube_url","يوتيوب","ltr"],["x_url","X (تويتر)","ltr"],["telegram_url","تيليجرام","ltr"],["whatsapp_url","رابط واتساب (اختياري)","ltr"]])}</div>`)}
};

/* ---------- shipping ---------- */
V.shipping=()=>{
 $("view").innerHTML=`<div class="box" id="shb"><h3>إعدادات الشحن</h3>${F([["free_shipping_min","شحن مجاني للطلبات من (جنيه، 0 = بدون)","num"],["courier_cost","تكلفة الشحن علينا لكل طلب (جنيه، تدخل في حساب الربح)","num"]])}<button id="shs">حفظ</button> <span id="shm"></span></div>
 <div class="box"><h3>سعر الشحن لكل محافظة</h3><p class="hint">يظهر للعميل قبل تأكيد الطلب. المحافظة المعطّلة لا تظهر في الطلب. الأسعار الأولية مؤقتة، عدّلها.</p>
 <div class="row" style="align-items:end"><div><label>تطبيق سعر موحد على الكل</label><input id="zall" type="number" inputmode="decimal"></div><button id="zallb" class="gray">تطبيق</button></div>
 <div class="scroll"><table><tr><th>المحافظة</th><th>السعر</th><th>مفعّلة</th></tr>${D.zones.map(z=>`<tr><td>${esc(z.governorate)}</td><td><input class="zf" data-g="${esc(z.governorate)}" type="number" inputmode="decimal" value="${esc(z.fee)}" style="margin:0"></td><td><input class="za" data-g="${esc(z.governorate)}" type="checkbox" ${z.active?"checked":""}></td></tr>`).join("")}</table></div>
 <button id="zs" style="margin-top:10px">حفظ أسعار المحافظات</button> <span id="zm"></span></div>`;
 $("shs").onclick=()=>saveBlock($("shb"),"shm");
 $("zallb").onclick=()=>document.querySelectorAll(".zf").forEach(i=>i.value=Math.max(0,num($("zall").value)));
 $("zs").onclick=async()=>{try{flash("zm","جاري الحفظ...",true);const rows=D.zones.map(z=>({governorate:z.governorate,sort_order:z.sort_order,fee:Math.max(0,num(document.querySelector(`.zf[data-g="${CSS.escape(z.governorate)}"]`).value)),active:document.querySelector(`.za[data-g="${CSS.escape(z.governorate)}"]`).checked}));
  const {error}=await sb.from("shipping_zones").upsert(rows);if(error)throw error;D.zones=rows;flash("zm","تم الحفظ",true)}catch(e){flash("zm","خطأ: "+e.message)}};
};

V.coupons=async()=>{
 $("view").innerHTML=`<div class="box">جاري التحميل...</div>`;
 const {data,error}=await sb.from("coupons").select("*").order("created_at",{ascending:false});
 if(error){$("view").innerHTML=`<div class="box msg">تعذر تحميل الكوبونات: ${esc(error.message)}</div>`;return}
 const act=data.filter(c=>c.active).length;
 const desc=c=>c.kind==="percent"?num(c.value)+"%"+(c.max_discount?" (حد أقصى "+fmt(c.max_discount)+" جنيه)":""):fmt(c.value)+" جنيه";
 $("view").innerHTML=`<div class="box"><h3>العروض وكوبونات الخصم</h3><p class="hint">${act?`عندك ${act} كود مفعّل، وحقل الكوبون ظاهر للعملاء في صفحة إتمام الطلب.`:"مفيش أي كود مفعّل حالياً، فحقل الكوبون مش ظاهر للعملاء. أي كود تضيفه بيفضل متوقف لحد ما تفعّله."} الخصم بيتحسب على ثمن المنتجات (من غير الشحن) ويظهر في الفاتورة والتيليجرام.</p></div>
 <div class="box" id="cpn"><h3 id="chead">إضافة كود جديد</h3>
  <label>الكود (حروف إنجليزي أو أرقام)</label><input id="cc" dir="ltr" maxlength="30" autocomplete="off">
  <label>نوع الخصم</label><select id="ck"><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت بالجنيه</option></select>
  <label>قيمة الخصم</label><input id="cv" inputmode="decimal">
  <label>أقل قيمة منتجات لتفعيل الكود (جنيه، 0 = بدون)</label><input id="cm" inputmode="decimal" value="0">
  <label>أقصى خصم بالجنيه (للنسبة فقط، اتركه فارغاً = بدون)</label><input id="cx" inputmode="decimal">
  <label>عدد مرات الاستخدام الكلي (فارغ = بدون حد)</label><input id="cu" inputmode="numeric">
  <label>ينتهي يوم (DD/MM/YYYY، فارغ = بدون)</label>${dIn("ce","")}
  <label>اسم العرض / ملاحظة لنفسك (اختياري)</label><input id="cn" maxlength="120">
  <label><input type="checkbox" id="ca" style="width:auto"> تفعيل الكود</label>
  <button id="cadd">إضافة الكود</button> <button id="ccancel" class="gray" type="button" style="display:none">إلغاء التعديل</button> <span id="cm2"></span></div>
 <div class="box"><h3>الأكواد (${data.length})</h3>${data.length?`<div class="scroll"><table><tr><th>الكود</th><th>الخصم</th><th>الشروط</th><th>استُخدم</th><th>مفعّل</th><th></th></tr>${data.map(c=>`<tr><td dir="ltr"><b>${esc(c.code)}</b>${c.note?`<br><small>${esc(c.note)}</small>`:""}</td><td>${esc(desc(c))}</td><td>${[c.min_subtotal>0?"من "+fmt(c.min_subtotal)+" جنيه":"",c.expires_at?"ينتهي "+dmy(c.expires_at):"",c.max_uses?"حد "+c.max_uses:""].filter(Boolean).join(" - ")||"-"}</td><td>${c.used_count}</td><td><input type="checkbox" class="ctog" data-c="${esc(c.code)}" ${c.active?"checked":""}></td><td><button class="sm gray cedit" data-c="${esc(c.code)}">تعديل</button> <button class="sm red cdel" data-c="${esc(c.code)}">حذف</button></td></tr>`).join("")}</table></div>`:`<p class="hint">لا توجد أكواد.</p>`}</div>`;
 let editing=null;
 const fillForm=c=>{editing=c?c.code:null;$("cc").value=c?c.code:"";$("cc").disabled=!!c;$("ck").value=c?c.kind:"percent";$("cv").value=c?num(c.value):"";$("cm").value=c?num(c.min_subtotal):"0";$("cx").value=c&&c.max_discount?num(c.max_discount):"";$("cu").value=c&&c.max_uses?c.max_uses:"";$("ce").value=c&&c.expires_at?dmy(c.expires_at):"";$("cn").value=c&&c.note?c.note:"";$("ca").checked=!!(c&&c.active);$("chead").textContent=c?"تعديل الكود "+c.code:"إضافة كود جديد";$("cadd").textContent=c?"حفظ التعديل":"إضافة الكود";$("ccancel").style.display=c?"":"none";flash("cm2","",true)};
 $("ccancel").onclick=()=>fillForm(null);
 document.querySelectorAll(".cedit").forEach(x=>x.onclick=()=>{fillForm(data.find(c=>c.code===x.dataset.c));$("cpn").scrollIntoView({behavior:"smooth"})});
 $("cadd").onclick=async()=>{
  const code=$("cc").value.trim().toUpperCase(),kind=$("ck").value,val=num($("cv").value);
  if(!editing&&!/^[A-Z0-9_-]{3,30}$/.test(code))return flash("cm2","الكود لازم 3 حروف أو أرقام إنجليزي على الأقل");
  if(!(val>0)||(kind==="percent"&&val>100))return flash("cm2","اكتب قيمة خصم صحيحة");
  let exp=null;if($("ce").value.trim()){const d=pdmy($("ce").value);if(!d)return flash("cm2","تاريخ الانتهاء غير صحيح");exp=new Date(d+"T23:59:59+02:00").toISOString()}
  const row={code,kind,value:val,min_subtotal:Math.max(0,num($("cm").value)),max_discount:kind==="percent"&&num($("cx").value)>0?num($("cx").value):null,max_uses:num($("cu").value)>0?Math.floor(num($("cu").value)):null,expires_at:exp,active:$("ca").checked,note:$("cn").value.trim()||null};
  flash("cm2","جاري الحفظ...",true);
  if(editing){const {code:_c,...upd}=row;const {error:e2}=await sb.from("coupons").update(upd).eq("code",editing);if(e2)return flash("cm2","خطأ: "+e2.message);return V.coupons()}
  const {error}=await sb.from("coupons").insert(row);
  if(error)return flash("cm2",/duplicate/.test(error.message)?"الكود موجود بالفعل":"خطأ: "+error.message);V.coupons()};
 document.querySelectorAll(".ctog").forEach(x=>x.onchange=async()=>{const {error}=await sb.from("coupons").update({active:x.checked}).eq("code",x.dataset.c);if(error){alert("خطأ: "+error.message)}V.coupons()});
 document.querySelectorAll(".cdel").forEach(x=>x.onclick=async()=>{if(!confirm("حذف الكود "+x.dataset.c+"؟"))return;const {error}=await sb.from("coupons").delete().eq("code",x.dataset.c);if(error)alert("خطأ: "+error.message);V.coupons()});
};

/* ---------- settings ---------- */
const stRow=s=>`<div class="row st-row" data-id="${esc(s.id)}" style="align-items:end"><div><label>الاسم</label><input class="sn" value="${esc(s.name)}"></div><div style="flex:0 0 70px;min-width:70px"><label>اللون</label><input class="sc" type="color" value="${esc(s.color)}"></div><div style="flex:0 0 80px;min-width:80px"><label>الترتيب</label><input class="so" type="number" value="${esc(s.sort_order)}"></div><div style="flex:0 0 130px;min-width:130px"><label><input class="sp" type="checkbox" ${s.counts_in_profit?"checked":""}>تُحسب في الأرباح</label></div><button class="sm red sdel" type="button">حذف</button></div>`;
V.settings=()=>{
 $("view").innerHTML=`<div id="sb1"><div class="box"><h3>التواصل</h3>${F([["whatsapp","رقم الواتساب (دولي بدون +، مثال 201001234567)","ltr"],["contact_phone","رقم الهاتف (يظهر في الفوتر)","ltr"],["contact_email","الإيميل","ltr"],["contact_address","العنوان"],["facebook_url","رابط فيسبوك","ltr"],["instagram_url","رابط إنستجرام","ltr"],["tiktok_url","رابط تيك توك","ltr"],["youtube_url","رابط يوتيوب","ltr"],["x_url","رابط إكس (تويتر)","ltr"],["telegram_url","رابط تيليجرام","ltr"],["whatsapp_url","رابط واتساب (اختياري)","ltr"]])}<p class="hint">تظهر الروابط في الفوتر كأيقونات بشعار كل منصة. اترك الحقل فارغاً لإخفاء المنصة. الرابط لازم يبدأ بـ https://</p></div>
 <div class="box"><h3>السياسات والسيو</h3>${F([["return_policy","سياسة الاسترجاع (اكتبها بنفسك، تظهر في المتجر)","area"],["seo_description","وصف المتجر لمحركات البحث","area"],["site_url","عنوان الموقع الرسمي (مثال https://matbakhi.com)","ltr"]])}</div>
 <div class="box"><h3>البيكسل والتحليلات</h3><p class="hint">اترك الحقل فارغاً لإيقافه.</p>${F([["meta_pixel_id","Meta Pixel ID (أرقام فقط)","ltr"],["tiktok_pixel_id","TikTok Pixel ID","ltr"],["ga_id","Google Analytics ID (يبدأ بـ G-)","ltr"]])}</div>
 <button id="sset">حفظ</button> <span id="sm"></span></div>
 <div class="box" id="pmbox" style="margin-top:14px"><h3>طرق الدفع</h3><p class="hint">أضف كل طريقة دفع (الدفع عند الاستلام، InstaPay، محفظة إلكترونية). الطريقة المتوقفة أو اللي مفيهاش رقم/عنوان ما بتظهرش للعميل. لو مفيش أي طريقة مفعّلة، المتجر بيشتغل بالدفع عند الاستلام فقط. الطلب اللي بيتدفع بتحويل بيتسجل "بانتظار تأكيد الدفع" لحد ما تأكده من صفحة الطلبات.</p><div id="pmlist">${pmList().map(pmRow).join("")}</div><button class="sm gray" id="pmadd" type="button">+ طريقة دفع</button> <button id="pmsave" type="button">حفظ طرق الدفع</button> <span id="pmm"></span></div>
 <div class="box" style="margin-top:14px"><h3>حالات الطلبات</h3><p class="hint">أول حالة في القائمة (حسب الترتيب) تُعطى للطلبات القادمة من الموقع.</p><div id="stlist">${D.statuses.map(stRow).join("")}</div><button class="sm gray" id="stadd">+ حالة جديدة</button> <button id="stsave">حفظ الحالات</button> <span id="stm"></span>
 <p class="hint">"تُحسب في الأرباح": ألغِ العلامة للحالات التي لا تدخل في المبيعات (مثل ملغي). لا يمكن حذف حالة مستخدمة في طلبات.</p></div>`;
 $("sset").onclick=()=>saveBlock($("sb1"),"sm");
 $("pmadd").onclick=()=>{$("pmlist").insertAdjacentHTML("beforeend",pmRow({id:"",kind:"instapay",name:"InstaPay",detail:"",note:"",on:false}));wirePm()};$("pmsave").onclick=savePm;wirePm();
 $("stadd").onclick=()=>{$("stlist").insertAdjacentHTML("beforeend",stRow({id:"",name:"",color:"#6b7280",sort_order:D.statuses.length+1,counts_in_profit:true}));wireSt()};$("stsave").onclick=saveStatuses;wireSt();
};
const PM_KINDS=[["cod","الدفع عند الاستلام"],["instapay","InstaPay"],["wallet","محفظة إلكترونية"],["other","تحويل آخر"]];
function pmList(){try{const a=JSON.parse(setting("payment_methods","[]"));if(Array.isArray(a)&&a.length)return a}catch(e){}return [{id:"cod",kind:"cod",name:"الدفع عند الاستلام",detail:"",note:"",on:true}]}
const pmRow=m=>`<div class="box pm-row" data-id="${esc(m.id)}"><div class="row"><div><label>النوع</label><select class="pk">${PM_KINDS.map(k=>`<option value="${k[0]}" ${k[0]===m.kind?"selected":""}>${k[1]}</option>`).join("")}</select></div><div><label>الاسم اللي يظهر للعميل</label><input class="pn" maxlength="40" value="${esc(m.name)}"></div></div><label>رقم المحفظة / عنوان الدفع (IPA)</label><input class="pd" dir="ltr" maxlength="120" value="${esc(m.detail||"")}"><label>ملاحظة للعميل (اختياري)</label><input class="pt" maxlength="200" value="${esc(m.note||"")}"><label><input type="checkbox" class="po" style="width:auto" ${m.on?"checked":""}> مفعّلة</label> <button class="sm red pdel" type="button">حذف</button></div>`;
function wirePm(){document.querySelectorAll(".pdel").forEach(b=>b.onclick=()=>b.closest(".pm-row").remove())}
async function savePm(){
 try{const rows=[...document.querySelectorAll(".pm-row")].map(r=>({id:r.dataset.id||"m"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),kind:r.querySelector(".pk").value,name:r.querySelector(".pn").value.trim(),detail:r.querySelector(".pd").value.trim(),note:r.querySelector(".pt").value.trim(),on:r.querySelector(".po").checked}));
  for(const m of rows){if(!m.name)return flash("pmm","اكتب اسم لكل طريقة دفع");if(m.kind!=="cod"&&m.on&&!m.detail)return flash("pmm","اكتب الرقم أو العنوان لـ "+m.name+" قبل تفعيلها")}
  const value=JSON.stringify(rows);const {error}=await sb.from("settings").upsert({key:"payment_methods",value},{onConflict:"key"});if(error)throw error;D.settings.payment_methods=value;flash("pmm","تم الحفظ (التغيير بيظهر للعملاء خلال 5 دقايق)",true)
 }catch(e){flash("pmm","خطأ: "+e.message)}
}
function wireSt(){document.querySelectorAll(".sdel").forEach(b=>b.onclick=async()=>{const r=b.closest(".st-row"),id=r.dataset.id;if(id){if(!confirm("حذف هذه الحالة؟"))return;const {error}=await sb.from("order_statuses").delete().eq("id",id);if(error)return alert("لا يمكن الحذف (ربما مستخدمة في طلبات): "+error.message);D.statuses=D.statuses.filter(s=>s.id!==id)}r.remove()})}
async function saveStatuses(){
 try{const rows=[...document.querySelectorAll(".st-row")].map(r=>({id:r.dataset.id,name:r.querySelector(".sn").value.trim(),color:r.querySelector(".sc").value,sort_order:parseInt(r.querySelector(".so").value)||0,counts_in_profit:r.querySelector(".sp").checked})).filter(r=>r.name);
  for(const r of rows){const {id,...v}=r;const {error}=id?await sb.from("order_statuses").update(v).eq("id",id):await sb.from("order_statuses").insert(v);if(error)throw error}
  const {data,error}=await sb.from("order_statuses").select("*").order("sort_order");if(error)throw error;D.statuses=data;V.settings();flash("stm","تم الحفظ",true);drawNav()
 }catch(e){flash("stm","خطأ: "+e.message)}
}
start();
