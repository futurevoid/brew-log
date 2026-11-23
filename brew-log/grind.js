window.onerror=function(m,u,l){var e=document.getElementById("jserr");if(e)e.textContent=String(m)+" (line "+l+")"};
var $=function(i){return document.getElementById(i)};
$("jsmsg").style.display="none";

// ---------- storage ----------
var SKEY="grind-samples-v1",TKEY="grind-targets",DRAFT="brewlog-draft-v1";
function lsGet(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){toast("ما قدرنا نحفظ على الجهاز")}}
var samples=lsGet(SKEY,[]),targets=lsGet(TKEY,[]);
function saveSamples(){lsSet(SKEY,samples)}
function upsert(s){var i=samples.findIndex(function(x){return x.id===s.id});if(i<0)samples.push(s);else samples[i]=s;saveSamples()}
function byId(id){return samples.find(function(s){return s.id===id})||null}
function latest(){return samples.slice().sort(function(a,b){return b.t-a.t})[0]||null}
function cutoff(){return +(lsGet("grind-cutoff",200))||200}

// ---------- small helpers ----------
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
var toastT;function toast(m){var t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},2600)}
function n0(v){return Math.round(v).toLocaleString("en-US")}
function pc(v){return (v*100).toFixed(v<0.1?1:0)+"%"}
function fmtDate(t){try{return new Date(t).toLocaleDateString("ar-u-ca-gregory-nu-latn",{day:"numeric",month:"short"})}catch(e){return new Date(t).toISOString().slice(0,10)}}
function gname(k){var i=Micron.info(k);return i?i.name:k}
function sName(s){return s.grinder?gname(s.grinder)+" · "+s.setting:"بدون طاحونة"}
function gnorm(q){return String(q).toLowerCase().replace(/[\s\-_.()+]/g,"")}
function fillGrinders(sel,q,keep){
  var n=gnorm(q||""),ks=Micron.list.filter(function(g){return !n||gnorm(g.name).indexOf(n)>-1}).map(function(g){return g.key});
  if(keep&&ks.indexOf(keep)<0)ks.unshift(keep);
  sel.innerHTML='<option value="">'+(n?"— "+ks.length+" نتيجة —":"—")+'</option>'+ks.map(function(k){return'<option value="'+k+'">'+esc(gname(k))+'</option>'}).join("");
  sel.value=n&&ks.length===1?ks[0]:(keep||"");
}

// ---------- theme ----------
function isDark(){var t=document.documentElement.getAttribute("data-theme");if(t)return t==="dark";return !!(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)}
function themeLabel(){var d=isDark();$("theme").textContent=d?"☀️ فاتح":"🌙 داكن";document.documentElement.style.colorScheme=d?"dark":"light"}
try{var st=localStorage.getItem("theme");if(st==="dark"||st==="light")document.documentElement.setAttribute("data-theme",st)}catch(e){}
$("theme").onclick=function(){var t=isDark()?"light":"dark";document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("theme",t)}catch(e){}themeLabel()};
themeLabel();

// ---------- tabs ----------
var view="an";
function show(v){
  view=v;["an","tr","cmp","hist"].forEach(function(x){$("v-"+x).hidden=x!==v});
  [].forEach.call($("tabs").children,function(b){b.setAttribute("aria-pressed",b.dataset.v===v?"true":"false")});
  if(v==="an")renderHome();if(v==="tr")renderTr();if(v==="cmp")renderCmp();if(v==="hist")renderHist();
  window.scrollTo(0,0);
}
$("tabs").addEventListener("click",function(e){var b=e.target.closest("button");if(b)show(b.dataset.v)});

// ---------- coin ----------
var coinSaved=lsGet("grind-coin",{v:"23",mm:""});
$("coin").value=coinSaved.v;$("coinMm").value=coinSaved.mm||"";
function coinMm(){return $("coin").value==="custom"?(+$("coinMm").value||0):23}
function coinUi(){$("coinMmL").hidden=$("coin").value!=="custom";lsSet("grind-coin",{v:$("coin").value,mm:$("coinMm").value})}
$("coin").onchange=coinUi;$("coinMm").oninput=coinUi;coinUi();

// ---------- guide ----------
function guide(open){$("guide").hidden=!open;if(open)lsSet("grind-guide-seen",1)}
$("showGuide").onclick=function(){guide(true)};$("guideClose").onclick=function(){guide(false)};
$("guide").addEventListener("click",function(e){if(e.target===$("guide"))guide(false)});

// ---------- worker ----------
var worker=null,wReady=null,jobs={},jobN=0;
function engine(){
  if(wReady)return wReady;
  status("نحمّل محرك التحليل (مرة وحدة، حوالي 9 ميجا)…");
  worker=new Worker("grind-worker.js");
  wReady=new Promise(function(res,rej){
    worker.onmessage=function(e){
      var m=e.data;
      if(m.type==="ready")res();
      else if(m.type==="error"){wReady=null;worker.terminate();rej(new Error(m.message))}
      else if(m.type==="result"&&jobs[m.id]){jobs[m.id](m.res);delete jobs[m.id]}
    };
    worker.onerror=function(e){wReady=null;rej(new Error(e.message||"worker"))};
    worker.postMessage({type:"init"});
  });
  return wReady;
}
function runAnalysis(opts){
  return engine().then(function(){
    return new Promise(function(res){
      var id=++jobN,copy=new Uint8ClampedArray(img.data);jobs[id]=res;
      worker.postMessage({type:"analyze",id:id,buffer:copy.buffer,width:img.w,height:img.h,opts:opts},[copy.buffer]);
    });
  });
}

// ---------- photo + session ----------
var img=null,cur=null,photoIdx=0,res=null,mode=null,fix=null,crop=null,addingSpread=false,showAnyway=false;
var MAXSIDE=4032;
function status(t){$("status").textContent=t||""}
function newSession(){cur={id:"g"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),t:Date.now(),photos:[],sample:null};photoIdx=0}

function onFile(e){
  var f=e.target.files&&e.target.files[0];e.target.value="";guide(false);
  if(!f)return;
  if(!coinMm()||coinMm()<10){toast("اكتب قطر العملة أول");$("coinMm").focus();return}
  if(!cur||!addingSpread)newSession();
  photoIdx=addingSpread?cur.photos.length:0;addingSpread=false;showAnyway=false;
  status("نجهّز الصورة…");
  loadImage(f).then(function(i){img=i;res=null;fix=null;crop=null;$("cropOn").checked=false;setMode(null);$("photoCard").hidden=false;renderHome();draw();analyze()})
    .catch(function(){status("ما قدرنا نفتح الصورة. جرّب صورة ثانية.")});
}
["cam","gal","gcam","ggal"].forEach(function(i){$(i).addEventListener("change",onFile)});

function loadImage(file){
  var go=function(src,w,h){
    var s=Math.min(1,MAXSIDE/Math.max(w,h)),W=Math.round(w*s),H=Math.round(h*s);
    var c=document.createElement("canvas");c.width=W;c.height=H;
    var x=c.getContext("2d");x.drawImage(src,0,0,W,H);
    return {w:W,h:H,data:x.getImageData(0,0,W,H).data,canvas:c};
  };
  if(window.createImageBitmap)return createImageBitmap(file,{imageOrientation:"from-image"}).then(function(b){var r=go(b,b.width,b.height);b.close&&b.close();return r});
  return new Promise(function(ok,no){var u=URL.createObjectURL(file),im=new Image();im.onload=function(){URL.revokeObjectURL(u);ok(go(im,im.naturalWidth,im.naturalHeight))};im.onerror=no;im.src=u});
}

function analyze(){
  var opts={coinMm:coinMm()};
  if(fix)opts.coin={x:fix.x,y:fix.y,r:fix.r};
  if(crop&&crop.w>20&&crop.h>20)opts.crop=crop;
  $("results").hidden=true;$("retake").hidden=true;
  status("جاري التحليل…");
  runAnalysis(opts).then(onResult,function(err){status("ما قدرنا نحمّل محرك التحليل. افتح الصفحة مع إنترنت أول مرة، وبعدها تشتغل بدونه.")});
}

var CHECKS={coin_small:["العملة صغيرة بالصورة","قرّب الجوال: الصورة تغطي ٨–١٠ سم بس."],blurry:["الصورة مو واضحة","ثبّت الجوال وخلّه يركّز على البن قبل التصوير."],
  few:["حبيبات قليلة","نحتاج ٥٠٠ حبيبة على الأقل. زد البن شوي، أو أضف فرشة ثانية."],clumps:["كتل كثيرة","افرش البن أخف عشان الحبيبات ما تلزق في بعض."],
  shadow:["فيه ظل على الورقة","غيّر مكان الإضاءة أو ابعد يدك عن الضوء."]};
var PASS={coin_small:"حجم العملة تمام",blurry:"الوضوح تمام",few:"عدد الحبيبات كافي",clumps:"الكتل قليلة",shadow:"الإضاءة متساوية"};

function onResult(r){
  if(!r.ok){
    if(r.error==="coin_not_found"){
      status("ما لقينا العملة. اسحب الدائرة فوقها، واسحب طرفها لين يطابق حجمها.");
      fix=fix||{x:img.w*0.75,y:img.h*0.75,r:Math.min(img.w,img.h)/8};setMode("coin");draw();return;
    }
    status("صار خطأ في التحليل"+(r.message?": "+r.message:""));return;
  }
  res=r;fix=fix&&r.coin.manual?fix:null;
  cur.photos[photoIdx]={diams:r.diameters,warnings:r.warnings,rejects:r.rejects,umPerPx:r.umPerPx};
  var lists=cur.photos.map(function(p){return p.diams}),S=GrindAnalyze.summarize(lists);
  var warns={};cur.photos.forEach(function(p){p.warnings.forEach(function(w){if(w!=="few")warns[w]=1})});
  if(S.count<500)warns.few=1;
  var rej={noise:0,edge:0,clump:0};cur.photos.forEach(function(p){for(var k in rej)rej[k]+=p.rejects[k]});
  var prev=cur.sample||{};
  cur.sample={id:cur.id,t:cur.t,coinMm:coinMm(),spreads:cur.photos.length,count:S.count,rejects:rej,
    d10:Math.round(S.d10),d50:Math.round(S.d50),d90:Math.round(S.d90),fines:S.fines,hist:S.hist,under:S.under,over:S.over,
    warnings:Object.keys(warns),grinder:prev.grinder||null,idx:prev.idx!=null?prev.idx:null,setting:prev.setting||null,calib:prev.calib!==false};
  upsert(cur.sample);selId=cur.id;
  status("");draw();renderSpreads();renderResult();
}

function renderSpreads(){
  var h='<span class="hint" style="margin:0">الفرشات</span>';
  cur.photos.forEach(function(p,i){h+='<span class="chipon">'+(i+1)+' ✓</span>'});
  if(cur.photos.length<3)h+='<button type="button" class="btn dash" id="addSpread">+ فرشة '+(cur.photos.length===1?"ثانية":"ثالثة")+'</button>';
  $("spreads").innerHTML=h;
  var b=$("addSpread");if(b)b.onclick=function(){addingSpread=true;$("cam").click()};
}

function renderResult(){
  var s=cur&&cur.sample;if(!s)return;
  var bad=s.warnings.length&&!showAnyway;
  $("retake").hidden=!bad;
  if(bad){
    $("checks").innerHTML=Object.keys(CHECKS).map(function(k){
      var f=s.warnings.indexOf(k)>=0,t=f?CHECKS[k]:[PASS[k],""];
      return'<li class="'+(f?"bad":"ok")+'"><b>'+t[0]+(k==="few"&&f?" · "+n0(s.count):"")+(k==="clumps"&&f?" · "+pc(s.rejects.clump/Math.max(1,s.count+s.rejects.clump)):"")+'</b>'+(t[1]?'<span>'+t[1]+'</span>':"")+'</li>';
    }).join("");
    if(!lsGet("grind-guide-fail-shown",0)){lsSet("grind-guide-fail-shown",1)}
  }
  $("results").hidden=bad;
  var c=cutoff();
  $("rD50").textContent="≈ "+n0(s.d50)+" µm";$("rD10").textContent=n0(s.d10);$("rD90").textContent=n0(s.d90);
  $("rFinesL").textContent="نواعم <"+c;$("rFines").textContent=pc(s.fines[c]||0);$("rCount").textContent=n0(s.count);
  $("rBars").innerHTML=bars([s],["a"]);
}
$("showAnyway").onclick=function(){showAnyway=true;renderResult()};
$("retakeBtn").onclick=function(){guide(true)};
$("newSample").onclick=function(){cur=null;img=null;res=null;$("photoCard").hidden=true;$("results").hidden=true;$("retake").hidden=true;renderHome();window.scrollTo(0,0)};

function bars(list,cls){
  var m=0;list.forEach(function(s){s.hist.forEach(function(v){m=Math.max(m,v)})});m=m||1;
  var h="";for(var i=0;i<16;i++){h+='<div class="bin">';list.forEach(function(s,j){h+='<i class="'+cls[j]+'" style="height:'+Math.max(2,Math.round(s.hist[i]/m*100))+'%"></i>'});h+="</div>"}
  return h;
}

// ---------- drawing + coin fix + crop ----------
var cv=$("ph"),ctx=cv.getContext("2d"),dScale=1;
function draw(){
  if(!img)return;
  dScale=Math.min(1,1400/img.w);cv.width=Math.round(img.w*dScale);cv.height=Math.round(img.h*dScale);
  ctx.drawImage(img.canvas,0,0,cv.width,cv.height);
  var lw=Math.max(1.5,cv.width/500);
  if(res&&res.ok&&mode!=="coin"){
    var cols=["#1f7fa8","#c26a1e","#9a9086"];
    res.particles.forEach(function(p){ctx.beginPath();ctx.strokeStyle=cols[p[3]];ctx.lineWidth=lw;if(p[3])ctx.setLineDash([3,2]);else ctx.setLineDash([]);ctx.arc(p[0]*dScale,p[1]*dScale,Math.max(2.5,p[2]*dScale+lw),0,7);ctx.stroke()});
    ctx.setLineDash([]);
    var c=res.coin;ctx.beginPath();ctx.strokeStyle="#1f7fa8";ctx.lineWidth=lw*2;ctx.arc(c.x*dScale,c.y*dScale,c.r*dScale,0,7);ctx.stroke();
    $("phChip").textContent=n0(res.diameters.length)+" حبيبة · "+n0(res.rejects.clump+res.rejects.edge)+" مرفوضة";$("phChip").hidden=false;
  }else $("phChip").hidden=true;
  if(mode==="coin"&&fix){
    ctx.beginPath();ctx.fillStyle="rgba(31,127,168,.12)";ctx.strokeStyle="#1f7fa8";ctx.lineWidth=lw*2;ctx.arc(fix.x*dScale,fix.y*dScale,fix.r*dScale,0,7);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.fillStyle="#fffdf9";ctx.arc((fix.x+fix.r)*dScale,fix.y*dScale,Math.max(9,lw*5),0,7);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.fillStyle="#1f7fa8";ctx.arc(fix.x*dScale,fix.y*dScale,Math.max(4,lw*2),0,7);ctx.fill();
  }
  if(crop){ctx.setLineDash([8,5]);ctx.strokeStyle="#c26a1e";ctx.lineWidth=lw*1.5;ctx.strokeRect(crop.x*dScale,crop.y*dScale,crop.w*dScale,crop.h*dScale);ctx.setLineDash([])}
}
function setMode(m){
  mode=m;$("fixRow").hidden=!m;
  $("modeHint").textContent=m==="coin"?"اسحب الدائرة فوق العملة، واسحب النقطة البيضاء لتغيير حجمها":m==="crop"?"اسحب على الصورة لتحديد الجزء اللي تبي تحلله":"";
  cv.style.touchAction=m?"none":"auto";draw();
}
$("coinFix").onclick=function(){if(!img)return;fix=res&&res.ok?{x:res.coin.x,y:res.coin.y,r:res.coin.r}:(fix||{x:img.w/2,y:img.h/2,r:Math.min(img.w,img.h)/8});setMode("coin")};
$("cropOn").onchange=function(){if(this.checked)setMode("crop");else{crop=null;setMode(null);if(img)analyze()}};
$("applyFix").onclick=function(){setMode(null);analyze()};
$("cancelFix").onclick=function(){if(mode==="crop"){crop=null;$("cropOn").checked=false}if(mode==="coin"&&res&&res.ok)fix=null;setMode(null)};

function imgPt(e){var r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*img.w,y:(e.clientY-r.top)/r.height*img.h}}
var drag=null;
cv.addEventListener("pointerdown",function(e){
  if(!mode||!img)return;var p=imgPt(e),tol=24/(cv.getBoundingClientRect().width/img.w);
  if(mode==="coin"){
    var dh=Math.hypot(p.x-(fix.x+fix.r),p.y-fix.y),dc=Math.hypot(p.x-fix.x,p.y-fix.y);
    drag=dh<tol||Math.abs(dc-fix.r)<tol*0.6?{k:"r"}:dc<fix.r?{k:"m",dx:p.x-fix.x,dy:p.y-fix.y}:{k:"m",dx:0,dy:0};
    if(drag.k==="m"&&dc>=fix.r){fix.x=p.x;fix.y=p.y}
  }else drag={k:"c",x:p.x,y:p.y};
  cv.setPointerCapture(e.pointerId);e.preventDefault();draw();
});
cv.addEventListener("pointermove",function(e){
  if(!drag)return;var p=imgPt(e);
  if(drag.k==="m"){fix.x=p.x-drag.dx;fix.y=p.y-drag.dy}
  else if(drag.k==="r")fix.r=Math.max(10,Math.hypot(p.x-fix.x,p.y-fix.y));
  else crop={x:Math.max(0,Math.min(drag.x,p.x)),y:Math.max(0,Math.min(drag.y,p.y)),w:Math.abs(p.x-drag.x),h:Math.abs(p.y-drag.y)};
  draw();
});
cv.addEventListener("pointerup",function(){drag=null});

// ---------- use in brew ----------
$("useBrew").onclick=function(){useInBrew(cur&&cur.sample)};
function useInBrew(s){
  if(!s)return;
  var d=lsGet(DRAFT,{v:{}});d.v=d.v||{};
  if(s.grinder){d.v.grinder=s.grinder;d.v.grind=s.setting}
  var c=cutoff();
  d.v.gmeas=JSON.stringify({d10:s.d10,d50:s.d50,d90:s.d90,f:Math.round((s.fines[c]||0)*1000)/10,c:c,n:s.count});
  lsSet(DRAFT,d);location.href="index.html";
}
$("goTr").onclick=function(){show("tr")};$("goCmp").onclick=function(){cmpMode="tr";show("cmp")};

// ---------- translate ----------
var selId=(latest()||{}).id||null;
function sel(){return byId(selId)||latest()}
function renderTr(){
  var s=sel();
  if(!s){$("trSample").innerHTML='<p class="hint" style="margin:0">ما فيه قياسات بعد. صوّر طحنة من قسم «تحليل».</p>';$("trRows").innerHTML="";return}
  var opts=samples.slice().sort(function(a,b){return b.t-a.t}).map(function(x){return'<option value="'+x.id+'"'+(x.id===s.id?" selected":"")+'>'+esc(sName(x))+" · "+fmtDate(x.t)+'</option>'}).join("");
  $("trSample").innerHTML='<div class="hint" style="margin:0">من الصورة · '+fmtDate(s.t)+" · "+s.spreads+' فرشة</div><b class="big" dir="ltr" style="display:block;text-align:right">D50 ≈ '+n0(s.d50)+' µm</b><div class="hint" style="margin:0">نواعم '+pc(s.fines[cutoff()]||0)+" · D10 "+n0(s.d10)+" · D90 "+n0(s.d90)+'</div><label style="margin-top:8px">عينة ثانية<select id="trPick">'+opts+'</select></label>';
  $("trPick").onchange=function(){selId=this.value;renderTr()};
  $("hasSrc").checked=!!s.grinder||srcOpen;$("srcBox").hidden=!s.grinder&&!srcOpen;
  if(!$("srcBox").hidden){fillGrinders($("srcG"),$("srcQ").value,s.grinder||$("srcG").value);if(document.activeElement!==$("srcSet"))$("srcSet").value=s.setting||"";$("calib").checked=s.calib!==false}
  calNote(s);
  var allow=$("allowEst").checked;
  $("trRows").innerHTML=targets.length?targets.map(function(k,i){
    var r=GrindTranslate.translate(s,k,Micron.dial(k),samples,{allowEst:allow}),note,cls;
    if(r.blocked){note="تحتاج "+r.need+" إعدادات مقاسة زيادة";cls="est"}
    else if(r.measured){note="مقاسة · "+r.samples+" قياسات"+(r.acc!=null?" · الدقة ±"+r.acc.toFixed(r.acc<1?1:0)+"%":"")+(r.overlap!=null?" · التطابق "+Math.round(r.overlap*100)+"%":"");cls="meas"}
    else{note="تقدير من الجدول";cls="est"}
    if(r.outside)note+=" · الطحنة خارج المدى";
    if(s.grinder===k)note+=" · إعدادك: "+s.setting;
    return'<div class="trrow '+cls+'"><div><b>'+esc(gname(k))+'</b><span>'+esc(note)+'</span></div><div class="trset"><span>الإعداد</span><b dir="ltr">'+(r.blocked?"—":esc(r.setting))+'</b></div><button type="button" class="btn del" data-i="'+i+'" aria-label="شيل الطاحونة">✕</button></div>';
  }).join(""):'<p class="hint">أضف الطواحين اللي تبي تعرف إعدادها لهذي الطحنة.</p>';
}
var srcOpen=false;
$("trRows").addEventListener("click",function(e){var b=e.target.closest(".del");if(b){targets.splice(+b.dataset.i,1);lsSet(TKEY,targets);renderTr()}});
$("allowEst").checked=lsGet("grind-allow-est",true);
$("allowEst").onchange=function(){lsSet("grind-allow-est",this.checked);renderTr()};
$("hasSrc").onchange=function(){
  var s=sel();if(!s)return;srcOpen=this.checked;
  if(!this.checked){s.grinder=null;s.idx=null;s.setting=null;upsert(s)}
  renderTr();
};
$("srcQ").oninput=function(){fillGrinders($("srcG"),this.value,null);saveSrc()};
$("srcG").onchange=saveSrc;$("srcSet").oninput=saveSrc;
$("calib").onchange=function(){var s=sel();if(s){s.calib=this.checked;upsert(s);renderTr()}};
function saveSrc(){
  var s=sel(),k=$("srcG").value,v=$("srcSet").value.trim();$("srcErr").textContent="";
  if(!s)return;
  if(!k||!v){s.grinder=null;s.idx=null;s.setting=null;upsert(s);calNote(s);return}
  var r=Micron.calc(k,v);
  if(r.e||r.between){$("srcErr").textContent=r.e||"اكتب إعداد موجود على الطاحونة";return}
  s.grinder=k;s.idx=Math.round(r.i);s.setting=r.label;upsert(s);renderTrRowsOnly();
}
function renderTrRowsOnly(){var a=document.activeElement&&document.activeElement.id;renderTr();if(a&&$(a))$(a).focus()}
function calNote(s){
  var el=$("calNote");
  if(!s||!s.grinder){el.hidden=true;return}
  el.hidden=false;$("calibL").textContent="احسبها في معايرة "+gname(s.grinder);
  if(s.calib===false){el.textContent="هذي الصورة ما راح تنحسب. شيلها لو الفرشة كانت سيئة.";el.className="note off";return}
  var c=GrindTranslate.contribution(samples,s),a=c.after,b=c.before;
  el.className="note";
  el.textContent=a.ready?gname(s.grinder)+" فيها "+a.settings+" إعدادات ("+a.samples+" قياسات)"+(a.acc!=null?"، والدقة ±"+a.acc.toFixed(1)+"%"+(b.ready&&b.acc!=null&&b.acc!==a.acc?" (كانت ±"+b.acc.toFixed(1)+"%)":""):"")+".":"صار عندك "+a.settings+" من "+GrindTranslate.MIN_SETTINGS+" إعدادات لهذي الطاحونة. صوّر "+a.need+" إعدادات ثانية عشان تصير الترجمة منها وإليها مقاسة.";
}
$("addQ").oninput=function(){fillGrinders($("addG"),this.value,null)};fillGrinders($("addG"),"",null);
$("addBtn").onclick=function(){var k=$("addG").value;if(!k){toast("اختر طاحونة");return}if(targets.indexOf(k)<0){targets.push(k);lsSet(TKEY,targets)}$("addQ").value="";fillGrinders($("addG"),"",null);renderTr()};

// ---------- compare ----------
var cmpMode="any",cmpA=null,cmpB=null,cmpT=null;
$("cmpTabs").addEventListener("click",function(e){var b=e.target.closest("button");if(b){cmpMode=b.dataset.m;renderCmp()}});
function renderCmp(){
  [].forEach.call($("cmpTabs").children,function(b){b.setAttribute("aria-pressed",b.dataset.m===cmpMode?"true":"false")});
  var list=samples.slice().sort(function(a,b){return b.t-a.t}),A=null,B=null,la="أ",lb="ب",pick="";
  function opts(cur){return list.map(function(x){return'<option value="'+x.id+'"'+(x.id===cur?" selected":"")+'>'+esc(sName(x))+" · "+fmtDate(x.t)+'</option>'}).join("")}
  if(cmpMode==="any"){
    if(list.length<2){$("cmpPick").innerHTML='<p class="hint" style="margin:0">تحتاج قياسين على الأقل.</p>';$("cmpOut").innerHTML="";return}
    cmpA=byId(cmpA)?cmpA:list[0].id;cmpB=byId(cmpB)?cmpB:list[1].id;A=byId(cmpA);B=byId(cmpB);
    pick='<div class="g2"><label>عينة أ<select id="cA">'+opts(cmpA)+'</select></label><label>عينة ب<select id="cB">'+opts(cmpB)+'</select></label></div>';
  }else if(cmpMode==="latest"){
    var p=GrindTranslate.latestPair(samples);
    if(!p){$("cmpPick").innerHTML='<p class="hint" style="margin:0">تحتاج قياسين لنفس الطاحونة ونفس الإعداد (حدد الطاحونة من قسم «ترجمة»).</p>';$("cmpOut").innerHTML="";return}
    A=p[0];B=p[1];la="آخر مرة";lb="السابقة";pick='<b>'+esc(sName(A))+'</b>';
  }else{
    var s=sel(),meas=targets.filter(function(k){return GrindTranslate.curve(samples,k).ready});
    if(!s||!meas.length){$("cmpPick").innerHTML='<p class="hint" style="margin:0">تحتاج طاحونة مقاسة (4 إعدادات) في قائمة الترجمة.</p>';$("cmpOut").innerHTML="";return}
    cmpT=meas.indexOf(cmpT)>=0?cmpT:meas[0];
    var r=GrindTranslate.translate(s,cmpT,Micron.dial(cmpT),samples,{}),c=GrindTranslate.curve(samples,cmpT),h=GrindTranslate.histAt(c,r.idx);
    A=s;B={hist:h.hist,under:h.under,over:h.over,d50:r.d50,fines:null,d10:null,d90:null};la="الصورة";lb=gname(cmpT)+" · "+r.setting;
    pick='<label>الطاحونة<select id="cT">'+meas.map(function(k){return'<option value="'+k+'"'+(k===cmpT?" selected":"")+'>'+esc(gname(k))+'</option>'}).join("")+'</select></label>';
  }
  $("cmpPick").innerHTML=pick;
  if($("cA"))$("cA").onchange=function(){cmpA=this.value;renderCmp()};
  if($("cB"))$("cB").onchange=function(){cmpB=this.value;renderCmp()};
  if($("cT"))$("cT").onchange=function(){cmpT=this.value;renderCmp()};
  var c=cutoff(),ov=GrindTranslate.overlap(A,B);
  function row(l,a,b,pct){var d=a!=null&&b!=null&&a?(pct?((b-a)*100).toFixed(1)+"":Math.round((b-a)/a*100)+"%"):"—";if(d!=="—"&&d.charAt(0)!=="-")d="+"+d;return'<tr><th>'+l+'</th><td>'+(a==null?"—":pct?pc(a):n0(a))+'</td><td>'+(b==null?"—":pct?pc(b):n0(b))+'</td><td dir="ltr">'+d+'</td></tr>'}
  $("cmpOut").innerHTML='<div class="g2"><div class="card leg"><span><i class="a"></i>'+esc(la)+'</span><b>'+esc(A.d50?("D50 "+n0(A.d50)+" µm"):"")+'</b></div><div class="card leg"><span><i class="b"></i>'+esc(lb)+'</span><b>'+esc(B.d50?("D50 "+n0(B.d50)+" µm"):"")+'</b></div></div>'
    +'<div class="card"><div class="d50row"><span class="hint" style="margin:0">توزيع الأحجام (بالحجم)</span><span>التطابق <b style="color:var(--acc)">'+Math.round(ov*100)+'%</b></span></div><div class="bars" dir="ltr">'+bars([A,B],["a","b"])+'</div><div class="axis" dir="ltr"><span>100</span><span>300</span><span>1000</span><span>2000 µm</span></div></div>'
    +'<div class="card tbl"><table><thead><tr><th></th><th>أ</th><th>ب</th><th>الفرق</th></tr></thead><tbody>'+row("D50",A.d50,B.d50)+row("D10",A.d10,B.d10)+row("D90",A.d90,B.d90)+row("نواعم",A.fines&&A.fines[c],B.fines&&B.fines[c],true)+'</tbody></table></div>';
}

// ---------- history ----------
var wearKey=null;
function renderHist(){
  var c=cutoff();$("cutoff").value=String(c);
  var groups={};samples.forEach(function(s){if(s.grinder&&s.idx!=null){var k=s.grinder+"|"+s.idx;(groups[k]=groups[k]||[]).push(s)}});
  var keys=Object.keys(groups).filter(function(k){return groups[k].length>=2});
  if(!keys.length)$("wearCard").innerHTML='<b>تآكل الترس</b><p class="hint">صوّر نفس الطاحونة على نفس الإعداد كل فترة، ويطلع هنا كيف تتغير النواعم مع الوقت.</p>';
  else{
    var bz=GrindTranslate.busiest(samples);wearKey=keys.indexOf(wearKey)>=0?wearKey:(bz?bz.grinder+"|"+bz.idx:keys[0]);
    var p=wearKey.split("|"),w=GrindTranslate.wear(samples,p[0],+p[1],c),opt=keys.map(function(k){var s=groups[k][0];return'<option value="'+k+'"'+(k===wearKey?" selected":"")+'>'+esc(sName(s))+'</option>'}).join("");
    var mn=Math.min.apply(null,w.map(function(x){return x.fines})),mx=Math.max.apply(null,w.map(function(x){return x.fines}));
    var pad=Math.max(0.01,(mx-mn)*0.25);mn=Math.max(0,mn-pad);mx=mx+pad;
    var X=function(i){return 40+(w.length===1?140:i*280/(w.length-1))},Y=function(v){return 10+(mx-v)/(mx-mn)*80};
    var pts=w.map(function(x,i){return X(i).toFixed(1)+","+Y(x.fines).toFixed(1)}).join(" ");
    var svg='<svg viewBox="0 0 330 112" width="100%" role="img" aria-label="نسبة النواعم عبر الوقت"><path d="M30 10H325M30 50H325M30 90H325" stroke="var(--line)" fill="none"/>'
      +'<text x="24" y="14" font-size="10" fill="var(--mute)" text-anchor="end">'+pc(mx)+'</text><text x="24" y="94" font-size="10" fill="var(--mute)" text-anchor="end">'+pc(mn)+'</text>'
      +'<polyline points="'+pts+'" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round"/>'
      +w.map(function(x,i){return'<circle cx="'+X(i)+'" cy="'+Y(x.fines)+'" r="3.5" fill="var(--acc)"/>'}).join("")
      +'<text x="'+X(0)+'" y="108" font-size="10" fill="var(--mute)" text-anchor="middle">'+fmtDate(w[0].t)+'</text><text x="'+X(w.length-1)+'" y="108" font-size="10" fill="var(--mute)" text-anchor="middle">'+fmtDate(w[w.length-1].t)+'</text></svg>';
    var d=w[w.length-1].fines-w[0].fines;
    $("wearCard").innerHTML='<label><b style="color:var(--ink)">تآكل الترس</b><select id="wearSel">'+opt+'</select></label>'+svg
      +'<p class="hint" style="margin:0">'+(d>0.02?"النواعم زادت من "+pc(w[0].fines)+" إلى "+pc(w[w.length-1].fines)+" على نفس الإعداد. ممكن الترس بدأ يتآكل.":"النواعم ثابتة تقريباً على هذا الإعداد.")+'</p>';
    $("wearSel").onchange=function(){wearKey=this.value;renderHist()};
  }
  var gs={};samples.forEach(function(s){if(s.grinder)gs[s.grinder]=1});
  var M=GrindTranslate.MIN_SETTINGS;
  $("calCard").innerHTML='<b>المعايرة على جوالك</b>'+(Object.keys(gs).length?Object.keys(gs).map(function(k){
    var cv=GrindTranslate.curve(samples,k),pct=Math.min(100,cv.settings/M*100);
    return'<div class="calrow"><div><span>'+esc(gname(k))+'</span><span class="'+(cv.ready?"okc":"estc")+'">'+(cv.ready?cv.settings+" إعدادات · جاهزة"+(cv.acc!=null?" · ±"+cv.acc.toFixed(1)+"%":""):cv.settings+" من "+M)+'</span></div><i style="--w:'+pct+'%" class="'+(cv.ready?"":"part")+'"></i></div>';
  }).join(""):'<p class="hint">حدد الطاحونة والإعداد لصورك من قسم «ترجمة»، وكل صورة تنحسب في معايرتها.</p>');
  var list=samples.slice().sort(function(a,b){return b.t-a.t});
  $("histList").innerHTML=list.length?list.map(function(s){
    return'<div class="hrow"><div><b>'+esc(sName(s))+'</b><span>'+fmtDate(s.t)+" · "+s.spreads+" فرشة"+(s.grinder&&s.calib!==false?" · معايرة":"")+'</span></div><div class="hnum"><span dir="ltr">D50 '+n0(s.d50)+'</span><span>نواعم '+pc(s.fines[c]||0)+'</span></div><button type="button" class="btn" data-tr="'+s.id+'">ترجم</button><button type="button" class="btn del" data-del="'+s.id+'" aria-label="احذف القياس">✕</button></div>';
  }).join(""):'<p class="hint">ما فيه قياسات محفوظة بعد.</p>';
}
$("histList").addEventListener("click",function(e){
  var t=e.target.closest("[data-tr]"),d=e.target.closest("[data-del]");
  if(t){selId=t.dataset.tr;show("tr")}
  if(d&&confirm("تحذف هذا القياس؟")){samples=samples.filter(function(s){return s.id!==d.dataset.del});saveSamples();if(cur&&cur.id===d.dataset.del)cur=null;renderHist()}
});
$("cutoff").onchange=function(){lsSet("grind-cutoff",+this.value);renderHist();if(cur&&cur.sample)renderResult()};
$("exportBtn").onclick=function(){
  var blob=new Blob([JSON.stringify({app:"brew-log grind analyzer",exported:new Date().toISOString(),samples:samples},null,1)],{type:"application/json"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="grind-samples-"+new Date().toISOString().slice(0,10)+".json";document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
};

if(!lsGet("grind-guide-seen",0))guide(true);

// Offline: cache the site and OpenCV.js so analysis works without internet after the first visit.
if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js").catch(function(){});

// ---------- home (analyzer main screen, shown until a photo is loaded) ----------
function renderHome(){
  var el=$("home");
  if(img){el.hidden=true;return}
  el.hidden=false;
  var list=samples.slice().sort(function(a,b){return b.t-a.t}),c=cutoff();
  if(!list.length){
    el.innerHTML='<div class="card"><h2>وش يطلع لك؟</h2><ul class="steps" style="margin:0 0 10px">'
      +'<li><b>حجم الحبيبات</b>: D50 والنواعم وتوزيع الأحجام.</li><li><b>ترجمة الطحنة</b>: نفس الحجم على أي طاحونة من 212.</li><li><b>متابعة الترس</b>: كيف تتغير النواعم مع الوقت.</li></ul>'
      +'<button type="button" class="btn" data-h="guide">كيف أصوّر؟</button></div>';
    return;
  }
  var s=list[0],gsAll={},ready=0,partial=0;
  samples.forEach(function(x){if(x.grinder)gsAll[x.grinder]=1});
  Object.keys(gsAll).forEach(function(k){if(GrindTranslate.curve(samples,k).ready)ready++;else partial++});
  el.innerHTML='<div class="card"><div class="d50row"><span class="hint" style="margin:0">آخر قياس · '+fmtDate(s.t)+'</span><span class="hint" style="margin:0">'+esc(sName(s))+'</span></div>'
    +'<b class="big" dir="ltr" style="display:block;text-align:right;margin:4px 0">D50 ≈ '+n0(s.d50)+' µm</b>'
    +'<div class="stats"><div><span>D10</span><b dir="ltr">'+n0(s.d10)+'</b></div><div><span>D90</span><b dir="ltr">'+n0(s.d90)+'</b></div><div><span>نواعم &lt;'+c+'</span><b>'+pc(s.fines[c]||0)+'</b></div><div><span>العدد</span><b>'+n0(s.count)+'</b></div></div>'
    +'<div class="row"><button type="button" class="btn p" data-h="brew" style="flex:1">استخدم في وصفتي</button><button type="button" class="btn" data-h="tr">ترجم</button><button type="button" class="btn" data-h="cmp">قارن</button></div></div>'
    +'<div class="hstats"><div class="card"><b>'+samples.length+'</b><span>قياس محفوظ</span></div><div class="card"><b>'+ready+'</b><span>طاحونة معايرة</span></div><div class="card"><b>'+partial+'</b><span>قيد المعايرة</span></div></div>'
    +(list.length>1?'<div class="card"><div class="d50row"><h2 style="margin:0">آخر القياسات</h2><button type="button" class="btn" data-h="hist">كل السجل</button></div>'
      +list.slice(0,3).map(function(x){return'<button type="button" class="hmini" data-id="'+x.id+'"><span>'+esc(sName(x))+'<small>'+fmtDate(x.t)+'</small></span><b dir="ltr">'+n0(x.d50)+' µm</b></button>'}).join("")+'</div>':"");
}
$("home").addEventListener("click",function(e){
  var b=e.target.closest("[data-h],[data-id]");if(!b)return;
  var s=latest();
  if(b.dataset.id){selId=b.dataset.id;show("tr");return}
  var h=b.dataset.h;
  if(h==="guide")guide(true);
  else if(h==="brew")useInBrew(s);
  else if(h==="tr"){selId=s.id;show("tr")}
  else if(h==="cmp"){cmpMode=GrindTranslate.latestPair(samples)?"latest":"any";show("cmp")}
  else if(h==="hist")show("hist");
});
renderHome();
