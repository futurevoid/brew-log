// node tools/test_translate.js : checks brew-log/grind-translate.js with synthetic calibration data
var fs=require("fs"),path=require("path"),vm=require("vm");
var dir=path.join(__dirname,"..","brew-log"),ctx={};
vm.createContext(ctx);
["grinders.js","micron.js","grind-translate.js"].forEach(function(f){vm.runInContext(fs.readFileSync(path.join(dir,f),"utf8"),ctx)});
vm.runInContext("this.M=Micron;this.T=GrindTranslate;",ctx);
var M=ctx.M,T=ctx.T,fails=0;
function check(name,ok,info){console.log((ok?"PASS ":"FAIL ")+name+(info?"  "+info:""));if(!ok)fails++}

var C40=M.find("Comandante C40 MK4"),KU=M.find("1Zpresso K-Ultra"),ESP=M.find("Baratza Encore ESP");
var dC40=T.dial(M,C40),dKU=T.dial(M,KU),dESP=T.dial(M,ESP);
// Made-up "true" grinders: D50 grows smoothly with the setting (slightly curved, like real burrs).
function trueC40(i){return 40+29*i-0.12*i*i}
function trueKU(i){return 60+6.6*i+0.004*i*i}
function hist(d50){var h=[];for(var k=0;k<16;k++){var x=100*Math.pow(20,(k+0.5)/16);h.push(Math.exp(-Math.pow(Math.log(x/d50),2)/0.2))}var s=h.reduce(function(a,b){return a+b},0);return h.map(function(v){return v/s})}
var id=0;
function sample(key,i,d50,t){return {id:"s"+(++id),t:t||id,grinder:key,idx:i,setting:key?T.dial(M,key).labels[i]:null,calib:true,d50:d50,hist:hist(d50),under:0,over:0,fines:{100:0.02,150:0.05,200:0.1}}}

var S=[];
[10,16,22,28,34].forEach(function(i){S.push(sample(C40,i,trueC40(i)))});
[40,60,80,100].forEach(function(i){S.push(sample(KU,i,trueKU(i)))});

// PCHIP passes through its points and stays monotone.
var f=T.pchip([0,1,2,3],[0,1,1,4]),mono=true,prev=-1;
for(var x=0;x<=3;x+=0.05){var v=f(x);if(v<prev-1e-9)mono=false;prev=v}
check("pchip passes through points",Math.abs(f(2)-1)<1e-9&&Math.abs(f(3)-4)<1e-9);
check("pchip stays monotone",mono);

var c=T.curve(S,C40);
check("C40 curve ready with 5 settings",c.ready&&c.settings===5,"accuracy ±"+(c.acc||0).toFixed(1)+"%");
check("K-Ultra curve ready with 4 settings",T.curve(S,KU).ready);

// Photo of a C40 grind at 24 translates back to 24 on the C40.
var photo={d50:trueC40(24),hist:hist(trueC40(24)),under:0,over:0};
var r=T.translate(photo,C40,dC40,S,{allowEst:false});
check("photo from C40 24 -> C40 24",r.measured&&r.setting==="24",JSON.stringify({s:r.setting,d50:r.d50}));
check("overlap with own grinder is high",r.overlap>0.95,(r.overlap*100).toFixed(0)+"%");

// Same photo -> K-Ultra: setting whose true D50 is closest.
var rk=T.translate(photo,KU,dKU,S,{allowEst:false});
var bestI=0,bd=1e9;for(var i=40;i<=100;i++){var d=Math.abs(trueKU(i)-photo.d50);if(d<bd){bd=d;bestI=i}}
check("photo -> K-Ultra lands within one step of truth",rk.measured&&Math.abs(rk.idx-bestI)<=1,rk.setting+" (truth "+dKU.labels[bestI]+")");

// Round trip A -> B -> A within one step, across the calibrated range.
var worst=0,tried=0,flagged=0;
for(var s=12;s<=33;s++){
  var p={d50:trueC40(s),hist:hist(trueC40(s))};
  var b=T.translate(p,KU,dKU,S,{});
  // Beyond the K-Ultra's measured range the answer is clamped and flagged, not round-trippable.
  if(b.outside){flagged++;continue}
  tried++;
  var back=T.translate({d50:trueKU(b.idx),hist:hist(trueKU(b.idx))},C40,dC40,S,{});
  worst=Math.max(worst,Math.abs(back.idx-s));
}
check("round trip C40 -> K-Ultra -> C40 within one step",tried>=10&&worst<=1,"worst "+worst+" over "+tried+" settings, "+flagged+" flagged outside");

// Grinder without calibration.
var TC3=M.find("Timemore C3"),dTC3=T.dial(M,TC3);
var blocked=T.translate(photo,TC3,dTC3,S,{allowEst:false});
check("uncalibrated + measured-only is blocked",blocked.blocked&&blocked.need===4);
var est=T.translate(photo,TC3,dTC3,S,{allowEst:true});
var bi=0,bdd=1e9;for(var j=0;j<dTC3.labels.length;j++){var dd=Math.abs(dTC3.um(j)-photo.d50);if(dd<bdd){bdd=dd;bi=j}}
check("chart estimate picks the nearest chart setting",!est.measured&&est.idx===bi,est.setting+" ≈ "+est.d50+" µm");
var espRes=[];for(var dv=250;dv<=1350;dv+=25)espRes.push(T.translate({d50:dv},ESP,dESP,S,{allowEst:true}).idx);
check("estimates never land on a repeated label (Encore ESP)",espRes.every(function(k){return dESP.uniq[k]}));
check("out-of-range photo is flagged",T.translate({d50:5000},TC3,dTC3,S,{allowEst:true}).outside===true);

// Overlap.
var h1={hist:hist(600),under:0,over:0};
check("identical distributions overlap 100%",Math.abs(T.overlap(h1,h1)-1)<1e-9);
check("far-apart distributions overlap little",T.overlap(hist2(200),hist2(1800))<0.1);
function hist2(d){return {hist:hist(d),under:0,over:0}}

// Counting a new photo in the calibration.
var extra=sample(C40,24,trueC40(24));
var con=T.contribution(S,extra);
check("contribution adds a setting",con.before.settings===5&&con.after.settings===6&&con.after.samples===6);
check("excluded photos don't count",T.curve(S.concat([Object.assign({},extra,{calib:false})]),C40).settings===5);

// History helpers.
var H=[sample(C40,24,700,100),sample(C40,24,690,200),sample(C40,18,500,300),sample(C40,24,680,400)];
H[0].fines={200:0.10};H[1].fines={200:0.12};H[3].fines={200:0.14};
var w=T.wear(H,C40,24,200);
check("wear series in time order",w.length===3&&w[0].fines===0.10&&w[2].fines===0.14);
check("busiest grinder+setting",T.busiest(H).idx===24&&T.busiest(H).count===3);
var lp=T.latestPair(H);
check("latest vs previous at same setting",lp&&lp[0].t===400&&lp[1].t===200);


// Real measurements: five 1Zpresso Q Air photos at 1.5.0, 2.0.0, 2.3.2, 3.0.0, 3.5.0 (chart 510..1190 um).
var QA=M.find("1Zpresso Q Air"),dQA=T.dial(M,QA),qS=[];
[["1.5.0",751],["2.0.0",951],["2.3.2",1074],["3.0.0",1369],["3.5.0",1529]].forEach(function(p){var r=M.calc(QA,p[0]);qS.push(sample(QA,Math.round(r.i),p[1]))});
var rg=T.regress(qS,QA,dQA);
check("Q Air regression ready",!!rg&&rg.n===5,rg?"leave-one-out ±"+rg.acc.toFixed(1)+"%":"");
check("Q Air regression leave-one-out under 4%",rg&&rg.acc<4);
check("Q Air 2.3.2 photo reads about 805 um",rg&&Math.abs(rg.um(1074)-805)/805<0.04,rg?rg.um(1074).toFixed(0):"");
check("regression needs the minimum settings",T.regress(qS.slice(0,3),QA,dQA)===null);

// Built-in calibration (empty history): photo D50 -> chart micron, for any grinder.
var ref=T.reference();
check("built-in calibration fits its five photos within 2%",[[753,510],[943,680],[1070,805],[1318,1020],[1520,1190]].every(function(p){return Math.abs(ref.um(p[0])-p[1])/p[1]<0.02}),"chart = "+ref.a.toFixed(0)+" + "+ref.b.toFixed(3)+" x D50, leave-one-out ±"+ref.acc.toFixed(1)+"%");
check("built-in: the cropped 3.5.0 photo (D50 1,516) reads 1,190 within 2%",Math.abs(ref.um(1516)-1190)/1190<0.02,ref.um(1516).toFixed(0));
var lone={d50:1516,hist:hist(1516)};
var tq=T.translate(lone,QA,dQA,[],{allowEst:true,um:ref.um(1516)});
check("built-in, no history: Q Air setting from one photo is 3.5.0 (within one step)",Math.abs(tq.idx-105)<=1,tq.setting);
var mid={d50:943,hist:hist(943)},um2=ref.um(943);
var tc=T.translate(mid,C40,dC40,[],{allowEst:true,um:um2}),best=-1,bd=1e9;
for(var q=0;q<dC40.labels.length;q++){if(!dC40.uniq[q])continue;var dq=Math.abs(dC40.um(q)-um2);if(dq<bd){bd=dq;best=q}}
check("built-in works for other grinders: C40 setting is the one whose chart micron matches",tc.idx===best&&tc.ref===true&&!tc.outside,tc.setting+" ≈ "+Math.round(dC40.um(tc.idx))+" µm for "+Math.round(um2)+" µm");
var raw=T.translate(mid,C40,dC40,[],{allowEst:true});
check("without the conversion the raw photo D50 would pick a coarser C40 setting",raw.idx>tc.idx,raw.setting+" vs "+tc.setting);
console.log(fails?fails+" failed":"all passed");
process.exit(fails?1:0);
