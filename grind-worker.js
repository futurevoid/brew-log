// Runs OpenCV.js and the grind analysis off the page's main thread.
var CV_URL="https://docs.opencv.org/4.10.0/opencv.js";
var ready=null;
// Resolves with {cv}: the OpenCV module is itself "thenable", so resolving a promise with it
// directly would make the promise wait on the module forever.
function load(){
  if(ready)return ready;
  ready=new Promise(function(res,rej){
    try{importScripts(CV_URL,"grind-analyze.js")}catch(e){rej(e);return}
    var c=self.cv,done=false;
    function finish(m){if(done)return;done=true;self.cv=m;res({cv:m})}
    if(!c){rej(new Error("OpenCV did not load"));return}
    if(c.Mat){finish(c);return}
    c.onRuntimeInitialized=function(){finish(c)};
    if(typeof c.then==="function")c.then(function(m){finish(m)});
    var t=setInterval(function(){if(self.cv&&self.cv.Mat){clearInterval(t);finish(self.cv)}},200);
  });
  return ready;
}
self.onmessage=function(e){
  var m=e.data;
  if(m.type==="init"){load().then(function(){postMessage({type:"ready"})},function(err){ready=null;postMessage({type:"error",message:String(err&&err.message||err)})});return}
  if(m.type==="analyze"){
    load().then(function(w){
      var img={data:new Uint8ClampedArray(m.buffer),width:m.width,height:m.height};
      var opts=m.opts||{};
      opts.progress=function(done,total){postMessage({type:"progress",id:m.id,done:done,total:total})};
      var r=GrindAnalyze.analyzeImage(w.cv,img,opts);
      var d=r.ok?new Float32Array(r.diameters):new Float32Array(0),wt=r.ok&&r.weights?new Float32Array(r.weights):null,tr=[d.buffer];
      if(r.ok){r.diameters=d;r.weights=wt;if(wt)tr.push(wt.buffer)}
      postMessage({type:"result",id:m.id,res:r},tr);
    }).catch(function(err){postMessage({type:"result",id:m.id,res:{ok:false,error:"engine",message:String(err&&err.message||err)}})});
  }
};
