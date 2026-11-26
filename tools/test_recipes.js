// node tools/test_recipes.js : checks brew-log/recipes.js (pour plans from a recipe and a dose)
var path=require("path"),R=require(path.join(__dirname,"..","brew-log","recipes.js")),fails=0;
function check(name,ok,info){console.log((ok?"PASS ":"FAIL ")+name+(info?"  "+info:""));if(!ok)fails++}
var sum=function(a,k){return a.reduce(function(x,r){return x+r[k]},0)};

var p=R.plan("46",{dose:20,ratio:15});
check("4:6 at 20 g and 1:15: 50, 70, 60, 60, 60 ml",JSON.stringify(p.rows.map(function(r){return r.a}))==="[50,70,60,60,60]",JSON.stringify(p.rows.map(function(r){return r.a})));
check("4:6: first two pours are 40% of the water, the last three 60%",p.rows[0].a+p.rows[1].a===120&&sum(p.rows.slice(2),"a")===180);
check("4:6: pours start at 0:00, 0:45, 1:30, 2:10, 2:40 and the brew ends at 3:30",(function(){var t=0,s=[];p.rows.forEach(function(r){s.push(t);t+=r.d});return JSON.stringify(s)==="[0,45,90,130,160]"&&t===210})());
check("4:6: 92° and V60",p.temp===92&&p.method==="V60");
var p2=R.plan("46",{dose:15,ratio:15});
check("4:6 scales with the dose: 15 g makes 225 ml, split exactly",sum(p2.rows,"a")===225&&p2.water===225,JSON.stringify(p2.rows.map(function(r){return r.a})));
check("4:6 keeps the 40/60 split when scaled",Math.abs((p2.rows[0].a+p2.rows[1].a)/225-0.4)<0.01);

var h=R.plan("hoff",{dose:30,ratio:500/30});
check("Hoffmann at 30 g: 60 ml bloom, then to 300, then to 500",JSON.stringify(h.rows.map(function(r){return r.a}))==="[60,240,200]",JSON.stringify(h.rows.map(function(r){return r.a})));
check("Hoffmann: bloom 45 s, total 3:30, 97°",h.rows[0].d===45&&h.total===210&&h.temp===97);
var h2=R.plan("hoff",{dose:15,ratio:500/30});
check("Hoffmann at 15 g: 30 ml bloom, 250 ml total",h2.rows[0].a===30&&sum(h2.rows,"a")===250);
check("Hoffmann at the leanest allowed ratio still blooms below the 60% step",(function(q){return q&&q.rows[0].a<q.rows[0].a+q.rows[1].a&&q.rows.every(function(r){return r.a>0})})(R.plan("hoff",{dose:30,ratio:8})));

var e=R.equal(250,3);
check("equal split of 250 ml over 3 pours adds up exactly, extras to the first",JSON.stringify(e)==="[84,83,83]",JSON.stringify(e));
check("equal split never loses a millilitre",[1,7,100,251,999].every(function(w){return [1,2,3,4,5,6,7].every(function(n){var q=R.equal(w,n);return q&&sum(q.map(function(a){return {a:a}}),"a")===w&&Math.max.apply(null,q)-Math.min.apply(null,q)<=1})}));
check("equal split refuses zero water or zero pours",R.equal(0,3)===null&&R.equal(100,0)===null&&R.equal(-5,2)===null&&R.equal(100,NaN)===null);
check("the two ready recipes are 4:6 and Hoffmann",JSON.stringify(R.LIST.map(function(r){return r.id}))==='["46","hoff"]');
check("bad numbers give nothing",R.plan("46",{dose:0,ratio:15})===null&&R.plan("46",{dose:20,ratio:3})===null&&R.plan("nope",{dose:20,ratio:15})===null&&R.plan("custom",{dose:20,ratio:15})===null);
var all=true;[["46",{dose:5,ratio:8}],["46",{dose:100,ratio:25}],["hoff",{dose:5,ratio:25}],["hoff",{dose:100,ratio:25}]].forEach(function(x){var q=R.plan(x[0],x[1]);if(q&&sum(q.rows,"a")!==q.water)all=false});
check("pours add up to the water at the edges of the allowed range",all);
console.log(fails?fails+" failed":"all passed");process.exit(fails?1:0);
