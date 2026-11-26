(function(){if(window.__aiSI||document.querySelector(".aibtn"))return;window.__aiSI=1;
var U=window.SUPABASE_URL,K=window.SUPABASE_KEY;if(!U||!K)return;
var f=document.getElementById("sf");if(!f)return;
var $=function(i){return document.getElementById(i)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var fmt=function(n){return Number(n||0).toLocaleString("en-US",{maximumFractionDigits:2})};
var safe=function(u){return/^https?:\/\//i.test(u||"")?u:""};
var H={apikey:K,"Content-Type":"application/json"};
var cfg={on:false,welcome:"",ex:[]};
var ctx={q:"",budget:null,sort:"fit",shown:[],last:[],small:false};
var panel,btn;
fetch(U+"/rest/v1/settings?select=key,value&key=like.ai_search*",{headers:H}).then(function(r){return r.json()}).then(function(a){
 var m={};(a||[]).forEach(function(x){m[x.key]=x.value});
 if(m.ai_search_on!=="1")return;
 cfg.on=true;cfg.welcome=m.ai_search_welcome||"اوصف اللي محتاجه بكلامك العادي وأنا أرشحلك من منتجاتنا.";
 try{cfg.ex=JSON.parse(m.ai_search_examples||"[]")}catch(e){}
 if(!Array.isArray(cfg.ex)||!cfg.ex.length)cfg.ex=["عايز انظم مطبخي","ادوات تنظيف عملية","تجهيز مطبخ جديد بميزانية 1000"];
 init()}).catch(function(){});
function init(){
 btn=document.createElement("button");btn.type="button";btn.className="aibtn";btn.setAttribute("aria-label","بحث ذكي");
 btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg><span>بحث ذكي</span>';
 f.appendChild(btn);
 panel=document.createElement("section");panel.className="aip";panel.hidden=true;panel.innerHTML='<form class="aibar" id="aif"><input id="aiq" type="search" placeholder="اكتب اللي محتاجه بكلامك، مثال: عايز انظم مطبخي" aria-label="بحث ذكي" enterkeyhint="search"><button type="submit" class="aisend">ابحث</button></form><div id="aib"></div>';f.parentNode.insertBefore(panel,f.nextSibling);
 btn.addEventListener("click",function(){var open=panel.hidden;panel.hidden=!open;btn.classList.toggle("on",open);if(open){home();$("aiq").focus()}});
 $("aif").addEventListener("submit",function(e){e.preventDefault();var v=$("aiq").value.trim();if(v)run(v,{reset:true})});
 f.addEventListener("submit",function(e){if(!panel.hidden){e.preventDefault();var v=$("q").value.trim();if(v)run(v,{reset:true})}},true);
 $("aib").addEventListener("click",function(e){var c=e.target.closest("[data-aq]");if(c){e.preventDefault();var v=c.getAttribute("data-aq");$("aiq").value=v;run(v,{reset:true});return}
  var a=e.target.closest("[data-af]");if(a){e.preventDefault();follow(a.getAttribute("data-af"))}})}
function home(){$("aib").innerHTML='<p class="aiw">'+esc(cfg.welcome)+'</p><div class="aich">'+cfg.ex.map(function(x){return'<button type="button" data-aq="'+esc(x)+'">'+esc(x)+'</button>'}).join("")+'</div>'}
function call(o){return fetch(U+"/rest/v1/rpc/ai_search_smart",{method:"POST",headers:H,body:JSON.stringify(o)}).then(function(r){return r.json()})}
function run(q,o){o=o||{};if(o.reset){ctx={q:q,budget:null,sort:"fit",shown:[],last:[],small:false}}
 $("aib").innerHTML='<p class="aiw">بدور لك...</p>';
 call({p_q:ctx.q,p_budget:ctx.budget,p_sort:(ctx.sort==="fit"&&!ctx.budget?null:ctx.sort),p_limit:6,p_exclude:ctx.shown,p_small:ctx.small}).then(function(r){
  if(!r||!r.ok){$("aib").innerHTML='<p class="aiw">حصلت مشكلة في البحث. جرب البحث العادي.</p>';return}
  if(r.parsed&&r.parsed.budget&&!ctx.budget)ctx.budget=r.parsed.budget;
  var it=r.items||[];
  if(!it.length){$("aib").innerHTML='<p class="aiw">ملقيتش حاجة مناسبة بالظبط. جرب توصف بشكل تاني أو ابحث بالبحث العادي.</p>'+chips();return}
  ctx.last=it;it.forEach(function(x){ctx.shown.push(x.id)});
  $("aib").innerHTML='<p class="aiw">رشحتلك '+it.length+' من '+r.total+' منتج مناسب:</p><div class="aig">'+it.map(card).join("")+'</div>'+chips()}).catch(function(){$("aib").innerHTML='<p class="aiw">حصلت مشكلة في الاتصال.</p>'})}
function why(x){var w=x.why||{},t=[];if(w.intent)t.push("مناسب لـ "+w.intent);else if(w.name)t.push("الاسم مطابق لطلبك");else if(w.text)t.push("مذكور في وصفه");if(x.category)t.push("قسم: "+x.category);return t.join(" - ")}
function card(p){var pr=Number(p.eff),sl=pr<Number(p.price),img=safe(p.image_url),out=p.in_stock===false;
 return'<article class="card"><a href="/p/'+esc(encodeURIComponent(p.slug))+'" class="imgl">'+(img?'<img src="'+esc(img)+'" alt="'+esc(p.name)+'" width="400" height="400" loading="lazy">':'<div class="ph"></div>')+'</a><div class="in"><h3><a href="/p/'+esc(encodeURIComponent(p.slug))+'">'+esc(p.name)+'</a></h3><div class="pr"><span class="price'+(sl?" sale":"")+'">'+fmt(pr)+' جنيه</span>'+(sl?'<span class="old">'+fmt(p.price)+'</span>':'')+'</div><div class="aiav">'+(out?"غير متاح حاليا":"متاح")+'</div><div class="aiwhy">'+esc(why(p))+'</div>'+(out?'<button class="btn add" disabled>نفذت الكمية</button>':'<button class="btn add" data-add data-id="'+esc(p.id)+'" data-name="'+esc(p.name)+'" data-price="'+pr+'" data-image="'+esc(img)+'" data-slug="'+esc(p.slug)+'" data-min="'+(p.min_order_qty||1)+'" data-tiers="[]">أضف للسلة</button>')+'</div></article>'}
function chips(){return'<div class="aich"><button type="button" data-af="cheap">الأرخص</button><button type="button" data-af="premium">جودة أعلى</button><button type="button" data-af="alt">بدائل</button><button type="button" data-af="small">أصغر</button><button type="button" data-af="budget">زوّد الميزانية</button><button type="button" data-af="cmp">قارن</button></div>'}
function follow(a){
 if(a==="cheap"){ctx.sort="cheap";ctx.shown=[]}
 else if(a==="premium"){ctx.sort="premium";ctx.shown=[]}
 else if(a==="small"){ctx.small=true;ctx.shown=[]}
 else if(a==="budget"){var b=ctx.budget||(ctx.last.length?Math.max.apply(null,ctx.last.map(function(x){return Number(x.eff)})):0);ctx.budget=b?Math.round(b*1.5):null;ctx.shown=[]}
 else if(a==="cmp"){var l=ctx.last.slice(0,3);if(l.length<2){return}
  $("aib").innerHTML='<p class="aiw">مقارنة سريعة:</p><div class="aicmp"><table><tr><th></th>'+l.map(function(x){return'<th>'+esc(x.name.slice(0,40))+'</th>'}).join("")+'</tr><tr><td>السعر</td>'+l.map(function(x){return'<td>'+fmt(x.eff)+' جنيه</td>'}).join("")+'</tr><tr><td>الحالة</td>'+l.map(function(x){return'<td>'+(x.in_stock===false?"غير متاح":"متاح")+'</td>'}).join("")+'</tr><tr><td>القسم</td>'+l.map(function(x){return'<td>'+esc(x.category||"")+'</td>'}).join("")+'</tr></table></div>'+chips();return}
 run(ctx.q)}
})();
