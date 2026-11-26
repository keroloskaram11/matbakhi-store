(function(){
function ic(d){return'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg>'}
document.querySelectorAll(".hscroll").forEach(function(el){
 if(el.parentNode.classList.contains("hsw"))return;
 var sec=el.closest(".csec");if(sec)sec.classList.add("csec-s");
 var w=document.createElement("div");w.className="hsw";el.parentNode.insertBefore(w,el);w.appendChild(el);
 var rtl=getComputedStyle(el).direction==="rtl";
 var p=document.createElement("button"),n=document.createElement("button");
 p.type=n.type="button";p.className="hsa hsa-p";n.className="hsa hsa-n";
 p.setAttribute("aria-label","السابق");n.setAttribute("aria-label","التالي");
 p.innerHTML=ic(rtl?"M9 6l6 6-6 6":"M15 6l-6 6 6 6");n.innerHTML=ic(rtl?"M15 6l-6 6 6 6":"M9 6l6 6-6 6");
 var bar=document.createElement("div");bar.className="hsb";bar.innerHTML="<i></i>";
 w.appendChild(p);w.appendChild(n);w.parentNode.insertBefore(bar,w.nextSibling);
 var hint=document.createElement("div");hint.className="hsh";hint.textContent="اسحب يمين وشمال أو استخدم الأسهم لمشاهدة المزيد";bar.parentNode.insertBefore(hint,bar.nextSibling);
 var dir=rtl?-1:1;
 function up(){var max=el.scrollWidth-el.clientWidth;if(max<4){w.classList.add("hs-no");bar.hidden=hint.hidden=true;return}
  var x=Math.abs(el.scrollLeft),r=Math.min(1,x/max);
  bar.firstChild.style.width=Math.max(18,el.clientWidth/el.scrollWidth*100)+"%";
  bar.firstChild.style.marginInlineStart=(r*(100-Math.max(18,el.clientWidth/el.scrollWidth*100)))+"%";
  p.disabled=x<4;n.disabled=x>max-4}
 function go(k){var st=el.children[0]?el.children[0].getBoundingClientRect().width+10:200;el.scrollBy({left:k*dir*st*2,behavior:"smooth"})}
 p.onclick=function(){go(-1)};n.onclick=function(){go(1)};
 el.addEventListener("scroll",function(){requestAnimationFrame(up)},{passive:true});addEventListener("resize",up);setTimeout(up,50);setTimeout(up,800)});
})();
