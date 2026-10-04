window.onerror=function(m,u,l){var e=document.getElementById("jserr");if(e)e.textContent=String(m)+" (line "+l+")"};

var $=function(i){return document.getElementById(i)};
$("jsmsg").style.display="none";
var scores=[["الحلاوة","sw"],["الحمضية","ac"],["القوام","bd"],["المرارة","bt"],["النظافة","cl"]];
var adjs=["أنعم","أخشن","حرارة أعلى","حرارة أقل","ريشيو أطول","ريشيو أقصر","صب أهدأ","صب أعنف","تغيير فلتر","تغيير ماء","تغيير أداة"];
var sl=$("sliders");
scores.forEach(function(s){var d=document.createElement("div");d.className="sl";d.innerHTML='<span>'+s[0]+'</span><input type="range" min="0" max="10" value="5" id="'+s[1]+'" data-touched="0"><b id="'+s[1]+'v">—</b>';sl.appendChild(d)});
adjs.forEach(function(a){var l=document.createElement("label");l.innerHTML='<input type="checkbox" value="'+a+'"> '+a;$("adj").appendChild(l)});

function addPour(){var d=document.createElement("div");d.className="pour";
d.innerHTML='<div class="ac"><input class="a" type="number" min="0" step="10" inputmode="numeric" placeholder="50" aria-label="الكمية بالمل"><span>مل</span></div><div class="tc"><input class="t" type="text" inputmode="numeric" autocomplete="off" placeholder="0:45" aria-label="وقت الصبّة"><span class="tm"></span></div><div class="nt"><input type="text" placeholder="تفتيح / صب بطيء" aria-label="ملاحظة"></div><button type="button" class="btn del" title="حذف الصبّة" aria-label="حذف الصبّة">✕</button>';
$("pours").appendChild(d)}
function parseT(v){v=v.replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-1632}).replace(/[.,٫،;]/g,":");
if(!/^\d+(:\d{1,2})?$/.test(v))return null;
if(v.indexOf(":")>-1){var a=v.split(":"),x=+a[1];return x>59?null:+a[0]*60+x}
var ss=+v.slice(-2),mm=v.length>2?+v.slice(0,-2):0;return ss>59?null:mm*60+ss}
function fmtT(v){if(v==="")return"";var n=Math.max(0,Math.round(+v));var m=Math.floor(n/60),r=n%60;return m+":"+(r<10?"0":"")+r}
$("pours").addEventListener("click",function(e){var b=e.target.closest(".del");if(b){b.parentNode.remove();render()}});
addPour();addPour();
$("addPour").onclick=function(){addPour();render()};

var GR={"kultra": {"l": "K-Ultra", "um": 20, "f": "n10", "ph": "3.0", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)", "s": "1Zpresso الرسمي", "g": "a"}, "jultra": {"l": "J-Ultra", "um": 8, "f": "n10", "ph": "4.0", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)", "s": "1Zpresso الرسمي", "g": "a"}, "jmax": {"l": "J-Max (S)", "um": 8.8, "f": "n10", "ph": "3.0", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)", "s": "1Zpresso الرسمي", "g": "a"}, "xultra": {"l": "X-Ultra", "um": 12.5, "f": "n10", "ph": "3.0", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)", "s": "1Zpresso الرسمي", "g": "a"}, "zp6": {"l": "ZP6 Special", "um": 22, "f": "n10", "ph": "4.5", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)، محسوب على ZP6 Special", "s": "1Zpresso الرسمي", "g": "a"}, "kmax": {"l": "K-Max", "um": 22, "f": "n10", "ph": "3.5", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)", "s": "1Zpresso الرسمي", "g": "a"}, "kplus": {"l": "K-Plus", "um": 22, "f": "n10", "ph": "3.5", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)", "s": "1Zpresso الرسمي", "g": "a"}, "q2": {"l": "Q2", "um": 25, "f": "qair", "ph": "45", "h": "كليكات من الصفر مثل 45، أو لفة.رقم.كليك مثل 1.5.0 (3 كليكات لكل رقم، 30 كليك = لفة)", "s": "1Zpresso الرسمي", "g": "a"}, "qair": {"l": "Q-Air", "um": 25, "f": "qair", "ph": "45", "h": "كليكات من الصفر مثل 45، أو لفة.رقم.كليك مثل 1.5.0 (3 كليكات لكل رقم، 30 كليك = لفة)", "s": "1Zpresso الرسمي", "g": "a"}, "c40": {"l": "Comandante C40 / MK4", "um": 30, "f": "clk", "ph": "22", "h": "اكتب عدد الكليكات من الصفر مثل 22", "s": "Comandante، تغيّر حجم الحبيبة ≈30", "g": "a"}, "c40r": {"l": "Comandante C40 + Red Clix", "um": 15, "f": "clk", "ph": "44", "h": "اكتب كليكات Red Clix (الكليك العادي = 2)", "s": "Comandante", "g": "a"}, "c60": {"l": "Comandante C60 Baracuda", "um": 21, "f": "clk", "ph": "45", "h": "اكتب عدد الكليكات من الصفر مثل 45", "s": "Comandante الرسمي: حركة البر 41.6 µm وتغيّر الحبيبة ≈21 µm", "g": "a"}, "k6": {"l": "Kingrinder K6", "um": 16, "f": "clk", "ph": "90", "h": "اكتب عدد الكليكات من الصفر مثل 90 (60 كليك = لفة)", "s": "دليل Kingrinder", "g": "a"}, "c5": {"l": "Timemore C5 Pro", "um": 31, "f": "clk", "ph": "12", "h": "اكتب عدد الكليكات من نقطة الصفر (48 كليك = لفة)", "s": "Timemore الرسمي", "g": "a"}, "c3": {"l": "Timemore C3", "um": 83.3, "f": "clk", "ph": "13", "h": "اكتب عدد الكليكات من الصفر (12 كليك = لفة)", "s": "جدول متجر ينقل عن Timemore", "g": "b"}, "pietro": {"l": "Pietro", "um": 15, "f": "n10", "ph": "8.0", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)", "s": "الشركة (تقريبي)", "g": "b", "tag": "Pietro"}, "millab": {"l": "Millab M01", "um": 12.5, "f": "n10", "ph": "8.0", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)", "s": "Millab الرسمي", "g": "a"}, "a2": {"l": "Femobook A2", "um": 18, "f": "clk", "ph": "60", "h": "اكتب عدد الكليكات من الصفر (40 كليك = لفة)", "s": "Femobook الرسمي", "g": "a"}, "ode2": {"l": "Fellow Ode Gen 2", "um": 25, "f": "ode", "ph": "5.2", "h": "رقم من 1 إلى 11 والكليك بين الأرقام 0-2 مثل 5.2", "s": "تقديري فقط: فيلو ما تنشر ميكرون للخطوة وأدق حبيبة 250-300", "g": "b", "base": 275}, "nd2": {"l": "Monolith Flat Max", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd3": {"l": "Monolith MC", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd4": {"l": "Monolith SDRM", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd5": {"l": "Lagom P100", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd6": {"l": "Lagom 01", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd7": {"l": "Lagom P80", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd8": {"l": "Lagom P64", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd9": {"l": "Lagom Casa", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd10": {"l": "Lagom Mini", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd11": {"l": "EK43", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd12": {"l": "MX Cool aries", "nd": "ما لقيت مواصفات موثقة لها.", "g": "c"}, "nd13": {"l": "A4Z", "nd": "ما لقيت مواصفات موثقة لها.", "g": "c"}, "nd14": {"l": "E-pro", "nd": "ما عرفت أي طاحونة هذي بالضبط، ولا لقيت لها رقم موثق.", "g": "c"}, "nd15": {"l": "Kingrinder K1", "nd": "160 خطوة داخلية، والشركة ما تنشر ميكرون لكل خطوة.", "g": "c"}, "nd16": {"l": "Comandante Tigershark", "nd": "ما تأكدت من مواصفاتها فما أحوّل. إذا هي C40 MK4 اختر C40 / MK4.", "g": "c"}, "nd17": {"l": "Mavo Z Pro", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd18": {"l": "Mavo Phoenix Pro", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd19": {"l": "Atom75", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd20": {"l": "Mahlkönig X64 SD", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd21": {"l": "Eureka Single Dose", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd22": {"l": "Eureka Mignon Specialita", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd23": {"l": "DF83V", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd24": {"l": "DF83", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd25": {"l": "DF64V", "nd": "بدون رقم رسمي.", "g": "c"}, "nd26": {"l": "DF64", "nd": "بدون رقم رسمي. مستخدم في منتدى Home-Barista قاس ≈10.4 µm للخطوة، وهذا مو توثيق رسمي.", "g": "c"}, "nd27": {"l": "DF54", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd28": {"l": "Fellow Ode Gen 1", "nd": "فيلو تذكر أدق حبيبة ≈550 µm فقط، بدون رقم للخطوة.", "g": "c"}, "nd29": {"l": "Timemore Sculptor 064", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd30": {"l": "Timemore Sculptor 064s", "nd": "Timemore ما تنشر رقم رسمي. في المنتدى ينقلون عن دعمهم ≈5 µm للعلامة بدون توثيق.", "g": "c"}, "nd31": {"l": "Timemore Sculptor 078", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd32": {"l": "Timemore Sculptor 078s", "nd": "Timemore ما تنشر رقم رسمي. في المنتدى ينقلون عن دعمهم ≈5.6 µm للعلامة بدون توثيق.", "g": "c"}, "nd33": {"l": "Varia VS6", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd35": {"l": "Milo Play", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd36": {"l": "GE83", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd37": {"l": "G64", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd38": {"l": "GZZT Z63", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd39": {"l": "Hibrew G5", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd40": {"l": "G5 mini", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd41": {"l": "Baratza Encore", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd42": {"l": "Baratza Sette 30", "nd": "المدى الرسمي 230-950 µm على 30 خطوة، بدون رقم لكل خطوة.", "g": "c"}, "nd43": {"l": "Baratza BG", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd44": {"l": "Starseeker edge plus", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd45": {"l": "Potu-F Ghost Burr", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd46": {"l": "E55", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd47": {"l": "Codex D7", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd48": {"l": "Storm", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "nd49": {"l": "Wilfa Svart", "nd": "ما لقيت رقم ميكرون رسمي منشور من الشركة، فما أحوّل عشان ما أخمّن.", "g": "c"}, "weberEG1": {"l": "Weber EG-1", "um": 5, "f": "clk", "ph": "40", "h": "اكتب عدد الخطوات من نقطة الصفر (كل خطوة = 5 µm)، مو رقم الدايل", "s": "Weber Workshops الرسمي", "g": "a"}, "weberKey": {"l": "Weber Key", "um": 5, "f": "clk", "ph": "40", "h": "اكتب عدد الخطوات من نقطة الصفر (كل خطوة = 5 µm)، مو رقم الدايل", "s": "من جدول أرسلته عن Weber، ما تأكدت منه بمصدر ثاني", "g": "b"}, "vs3": {"l": "Varia VS3 (Gen 2)", "um": 10, "f": "clk", "ph": "300", "h": "اكتب عدد الخطوات من نقطة الصفر (كل خطوة = 10 µm)، مو رقم الدايل", "s": "10 µm حسب مواصفات Varia، ومتجر واحد يذكر 20", "g": "b"}, "jeplus": {"l": "JE-Plus", "um": 12.5, "f": "top", "ph": "1.5", "h": "كليكات من الصفر مثل 60، أو لفة.رقم مثل 1.5 (4 كليكات لكل رقم، 40 كليك = لفة)", "s": "1Zpresso الرسمي", "g": "a"}, "jxpro": {"l": "JX-Pro S", "um": 12.5, "f": "top", "ph": "1.5", "h": "كليكات من الصفر مثل 60، أو لفة.رقم مثل 1.5 (4 كليكات لكل رقم، 40 كليك = لفة)", "s": "1Zpresso الرسمي", "g": "a"}, "xpro": {"l": "X-Pro S", "um": 12.5, "f": "n10", "ph": "3.0", "h": "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)", "s": "1Zpresso الرسمي", "g": "a"}};
var gs=$("grinder");
var GP={a:"رقم رسمي من الشركة",b:"رقم تقريبي أو تقديري",c:"بدون رقم ميكرون موثق"};
gs.innerHTML='<option value="">—</option>'+["a","b","c"].map(function(x){return'<optgroup label="'+GP[x]+'">'+Object.keys(GR).filter(function(k){return GR[k].g===x}).map(function(k){return'<option value="'+k+'">'+GR[k].l+'</option>'}).join("")+'</optgroup>'}).join("")+'<option value="__o">طاحونة ثانية</option>';
function clicks(g,s){
  s=s.replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-1632}).replace(/[٫,]/g,".");
  var p=s.split("."),a=p.map(Number);
  if(p.some(function(x){return x===""})||a.some(isNaN))return{e:"الرقم غير مفهوم"};
  if(g.f==="clk"){return p.length>1?{e:"اكتب عدد الكليكات كامل بدون نقطة، مثل 90"}:{c:a[0]}}
  if(g.f==="n10"){
    if(p.length===1)return{c:a[0]*10};
    if(p.length===2&&p[1].length===1)return{c:a[0]*10+a[1]};
    return{e:"الصيغة رقم.كليك والكليك من 0 إلى 9، مثل 3.5"};
  }
  if(g.f==="top"){
    if(p.length===1)return{c:a[0]};
    if(p.length===2&&p[1].length===1)return{c:a[0]*40+a[1]*4};
    return{e:"الصيغة كليكات فقط، أو لفة.رقم مثل 1.5"};
  }
  if(g.f==="qair"){
    if(p.length===1)return{c:a[0]};
    if(p.length===3&&a[1]<=9&&a[2]<=2)return{c:a[0]*30+a[1]*3+a[2]};
    return{e:"الصيغة لفة.رقم.كليك (الرقم 0-9 والكليك 0-2) أو كليكات فقط"};
  }
  if(g.f==="ode"){
    if(a[0]<1||a[0]>11)return{e:"رقم الطاحونة من 1 إلى 11"};
    if(p.length===1)return{c:(a[0]-1)*3};
    if(p.length===2&&p[1].length===1&&a[1]<=2)return{c:(a[0]-1)*3+a[1]};
    return{e:"الكليك بين الأرقام 0 أو 1 أو 2، مثل 5.2"};
  }
}
function mic(){
  var g=GR[$("grinder").value],s=$("grind").value.trim(),el=$("micv");
  $("grind").placeholder=g?g.ph:"3.0 / 7.5";
  if(!g){el.innerHTML='<span class="hint">اختر الطاحونة وبعدين اكتب الرقم عشان يتحول لميكرون</span>';return""}
  if(g.nd){el.innerHTML='<b>'+g.l+'</b><br><span class="hint">'+g.nd+'</span>';return""}
  var head='<b>'+g.l+'</b>: '+g.um+' µm لكل كليك <span class="hint">('+g.s+')</span>';
  if(!s){el.innerHTML=head+'<br><span class="hint">'+g.h+'</span>';return""}
  var r=clicks(g,s);
  if(r.e){el.innerHTML=head+'<br><span style="color:#d9534f">'+r.e+'</span>';return""}
  var n=String(Math.round(((g.base||0)+r.c*g.um)*10)/10);
  el.innerHTML=head+'<br><span class="big">≈ '+n+' µm</span> <span class="hint">'+(g.base?g.base+' + ':'')+r.c+' × '+g.um+(g.base?' (تقديري)':'')+'</span>';
  return n;
}
function val(i){var e=$(i);if(e.tagName==="SELECT"){if(e.value==="__o")return $(i+"_o").value.trim();if(i==="grinder"&&GR[e.value])return GR[e.value].l}return e.value.trim()}
function line(k,v){return v?k+": "+v:""}
function fmtDate(v){if(!v)return"";var p=v.split("-");return p[2]+"/"+p[1]+"/"+p[0]}

function render(){
  document.querySelectorAll("select[data-o]").forEach(function(s){$(s.id+"_o").hidden=s.value!=="__o"});
  var mu=mic();
  var tl=[];["method","origin","process","grinder"].forEach(function(i){var v=$(i).value;if(v&&v!=="__o"){var tg=(i==="grinder"&&GR[v])?GR[v].tag:v;if(i==="method"&&["V60","Orea","Pulsar","AeroPress"].indexOf(v)<0)tg="";if(tg)tl.push(tg)}else if(v==="__o"&&i==="process")tl.push("معالجة-أخرى");else if(v==="__o"&&i==="origin")tl.push("دولة أخرى")});
  $("tags").innerHTML=tl.length?tl.map(function(t){return'<span class="tg">'+t+'</span>'}).join(""):'<span class="hint">تظهر هنا بعد ما تختار</span>';
  var d=+val("dose"),y=+val("yield");
  $("ratio").textContent=(d>0&&y>0)?"النسبة: 1:"+(y/d).toFixed(1):"";
  var head=[val("roaster")?"["+val("roaster")+"]":"",val("coffee")].filter(Boolean).join(" ");
  var t=head?head+(val("method")?" — "+val("method"):""):"";
  $("title").textContent=t||"العنوان يظهر هنا بعد ما تكتب المحمصة والمحصول";
  var L=[];
  L.push(line("المحمصة",val("roaster")),line("المحصول",val("coffee")),line("البلد",val("origin")),line("المعالجة",val("process")),line("تاريخ التحميص",fmtDate(val("roast"))),"",
    line("طريقة التحضير",val("method")),line("الأداة",val("tool")),line("الفلتر",val("filter")),line("الطاحونة",val("grinder")),line("درجة الطحن",val("grind")?val("grind")+(mu&&$("addmic").checked?" (≈"+mu+" µm)":""):""),
    line("الماء",val("water")),line("الحرارة",val("temp")?val("temp")+"°":""),line("الجرعة",val("dose")?val("dose")+" غ":""),line("الناتج",val("yield")?val("yield")+" غ":""),
    (d>0&&y>0)?"النسبة: 1:"+(y/d).toFixed(1):"",line("الوقت الكلي",val("time")));
  var run=0;var ps=[].slice.call(document.querySelectorAll(".pour")).map(function(p){var a=p.querySelector(".a").value.trim(),t=p.querySelector(".t").value.trim(),b=p.querySelector(".nt input").value.trim(),f="",bad=false;if(t!==""){var sec=parseT(t);if(sec===null)bad=true;else{f=fmtT(sec)}}p.querySelector(".tm").textContent=bad?"؟ مثل 1:20":"";var parts=[a?a+" مل":"",f,b].filter(Boolean);return parts.length?"- "+parts.join(" | "):""}).filter(Boolean);
  if(ps.length){L.push("","الوصفة:");L=L.concat(ps)}
  var sc=[];
  scores.forEach(function(s){var e=$(s[1]);if(e.dataset.touched==="1")sc.push(s[0]+": "+e.value+"/10");$(s[1]+"v").textContent=e.dataset.touched==="1"?e.value+"/10":"—"});
  if(val("taste")||sc.length){L.push("");if(val("taste"))L.push(line("الطعم",val("taste")));L=L.concat(sc)}
  if(val("notes"))L.push("",line("ملاحظات عامة",val("notes")));
  var ch=[].slice.call(document.querySelectorAll("#adj input:checked")).map(function(c){return"- "+c.value});
  if(ch.length){L.push("","وش يحتاج تعديل؟");L=L.concat(ch)}
  $("out").value=L.join("\n").replace(/^\n+/,"").replace(/\n{3,}/g,"\n\n");
}
document.addEventListener("input",function(e){if(e.target.type==="range")e.target.dataset.touched="1";render()});
document.addEventListener("change",render);

function copy(text,label){
  function ok(){$("msg").textContent="تم نسخ "+label+" ✓"}
  function fb(){var ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");ok()}catch(e){$("msg").textContent="ما اننسخ، حدد النص وانسخه يدوي"}document.body.removeChild(ta)}
  try{navigator.clipboard.writeText(text).then(ok,fb)}catch(e){fb()}
}
$("copyAll").onclick=function(){copy($("out").value,"النص")};
$("copyTitle").onclick=function(){var t=$("title").textContent;if(t.indexOf("يظهر هنا")<0)copy(t,"العنوان")};
$("reset").onclick=function(){
  document.querySelectorAll("input[type=text],input[type=number],input[type=date],textarea:not(#out)").forEach(function(e){e.value=""});
  document.querySelectorAll("#adj input").forEach(function(c){c.checked=false});
  document.querySelectorAll("select").forEach(function(x){x.selectedIndex=0});
  scores.forEach(function(s){$(s[1]).value=5;$(s[1]).dataset.touched="0"});
  $("pours").innerHTML="";addPour();addPour();render();
};
function isDark(){var t=document.documentElement.getAttribute("data-theme");if(t)return t==="dark";return !!(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)}
function themeLabel(){var d=isDark();$("theme").textContent=d?"☀️ فاتح":"🌙 داكن";document.documentElement.style.colorScheme=d?"dark":"light"}
try{var st=localStorage.getItem("theme");if(st==="dark"||st==="light")document.documentElement.setAttribute("data-theme",st)}catch(e){}
$("theme").onclick=function(){var t=isDark()?"light":"dark";document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("theme",t)}catch(e){}themeLabel()};
themeLabel();
render();
