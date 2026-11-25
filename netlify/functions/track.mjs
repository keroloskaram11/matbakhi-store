import * as L from "../lib/lib.mjs";
// Order tracking page: the customer enters order number + phone and sees only that order's status.
// The lookup runs in the database (track_order), which rate-limits attempts and returns the status only.
export default async (req, context) => {
  try {
    const [S, cats, Z] = await Promise.all([L.settings(), L.categories(), L.zones()]);
    const name = S.store_name || "المتجر", wa = String(S.whatsapp || "").replace(/\D/g, "");
    const main = `${L.crumbHtml([["الرئيسية", "/"], ["تتبع الطلب", "/track"]])}<h1 class="sec">تتبع طلبك</h1>
<p class="lead">اكتب رقم الطلب ورقم الموبايل اللي سجلت بيه الطلب وهتعرف حالته.</p>
<form id="tf" class="box formbox" novalidate><label>رقم الطلب</label><input id="tno" inputmode="numeric" maxlength="10" placeholder="مثال 125" autocomplete="off" required>
<label>رقم الموبايل</label><input id="tph" type="tel" inputmode="tel" placeholder="01XXXXXXXXX" autocomplete="tel" required>
<p class="msg" id="terr"></p><button class="btn full" id="tsub" type="submit">عرض حالة الطلب</button></form>
<div id="tres" class="box" hidden></div>
${wa ? `<p class="muted">محتاج مساعدة؟ <a href="https://wa.me/${L.esc(wa)}" target="_blank" rel="noopener">كلمنا على واتساب</a></p>` : ""}
<script>(function(){
var $=function(i){return document.getElementById(i)},D="٠١٢٣٤٥٦٧٨٩";
var MSG={"جديد":"تم استلام طلبك وجاري مراجعته","تم التجهيز":"طلبك اتجهّز وجاهز للشحن","تم الشحن":"طلبك اتشحن وفي الطريق ليك","وصل":"طلبك وصل","تم التحصيل":"طلبك وصل واتسلّم، شكراً ليك","ملغي":"الطلب ده اتلغى"};
var STEPS=[["جديد","تم الاستلام"],["تم التجهيز","تم التجهيز"],["تم الشحن","تم الشحن"],["وصل","وصل"]];
function d2(s){return String(s).replace(/[٠-٩]/g,function(c){return D.indexOf(c)})}
function dmy(iso){var d=new Date(iso);if(isNaN(d))return"";return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear()}
$("tf").onsubmit=function(e){e.preventDefault();var err=$("terr"),res=$("tres"),b=$("tsub");err.textContent="";res.hidden=true;
 var no=d2($("tno").value).replace(/\\D/g,""),ph=$("tph").value.trim();
 if(!no||no.length>10)return err.textContent="اكتب رقم الطلب";
 if(ph.length<8)return err.textContent="اكتب رقم الموبايل";
 b.disabled=true;b.textContent="جاري البحث...";
 fetch(window.SUPABASE_URL+"/rest/v1/rpc/track_order",{method:"POST",headers:{apikey:window.SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({p_order_no:Number(no),p_phone:ph})})
 .then(function(r){return r.json()}).then(function(j){b.disabled=false;b.textContent="عرض حالة الطلب";
  if(!j||!j.ok){err.textContent=(j&&j.message&&/[\\u0600-\\u06FF]/.test(j.message))?j.message:"تعذر عرض الطلب، حاول تاني";return}
  var PAY={pending:"الدفع: بانتظار تأكيد الدفع",paid:"الدفع: تم تأكيد الدفع"};var cancelled=j.status==="ملغي",step=0;STEPS.forEach(function(s,i){if(s[0]===j.status||(j.status==="تم التحصيل"&&i===3))step=i});
  var html='<h3>طلب رقم #'+Number(no)+'</h3><p class="muted">تاريخ الطلب: '+dmy(j.created_at)+'</p><p><b>'+(MSG[j.status]||j.status)+'</b></p>'+(PAY[j.pay]?'<p class="muted">'+PAY[j.pay]+(j.method?' ('+String(j.method).replace(/[<>&]/g,'')+')':'')+'</p>':'');
  if(!cancelled)html+='<ol class="trk">'+STEPS.map(function(s,i){return '<li class="'+(i<=step?"on":"")+'"><span>'+(i<=step?"&#10003;":i+1)+'</span>'+s[1]+'</li>'}).join("")+'</ol>';
  res.innerHTML=html;res.hidden=false}).catch(function(){b.disabled=false;b.textContent="عرض حالة الطلب";err.textContent="تعذر الاتصال، حاول تاني"})};
})();</script>`;
    return L.send(L.layout({ req, S, cats, zonesList: Z, title: `تتبع طلبك | ${name}`, desc: L.cut(`تابع حالة طلبك من ${name} برقم الطلب ورقم الموبايل.`, 160), path: "/track", robots: "noindex,follow", body: { main } }));
  } catch (e) { return L.fail(e) }
};
export const config = { path: ["/track"] };
