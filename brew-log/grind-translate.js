// Grind translation from a measured photo to any grinder's setting.
// A grinder becomes "measured" once photos tagged with its settings cover MIN_SETTINGS different
// settings on this device; its setting -> D50 curve is a monotone (PCHIP) interpolation through them.
// Other grinders can fall back to the chart estimate from grinders.js, always labelled as such.
// Samples are plain objects: {id,t,d50,hist,under,over,fines,grinder,idx,setting,calib,...}.
(function(root){
  var MIN_SETTINGS=4;

  // Fritsch–Carlson monotone cubic through (xs, ys), xs strictly increasing.
  function pchip(xs,ys){
    var n=xs.length,h=[],d=[],m=[];
    for(var i=0;i<n-1;i++){h.push(xs[i+1]-xs[i]);d.push((ys[i+1]-ys[i])/h[i])}
    if(n===2){m=[d[0],d[0]]}
    else{
      m[0]=end(h[0],h[1],d[0],d[1]);m[n-1]=end(h[n-2],h[n-3],d[n-2],d[n-3]);
      for(var k=1;k<n-1;k++){
        if(d[k-1]*d[k]<=0)m[k]=0;
        else{var w1=2*h[k]+h[k-1],w2=h[k]+2*h[k-1];m[k]=(w1+w2)/(w1/d[k-1]+w2/d[k])}
      }
    }
    return function(x){
      if(x<=xs[0])return ys[0]+m[0]*(x-xs[0]);
      if(x>=xs[n-1])return ys[n-1]+m[n-1]*(x-xs[n-1]);
      var j=0;while(j<n-2&&x>xs[j+1])j++;
      var t=(x-xs[j])/h[j],t2=t*t,t3=t2*t;
      return (2*t3-3*t2+1)*ys[j]+(t3-2*t2+t)*h[j]*m[j]+(-2*t3+3*t2)*ys[j+1]+(t3-t2)*h[j]*m[j+1];
    };
  }
  function end(h0,h1,d0,d1){
    var v=((2*h0+h1)*d0-h0*d1)/(h0+h1);
    if(v*d0<=0)return 0;
    if(d0*d1<=0&&Math.abs(v)>Math.abs(3*d0))return 3*d0;
    return v;
  }

  function avgHist(list){
    var n=list.length,h=list[0].hist.map(function(){return 0}),u=0,o=0;
    list.forEach(function(s){s.hist.forEach(function(v,i){h[i]+=v/n});u+=(s.under||0)/n;o+=(s.over||0)/n});
    return {hist:h,under:u,over:o};
  }

  // Calibration curve for one grinder from this device's tagged samples (calib !== false).
  function curve(samples,key,skipId){
    var by={};
    samples.forEach(function(s){
      if(s.grinder===key&&s.idx!=null&&s.calib!==false&&s.id!==skipId&&s.d50>0)(by[s.idx]=by[s.idx]||[]).push(s);
    });
    var pts=Object.keys(by).map(Number).sort(function(a,b){return a-b}).map(function(i){
      var l=by[i],h=avgHist(l);
      return {i:i,d50:l.reduce(function(a,s){return a+s.d50},0)/l.length,hist:h.hist,under:h.under,over:h.over,n:l.length};
    });
    var total=pts.reduce(function(a,p){return a+p.n},0);
    var c={key:key,pts:pts,samples:total,settings:pts.length,ready:pts.length>=MIN_SETTINGS,need:Math.max(0,MIN_SETTINGS-pts.length)};
    if(c.ready){
      c.fn=pchip(pts.map(function(p){return p.i}),pts.map(function(p){return p.d50}));
      c.acc=accuracy(pts);
    }
    return c;
  }

  // Leave-one-out error of the curve at its inner points, as a percentage of D50.
  function accuracy(pts){
    var e=[];
    for(var k=1;k<pts.length-1;k++){
      var rest=pts.filter(function(_,j){return j!==k});
      var f=pchip(rest.map(function(p){return p.i}),rest.map(function(p){return p.d50}));
      e.push(Math.pow((f(pts[k].i)-pts[k].d50)/pts[k].d50,2));
    }
    if(!e.length)return null;
    return 100*Math.sqrt(e.reduce(function(a,b){return a+b},0)/e.length);
  }

  // Histogram expected at a setting: blend of the two calibrated neighbours.
  function histAt(c,i){
    var p=c.pts;
    if(i<=p[0].i)return p[0];
    if(i>=p[p.length-1].i)return p[p.length-1];
    var j=0;while(p[j+1].i<i)j++;
    var a=p[j],b=p[j+1],w=(i-a.i)/(b.i-a.i);
    return {hist:a.hist.map(function(v,k){return v*(1-w)+b.hist[k]*w}),under:a.under*(1-w)+b.under*w,over:a.over*(1-w)+b.over*w};
  }

  // Share of the two volume distributions that coincide (histogram intersection), 0..1.
  function overlap(a,b){
    var s=Math.min(a.under||0,b.under||0)+Math.min(a.over||0,b.over||0);
    for(var i=0;i<a.hist.length;i++)s+=Math.min(a.hist[i],b.hist[i]);
    return s;
  }

  // Closest setting on grinder `key` for a measured sample.
  // dial: Micron.dial(key). opts: {allowEst}. Returns
  // {measured, idx, setting, d50 (expected at that setting), acc, overlap, outside} or {blocked, need}.
  function translate(sample,key,dial,samples,opts){
    opts=opts||{};
    var c=curve(samples,key),best=-1,bd=Infinity,i;
    if(c.ready){
      var lo=c.pts[0].i,hi=c.pts[c.pts.length-1].i;
      for(i=lo;i<=hi;i++){if(!dial.uniq[i])continue;var dv=Math.abs(c.fn(i)-sample.d50);if(dv<bd){bd=dv;best=i}}
      var e=c.fn(best),minD=Math.min(c.fn(lo),c.fn(hi)),maxD=Math.max(c.fn(lo),c.fn(hi));
      return {measured:true,idx:best,setting:dial.labels[best],d50:Math.round(e),acc:c.acc,samples:c.samples,settings:c.settings,
        overlap:sample.hist?overlap(sample,histAt(c,best)):null,outside:sample.d50<minD*0.97||sample.d50>maxD*1.03};
    }
    if(!opts.allowEst)return {blocked:true,need:c.need,settings:c.settings};
    // opts.um: the photo's size in chart micron (built-in or own calibration). The chart is in chart micron,
    // so that is what it must be matched against; the raw photo D50 reads about 30% higher.
    var u=opts.um>0?opts.um:sample.d50;
    for(i=0;i<dial.labels.length;i++){if(!dial.uniq[i])continue;var d=Math.abs(dial.um(i)-u);if(d<bd){bd=d;best=i}}
    return {measured:false,ref:opts.um>0,idx:best,setting:dial.labels[best],d50:dial.um(best),settings:c.settings,need:c.need,
      outside:u<Math.min(dial.lo,dial.hi)*0.97||u>Math.max(dial.lo,dial.hi)*1.03};
  }

  // Straight-line fit of the grinder's chart micron against measured D50, over the calibrated settings.
  // Smoother than joining the points (each photo carries a few % of noise) and it extends a little past the
  // ends. acc = leave-one-out error (%) of the chart micron, ends included. Needs MIN_SETTINGS settings.
  function regress(samples,key,dial){
    var c=curve(samples,key);if(!c.ready)return null;
    var xs=c.pts.map(function(p){return p.d50}),ys=c.pts.map(function(p){return dial.um(p.i)});
    function fit(x,y){
      var n=x.length,mx=x.reduce(function(a,b){return a+b},0)/n,my=y.reduce(function(a,b){return a+b},0)/n,sxy=0,sxx=0;
      for(var i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)*(x[i]-mx)}
      if(!sxx)return null;var b=sxy/sxx;return {a:my-b*mx,b:b};
    }
    var f=fit(xs,ys);if(!f||!(f.b>0))return null;
    var e=0;
    for(var k=0;k<xs.length;k++){
      var g=fit(xs.filter(function(_,j){return j!==k}),ys.filter(function(_,j){return j!==k}));
      if(!g)return null;
      var pr=g.a+g.b*xs[k];e+=Math.pow((pr-ys[k])/ys[k],2);
    }
    return {a:f.a,b:f.b,acc:100*Math.sqrt(e/xs.length),min:Math.min.apply(null,xs),max:Math.max.apply(null,xs),n:xs.length,
      um:function(d50){return f.a+f.b*d50}};
  }

  // A photo just past the calibrated range: continue the line through the two nearest calibrated settings.
  // Only up to EXTRAP of D50 beyond the end; further out the answer is "outside the range".
  var EXTRAP=0.3;
  function extrapolate(sample,key,dial,samples){
    var c=curve(samples,key);if(!c.ready)return null;
    var p=c.pts,n=p.length,d=sample.d50,lo=p[0],hi=p[n-1],a,b;
    if(d<lo.d50&&d>=lo.d50*(1-EXTRAP)){a=p[0];b=p[1]}
    else if(d>hi.d50&&d<=hi.d50*(1+EXTRAP)){a=p[n-2];b=p[n-1]}
    else return null;
    var slope=(b.d50-a.d50)/(b.i-a.i);if(!(slope>0))return null;
    var fi=a.i+(d-a.d50)/slope,best=-1,bd=Infinity;
    if(fi<0||fi>dial.labels.length-1)return null;
    for(var i=0;i<dial.labels.length;i++){if(!dial.uniq[i])continue;var dv=Math.abs(i-fi);if(dv<bd){bd=dv;best=i}}
    return {idx:fi,setting:dial.labels[best],extrapolated:true};
  }

  // What counting this sample does to its grinder's calibration (before/after accuracy).
  function contribution(samples,sample){
    if(!sample.grinder||sample.idx==null)return null;
    var before=curve(samples,sample.grinder,sample.id),after=curve(samples.filter(function(s){return s.id!==sample.id}).concat([sample]),sample.grinder);
    return {before:before,after:after};
  }

  // Fines over time for one grinder at one setting, oldest first.
  function wear(samples,key,idx,cutoff){
    return samples.filter(function(s){return s.grinder===key&&s.idx===idx&&s.fines}).sort(function(a,b){return a.t-b.t})
      .map(function(s){return {t:s.t,fines:s.fines[cutoff]}});
  }
  // The grinder+setting measured most often, for the default wear chart.
  function busiest(samples){
    var c={},best=null;
    samples.forEach(function(s){if(s.grinder&&s.idx!=null){var k=s.grinder+"|"+s.idx;c[k]=(c[k]||0)+1;if(!best||c[k]>c[best])best=k}});
    if(!best)return null;var p=best.split("|");return {grinder:p[0],idx:+p[1],count:c[best]};
  }
  // Newest sample with a grinder and setting, and the one before it at the same grinder and setting.
  function latestPair(samples){
    var s=samples.filter(function(x){return x.grinder&&x.idx!=null}).sort(function(a,b){return b.t-a.t});
    for(var i=0;i<s.length;i++)for(var j=i+1;j<s.length;j++)if(s[j].grinder===s[i].grinder&&s[j].idx===s[i].idx)return [s[i],s[j]];
    return null;
  }

  // Built-in calibration: a photo's D50 (this engine, version 2) against the grinder-chart micron of the same grind.
  // The chart micron is one scale shared by every grinder in the list, so this works for all of them: photo D50 ->
  // chart micron here, then each grinder's own chart turns the micron into its setting. Measured on five real photos
  // (1Zpresso Q Air 1.5.0-3.5.0, chart 510-1190 µm). Hold-one-out on the page: every photo within 2% of its chart value.
  var REF_POINTS=[[753,510],[943,680],[1070,805],[1318,1020],[1520,1190]];
  var refCache=null;
  function reference(){
    if(refCache)return refCache;
    var xs=REF_POINTS.map(function(p){return p[0]}),ys=REF_POINTS.map(function(p){return p[1]});
    function fit(x,y){var n=x.length,mx=0,my=0,sxy=0,sxx=0,i;for(i=0;i<n;i++){mx+=x[i]/n;my+=y[i]/n}for(i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)*(x[i]-mx)}var b=sxy/sxx;return {a:my-b*mx,b:b}}
    var f=fit(xs,ys),e=0;
    for(var k=0;k<xs.length;k++){var g=fit(xs.filter(function(_,j){return j!==k}),ys.filter(function(_,j){return j!==k}));e+=Math.pow((g.a+g.b*xs[k]-ys[k])/ys[k],2)}
    refCache={a:f.a,b:f.b,acc:100*Math.sqrt(e/xs.length),min:Math.min.apply(null,xs),max:Math.max.apply(null,xs),n:xs.length,
      um:function(d50){return f.a+f.b*d50}};
    return refCache;
  }

  var api={MIN_SETTINGS:MIN_SETTINGS,pchip:pchip,curve:curve,translate:translate,overlap:overlap,histAt:histAt,
    contribution:contribution,extrapolate:extrapolate,regress:regress,reference:reference,wear:wear,busiest:busiest,latestPair:latestPair};
  if(typeof module==="object"&&module.exports)module.exports=api;else root.GrindTranslate=api;
})(typeof self!=="undefined"?self:this);
