// node tools/test_grind.js : checks brew-log/grind-analyze.js on synthetic photos
// (white paper, a coin of known size, particles drawn at known diameters).
// Needs: cd tools && npm install
var path=require("path"),assert=require("assert");
var GA=require(path.join(__dirname,"..","brew-log","grind-analyze.js"));
var cvMod=require("@techstark/opencv-js");
var fails=0;
function check(name,ok,info){console.log((ok?"PASS ":"FAIL ")+name+(info?"  "+info:""));if(!ok)fails++}

// Deterministic random numbers so every run draws the same picture.
function rng(seed){var s=seed>>>0;return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296}}

// opts: {W,H,coinMm,coinR,median,sigma,count,seed,clumps,blur,shadow}
function makePhoto(cv,o){
  var W=o.W||2400,H=o.H||1800,r=rng(o.seed||1),umPerPx=o.coinMm*1000/(2*o.coinR);
  var data=new Uint8ClampedArray(W*H*4),gray=new Float32Array(W*H);
  for(var i=0;i<W*H;i++){
    gray[i]=238+(r()-0.5)*8;
  }
  function disc(cx,cy,rad,val){
    var n=0,x0=Math.max(0,Math.floor(cx-rad-1)),x1=Math.min(W-1,Math.ceil(cx+rad+1)),y0=Math.max(0,Math.floor(cy-rad-1)),y1=Math.min(H-1,Math.ceil(cy+rad+1));
    for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++)if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=rad*rad){gray[y*W+x]=val;n++}
    return n;
  }
  var coin={x:W*0.82,y:H*0.74};
  disc(coin.x,coin.y,o.coinR,150);
  disc(coin.x-o.coinR*0.3,coin.y-o.coinR*0.3,o.coinR*0.25,185);
  // Truth = equivalent diameter of the pixels actually drawn.
  var placed=[],truth=[],tries=0,drawn=0;
  function eq(n){return 2*Math.sqrt(n/Math.PI)*umPerPx}
  while(truth.length<o.count&&tries<o.count*60){
    tries++;
    var dUm=o.median*Math.exp(o.sigma*gaussian(r)),rad=dUm/umPerPx/2;
    if(rad<2.2)continue;
    var cx=20+rad+r()*(W-40-2*rad),cy=20+rad+r()*(H-40-2*rad);
    if(Math.hypot(cx-coin.x,cy-coin.y)<o.coinR*1.6+rad)continue;
    var ok=true;for(var j=0;j<placed.length;j++){var p=placed[j];if(Math.hypot(p[0]-cx,p[1]-cy)<p[2]+rad+3){ok=false;break}}
    if(!ok)continue;
    placed.push([cx,cy,rad]);
    drawn++;
    if(o.clumps&&drawn%3===0){
      // Three grains stuck together in an L: the engine should split them back into three.
      disc(cx,cy,rad,55);disc(cx+rad*1.7,cy,rad,55);disc(cx,cy+rad*1.7,rad,55);
      for(var g=0;g<3;g++)truth.push(2*rad*umPerPx);
      placed[placed.length-1][2]=rad*3.2;
    }else truth.push(eq(disc(cx,cy,rad,55)));
  }
  // A shadow darkens everything under it: paper, coin and grains alike.
  for(var k=0;k<W*H;k++){var v=Math.max(0,Math.min(255,gray[k]*(o.shadow?1-0.45*(k%W)/W:1)));data[k*4]=v;data[k*4+1]=v*0.97;data[k*4+2]=v*0.94;data[k*4+3]=255}
  var img={data:data,width:W,height:H};
  if(o.blur){
    var m=cv.matFromImageData(img),b=new cv.Mat();
    cv.GaussianBlur(m,b,new cv.Size(0,0),o.blur);
    img={data:new Uint8ClampedArray(b.data),width:W,height:H};m.delete();b.delete();
  }
  return {img:img,truth:truth,coin:coin,umPerPx:umPerPx};
}
function gaussian(r){var u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function pct(a,b){return 100*(a-b)/b}

function run(cv){
  // 1. Accuracy on a typical filter grind.
  var p=makePhoto(cv,{coinMm:23,coinR:420,median:600,sigma:0.45,count:900,seed:7});
  var truth=GA.summarize([p.truth]);
  var t0=Date.now(),r=GA.analyzeImage(cv,p.img,{coinMm:23});
  var ms=Date.now()-t0;
  check("analysis ran",r.ok,r.error||(ms+" ms"));
  if(!r.ok){finish();return}
  var got=GA.summarize([r.diameters]);
  check("coin found within 1%",Math.abs(pct(r.coin.r,420))<1,"r="+r.coin.r.toFixed(1)+" (420)");
  check("D50 within 3%",Math.abs(pct(got.d50,truth.d50))<3,got.d50.toFixed(0)+" vs "+truth.d50.toFixed(0)+" µm");
  check("D10 within 5%",Math.abs(pct(got.d10,truth.d10))<5,got.d10.toFixed(0)+" vs "+truth.d10.toFixed(0));
  check("D90 within 5%",Math.abs(pct(got.d90,truth.d90))<5,got.d90.toFixed(0)+" vs "+truth.d90.toFixed(0));
  check("particle count within 3%",Math.abs(pct(got.count,truth.count))<3,got.count+" vs "+truth.count);
  check("fines within 1 point",Math.abs(got.fines[200]-truth.fines[200])*100<1,(got.fines[200]*100).toFixed(1)+"% vs "+(truth.fines[200]*100).toFixed(1)+"%");
  check("no warnings on a good photo",r.warnings.length===0,r.warnings.join(",")+" sharp="+r.sharpness.toFixed(0)+" shade="+r.shade.toFixed(2));
  var hsum=got.hist.reduce(function(a,b){return a+b},0)+got.under+got.over;
  check("histogram sums to 1",Math.abs(hsum-1)<1e-9,hsum.toFixed(6));

  // 2. Same photo twice gives an identical result.
  var r2=GA.analyzeImage(cv,p.img,{coinMm:23}),g2=GA.summarize([r2.diameters]);
  check("same photo twice is identical",JSON.stringify(g2)===JSON.stringify(got));

  // 3. Fine espresso-range grind, smaller coin in frame.
  var e=makePhoto(cv,{coinMm:23,coinR:520,median:300,sigma:0.4,count:1500,seed:3});
  var re=GA.analyzeImage(cv,e.img,{coinMm:23}),te=GA.summarize([e.truth]);
  if(re.ok){var ge=GA.summarize([re.diameters]);check("fine grind D50 within 3%",Math.abs(pct(ge.d50,te.d50))<3,ge.d50.toFixed(0)+" vs "+te.d50.toFixed(0));
    check("fine grind fines within 1 point",te.fines[200]>0.01&&Math.abs(ge.fines[200]-te.fines[200])*100<1,(ge.fines[200]*100).toFixed(1)+"% vs "+(te.fines[200]*100).toFixed(1)+"%")}
  else check("fine grind analysed",false,re.error);

  // 4. Manual coin gives the same scale as the detected one.
  var rm=GA.analyzeImage(cv,p.img,{coinMm:23,coin:{x:p.coin.x,y:p.coin.y,r:420}});
  check("manual coin works",rm.ok&&Math.abs(pct(rm.umPerPx,p.umPerPx))<0.01);

  // 5. Combining spreads: two photos of the same grind agree with their union.
  var p2=makePhoto(cv,{coinMm:23,coinR:420,median:600,sigma:0.45,count:900,seed:11});
  var rb=GA.analyzeImage(cv,p2.img,{coinMm:23});
  var both=GA.summarize([r.diameters,rb.diameters]),tb=GA.summarize([p.truth,p2.truth]);
  check("two spreads combined within 3%",Math.abs(pct(both.d50,tb.d50))<3,both.d50.toFixed(0)+" vs "+tb.d50.toFixed(0));
  check("two spreads agree within 5%",Math.abs(pct(GA.summarize([rb.diameters]).d50,got.d50))<5);

  // 6. Crop keeps only particles inside the box.
  var rc=GA.analyzeImage(cv,p.img,{coinMm:23,crop:{x:0,y:0,w:1200,h:1800}});
  check("crop limits the area",rc.ok&&rc.diameters.length<r.diameters.length*0.7&&rc.diameters.length>r.diameters.length*0.3,rc.diameters.length+" of "+r.diameters.length);

  // 7. Warnings.
  var nb=makePhoto(cv,{coinMm:23,coinR:420,median:600,sigma:0.45,count:900,seed:7,blur:3});
  var rbl=GA.analyzeImage(cv,nb.img,{coinMm:23});
  check("blurry photo warned",rbl.ok&&rbl.warnings.indexOf("blurry")>=0,rbl.ok?"sharp="+rbl.sharpness.toFixed(0)+" ["+rbl.warnings+"]":rbl.error);
  var cl=makePhoto(cv,{coinMm:23,coinR:420,median:600,sigma:0.35,count:700,seed:5,clumps:true});
  var rcl=GA.analyzeImage(cv,cl.img,{coinMm:23});
  check("clumps found and split, no clump warning",rcl.ok&&rcl.rejects.clump>100&&rcl.warnings.indexOf("clumps")<0,rcl.ok?"clumps="+rcl.rejects.clump+" ["+rcl.warnings+"]":rcl.error);
  if(rcl.ok){var gcl=GA.summarize([rcl.diameters]),tcl=GA.summarize([cl.truth]);check("split clumps keep D50 within 8%",Math.abs(pct(gcl.d50,tcl.d50))<8,gcl.d50.toFixed(0)+" vs "+tcl.d50.toFixed(0))}
  var far=makePhoto(cv,{coinMm:23,coinR:150,median:900,sigma:0.4,count:600,seed:9});
  var rf=GA.analyzeImage(cv,far.img,{coinMm:23});
  check("coin too small warned",rf.ok&&rf.warnings.indexOf("coin_small")>=0,rf.ok?"µm/px="+rf.umPerPx.toFixed(1):rf.error);
  var sh=makePhoto(cv,{coinMm:23,coinR:420,median:600,sigma:0.45,count:900,seed:13,shadow:true});
  var rs=GA.analyzeImage(cv,sh.img,{coinMm:23});
  check("shadow warned, still measured",rs.ok&&rs.warnings.indexOf("shadow")>=0&&Math.abs(pct(GA.summarize([rs.diameters]).d50,GA.summarize([sh.truth]).d50))<4,rs.ok?"shade="+rs.shade.toFixed(2):rs.error);
  var few=makePhoto(cv,{coinMm:23,coinR:420,median:600,sigma:0.45,count:120,seed:2});
  var rfew=GA.analyzeImage(cv,few.img,{coinMm:23});
  check("few particles warned",rfew.ok&&rfew.warnings.indexOf("few")>=0);

  // 8. No coin: clear error.
  var blank={data:new Uint8ClampedArray(800*600*4).fill(235),width:800,height:600};
  var rn=GA.analyzeImage(cv,blank,{coinMm:23});
  check("no coin gives coin_not_found",!rn.ok&&rn.error==="coin_not_found");
  finish();
}
function finish(){console.log(fails?fails+" failed":"all passed");process.exit(fails?1:0)}

if(cvMod.Mat)run(cvMod);else if(cvMod.then)cvMod.then(run);else cvMod.onRuntimeInitialized=function(){run(cvMod)};
