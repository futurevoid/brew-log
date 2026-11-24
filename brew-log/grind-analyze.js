// Grind photo analysis with OpenCV.js: finds the reference coin, measures every particle on
// white paper and summarises the size distribution by volume (extraction follows volume, not count).
// Pure functions of the pixels and options, so the same photo always gives the same result.
(function(root){
  var BINS=16,BIN_LO=100,BIN_HI=2000,CUTOFFS=[100,150,200];
  var NOISE_PX=3,CLUMP_SOLIDITY=0.85,CLUMP_NOTCH=0.25,SOLIDITY_MIN_AREA=30,MAX_SPLIT=60;
  // Lumpy blobs that can't be split are left out. Measuring them whole (or after a finer split) was tried on the
  // real Q Air photos: it made the calibration less straight (hold-one-out 1.7% -> 2.2-2.3% rms), so they stay out.
  // Every photo is measured at the same pixel size (µm per pixel), so the result doesn't depend on
  // how far away the phone was. 0 turns this off.
  var WORK_UMPP=25,MAX_UP=2.2;
  // Five runs per photo: the main one plus zoom (20 and 31 µm/px) and threshold (-4%, +4%) variations.
  // On the real Q Air photos this halves the run-to-run spread of D50 (mean range over rescaled copies 1.7% -> 0.85%).
  var DEFAULT_VARIANTS=[{work:25,tm:1},{work:20,tm:1},{work:31,tm:1},{work:25,tm:0.96},{work:25,tm:1.04}];

  function odd(n){n=Math.max(3,Math.round(n));return n%2?n:n+1}

  // Strongest dark circle on a light background, refined at full resolution.
  function findCoin(cv,gray,rgba){
    // Gold-coloured coins (the 1 riyal) are found by colour first: it works on curved, glossy or
    // cluttered backgrounds where edge detection is fooled by plate rims and shadows.
    if(rgba){var cc=findGoldCoin(cv,rgba);if(cc)return cc}
    return findCoinEdges(cv,gray);
  }

  // Yellow-ish ring blob -> circle fitted to its outline.
  function findGoldCoin(cv,rgba){
    var rgb=new cv.Mat(),hsv=new cv.Mat(),mask=new cv.Mat(),lo=null,hi=null,cs=new cv.MatVector(),hh=new cv.Mat(),ker=null,out=null;
    try{
      var W=rgba.cols,H=rgba.rows,sc=Math.min(1,1000/Math.max(W,H));
      cv.cvtColor(rgba,rgb,cv.COLOR_RGBA2RGB);
      if(sc<1)cv.resize(rgb,rgb,new cv.Size(Math.round(W*sc),Math.round(H*sc)),0,0,cv.INTER_AREA);
      cv.cvtColor(rgb,hsv,cv.COLOR_RGB2HSV);
      lo=new cv.Mat(hsv.rows,hsv.cols,hsv.type(),[12,45,100,0]);hi=new cv.Mat(hsv.rows,hsv.cols,hsv.type(),[38,255,255,0]);
      cv.inRange(hsv,lo,hi,mask);
      var kk=odd(Math.max(hsv.cols,hsv.rows)/150);
      ker=cv.getStructuringElement(cv.MORPH_ELLIPSE,new cv.Size(kk,kk));
      cv.morphologyEx(mask,mask,cv.MORPH_CLOSE,ker);
      cv.findContours(mask,cs,hh,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_NONE);
      var m=Math.min(hsv.cols,hsv.rows),best=null;
      for(var i=0;i<cs.size();i++){
        var ct=cs.get(i),a=cv.contourArea(ct);
        if(a>m*m*0.0004){
          var r=cv.boundingRect(ct),asp=r.width/r.height;
          if(asp>0.75&&asp<1.33){
            var pts=[];for(var j=0;j<ct.data32S.length;j+=2)pts.push([ct.data32S[j],ct.data32S[j+1]]);
            var f=fitCircle(pts);
            if(f){
              var res=pts.map(function(q){return Math.abs(Math.hypot(q[0]-f.x,q[1]-f.y)-f.r)}),med=percentile(res,0.5);
              var good=pts.filter(function(q,k){return res[k]<Math.max(1.5,2.5*med)});
              if(good.length>=pts.length*0.6){f=fitCircle(good)||f}
              var fill=a/(Math.PI*f.r*f.r);
              // A coin outline is a filled disc: reject thin arcs, strips and ragged blobs.
              if(fill>0.75&&fill<1.2&&f.r>m*0.02&&f.r<m*0.4&&(!best||a>best.a))best={a:a,x:f.x,y:f.y,r:f.r};
            }
          }
        }
        ct.delete();
      }
      if(best)out={x:best.x/sc,y:best.y/sc,r:(best.r+0.5)/sc,refined:true,gold:true};
    }finally{rgb.delete();hsv.delete();mask.delete();cs.delete();hh.delete();if(lo)lo.delete();if(hi)hi.delete();if(ker)ker.delete()}
    return out;
  }

  function findCoinEdges(cv,gray){
    var W=gray.cols,H=gray.rows,s=Math.min(1,1000/Math.max(W,H));
    var small=new cv.Mat(),circles=new cv.Mat(),best=null;
    try{
      cv.resize(gray,small,new cv.Size(Math.round(W*s),Math.round(H*s)),0,0,cv.INTER_AREA);
      cv.GaussianBlur(small,small,new cv.Size(9,9),2);
      var m=Math.min(small.cols,small.rows);
      cv.HoughCircles(small,circles,cv.HOUGH_GRADIENT,1.5,m/4,120,40,Math.round(m*0.03),Math.round(m*0.3));
      var d=small.data,sw=small.cols,sh=small.rows;
      for(var i=0;i<circles.cols;i++){
        var cx=circles.data32F[i*3],cy=circles.data32F[i*3+1],r=circles.data32F[i*3+2];
        // Score: how much darker the disc is than the ring just outside it.
        var inS=0,inN=0,outS=0,outN=0,r2=r*r*0.8*0.8,o1=r*r*1.15*1.15,o2=r*r*1.4*1.4;
        var x0=Math.max(0,Math.floor(cx-r*1.4)),x1=Math.min(sw-1,Math.ceil(cx+r*1.4)),y0=Math.max(0,Math.floor(cy-r*1.4)),y1=Math.min(sh-1,Math.ceil(cy+r*1.4));
        for(var y=y0;y<=y1;y+=2)for(var x=x0;x<=x1;x+=2){
          var q=(x-cx)*(x-cx)+(y-cy)*(y-cy),v=d[y*sw+x];
          if(q<=r2){inS+=v;inN++}else if(q>=o1&&q<=o2){outS+=v;outN++}
        }
        if(!inN||!outN)continue;
        var score=outS/outN-inS/inN;
        if(score>12&&(!best||score>best.score))best={x:cx/s,y:cy/s,r:r/s,score:score};
      }
    }finally{small.delete();circles.delete()}
    if(!best)return null;
    var ref=refineCoin(cv,gray,best);
    return ref&&Math.abs(ref.r-best.r)/best.r<0.08?ref:{x:best.x,y:best.y,r:best.r,refined:false};
  }

  // Circle fitted to the coin's outline at full resolution: more precise than the Hough radius
  // (the scale of every measurement depends on it), and it still works when the coin is cut off
  // by the frame or grains touch it, because border points and outliers are left out.
  function refineCoin(cv,gray,c){
    var pad=c.r*1.5,x0=Math.max(0,Math.floor(c.x-pad)),y0=Math.max(0,Math.floor(c.y-pad));
    var x1=Math.min(gray.cols,Math.ceil(c.x+pad)),y1=Math.min(gray.rows,Math.ceil(c.y+pad));
    if(x1-x0<8||y1-y0<8)return null;
    var rw=x1-x0,rh=y1-y0,roi=gray.roi(new cv.Rect(x0,y0,rw,rh)),bin=new cv.Mat(),cs=new cv.MatVector(),hi=new cv.Mat(),pts=null;
    try{
      cv.GaussianBlur(roi,bin,new cv.Size(5,5),0);
      cv.threshold(bin,bin,0,255,cv.THRESH_BINARY_INV+cv.THRESH_OTSU);
      cv.findContours(bin,cs,hi,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_NONE);
      var bestA=0;
      for(var i=0;i<cs.size();i++){
        var ct=cs.get(i),a=cv.contourArea(ct);
        if(a>bestA&&cv.pointPolygonTest(ct,new cv.Point(c.x-x0,c.y-y0),false)>=0){
          bestA=a;pts=[];
          for(var j=0;j<ct.data32S.length;j+=2){var px=ct.data32S[j],py=ct.data32S[j+1];if(px>1&&py>1&&px<rw-2&&py<rh-2)pts.push([px,py])}
        }
        ct.delete();
      }
    }finally{roi.delete();bin.delete();cs.delete();hi.delete()}
    if(!pts||pts.length<20)return null;
    var f=fitCircle(pts);
    if(!f)return null;
    // Drop points far off the circle (grains touching the coin, glare) and fit again.
    var res=pts.map(function(p){return Math.abs(Math.hypot(p[0]-f.x,p[1]-f.y)-f.r)}),med=percentile(res,0.5);
    var good=pts.filter(function(p,k){return res[k]<Math.max(2,2.5*med)});
    if(good.length>=20)f=fitCircle(good)||f;
    // Outline points are boundary pixel centres, half a pixel inside the edge.
    return {x:x0+f.x,y:y0+f.y,r:f.r+0.5,refined:true};
  }
  // Least-squares (Kasa) circle through points.
  function fitCircle(p){
    var n=p.length,sx=0,sy=0,sxx=0,syy=0,sxy=0,sxz=0,syz=0,sz=0;
    for(var i=0;i<n;i++){var x=p[i][0],y=p[i][1],z=x*x+y*y;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;sxz+=x*z;syz+=y*z;sz+=z}
    // Solve [sxx sxy sx; sxy syy sy; sx sy n] [a b c] = -[sxz syz sz]
    var m=[[sxx,sxy,sx,-sxz],[sxy,syy,sy,-syz],[sx,sy,n,-sz]];
    for(var col=0;col<3;col++){
      var piv=col;for(var r=col+1;r<3;r++)if(Math.abs(m[r][col])>Math.abs(m[piv][col]))piv=r;
      var t=m[col];m[col]=m[piv];m[piv]=t;
      if(Math.abs(m[col][col])<1e-12)return null;
      for(var r2=0;r2<3;r2++)if(r2!==col){var k=m[r2][col]/m[col][col];for(var c2=col;c2<4;c2++)m[r2][c2]-=k*m[col][c2]}
    }
    var a=m[0][3]/m[0][0],b=m[1][3]/m[1][1],cc=m[2][3]/m[2][2],cx=-a/2,cy=-b/2,r2v=cx*cx+cy*cy-cc;
    return r2v>0?{x:cx,y:cy,r:Math.sqrt(r2v)}:null;
  }

  function percentile(arr,p){if(!arr.length)return 0;var a=arr.slice().sort(function(x,y){return x-y});return a[Math.min(a.length-1,Math.floor(p*(a.length-1)))]}

  // One photo -> scale, particles and quality checks.
  // img: {data:Uint8ClampedArray RGBA, width, height}; o: {coinMm, coin?:{x,y,r} manual, crop?:{x,y,w,h}}
  function analyzeImage(cv,img,o){
    o=o||{};
    var src=cv.matFromImageData(img),gray=new cv.Mat(),mats=[src,gray];
    function keep(m){mats.push(m);return m}
    try{
      cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
      var W=gray.cols,H=gray.rows;
      var crop=o.crop?{x:Math.max(0,Math.round(o.crop.x)),y:Math.max(0,Math.round(o.crop.y)),w:Math.round(o.crop.w),h:Math.round(o.crop.h)}:{x:0,y:0,w:W,h:H};
      crop.w=Math.min(crop.w,W-crop.x);crop.h=Math.min(crop.h,H-crop.y);
      var coin=o.coin?{x:o.coin.x,y:o.coin.y,r:o.coin.r,manual:true}:findCoin(cv,gray,src);
      if(!coin)return {ok:false,error:"coin_not_found",width:W,height:H};
      var coinMm=o.coinMm||23,umPerPx=coinMm*1000/(2*coin.r);

      // Even out the paper: a max filter wider than any particle leaves only the background.
      var s=Math.min(1,800/Math.max(W,H)),bgS=keep(new cv.Mat()),bg=keep(new cv.Mat()),flat=keep(new cv.Mat());
      cv.resize(gray,bgS,new cv.Size(Math.round(W*s),Math.round(H*s)),0,0,cv.INTER_AREA);
      var k=odd(3000/umPerPx*s);
      var ker=keep(cv.getStructuringElement(cv.MORPH_ELLIPSE,new cv.Size(k,k)));
      cv.dilate(bgS,bgS,ker);
      cv.GaussianBlur(bgS,bgS,new cv.Size(odd(k/2),odd(k/2)),0);
      // Paper evenness (shadows), measured away from the coin.
      var bv=[],bd=bgS.data,bw=bgS.cols;
      for(var y=0;y<bgS.rows;y+=3)for(var x=0;x<bw;x+=3){var dx=x/s-coin.x,dy=y/s-coin.y;if(dx*dx+dy*dy>Math.pow(coin.r*1.6,2))bv.push(bd[y*bw+x])}
      // Only paper counts: a dark table or plate edge around the sheet isn't a shadow on the grains.
      var ref95=percentile(bv,0.95);bv=bv.filter(function(v){return v>=0.6*ref95});
      var p50=percentile(bv,0.5)||1,shade=(percentile(bv,0.95)-percentile(bv,0.05))/p50;
      // Anything much darker than the paper (a table, a plate rim) isn't paper: particles there aren't grains.
      var paperMin=0.45*ref95;
      cv.resize(bgS,bg,new cv.Size(W,H),0,0,cv.INTER_LINEAR);
      cv.divide(gray,bg,flat,255);

      var bin=keep(new cv.Mat());
      var t=cv.threshold(flat,bin,0,255,cv.THRESH_BINARY_INV+cv.THRESH_OTSU);
      if(o.thr){t=o.thr;cv.threshold(flat,bin,t,255,cv.THRESH_BINARY_INV)}
      else if(t<100||t>215)cv.threshold(flat,bin,Math.min(215,Math.max(100,t)),255,cv.THRESH_BINARY_INV);
      var open=keep(cv.getStructuringElement(cv.MORPH_ELLIPSE,new cv.Size(3,3)));
      cv.morphologyEx(bin,bin,cv.MORPH_OPEN,open);
      // Remove the coin and everything outside the crop.
      cv.circle(bin,new cv.Point(Math.round(coin.x),Math.round(coin.y)),Math.round(coin.r*1.25),new cv.Scalar(0),-1);
      if(o.crop){
        var keepM=keep(cv.Mat.zeros(H,W,cv.CV_8UC1));
        cv.rectangle(keepM,new cv.Point(crop.x,crop.y),new cv.Point(crop.x+crop.w-1,crop.y+crop.h-1),new cv.Scalar(255),-1);
        cv.bitwise_and(bin,keepM,bin);
      }

      // Particle stage. It runs at a fixed working pixel size (sharpness above stays at the photo's own size)
      // and can run several times at slightly different zoom and threshold settings: the grain-splitting and
      // edge decisions that flip from run to run average out, so the reading is steadier.
      function stage(work,tmul,pre){
        var pf=1,tmp=[];
        function own(m){tmp.push(m);return m}
        if(work>0){var fw=umPerPx/work;if(Math.abs(fw-1)>0.04)pf=Math.min(fw,MAX_UP)}
        var pum=umPerPx/pf,binP=bin,PW=W,PH=H,cropP=crop;
        try{
          if(pf!==1||tmul!==1||pre){
            var flatP=flat;
            if(pf!==1){PW=Math.round(W*pf);PH=Math.round(H*pf);flatP=own(new cv.Mat());cv.resize(flat,flatP,new cv.Size(PW,PH),0,0,pf<1?cv.INTER_AREA:cv.INTER_LINEAR)}
            if(pre)flatP=preprocess(cv,flatP,pre,own);
            binP=own(new cv.Mat());
            cv.threshold(flatP,binP,Math.min(225,Math.max(90,t*tmul)),255,cv.THRESH_BINARY_INV);
            cv.morphologyEx(binP,binP,cv.MORPH_OPEN,open);
            cv.circle(binP,new cv.Point(Math.round(coin.x*pf),Math.round(coin.y*pf)),Math.round(coin.r*pf*1.25),new cv.Scalar(0),-1);
            cropP={x:Math.round(crop.x*pf),y:Math.round(crop.y*pf),w:Math.round(crop.w*pf),h:Math.round(crop.h*pf)};
            cropP.w=Math.min(cropP.w,PW-cropP.x);cropP.h=Math.min(cropP.h,PH-cropP.y);
            if(o.crop){
              var keepP=own(cv.Mat.zeros(PH,PW,cv.CV_8UC1));
              cv.rectangle(keepP,new cv.Point(cropP.x,cropP.y),new cv.Point(cropP.x+cropP.w-1,cropP.y+cropP.h-1),new cv.Scalar(255),-1);
              cv.bitwise_and(binP,keepP,binP);
            }
          }
          var labels=own(new cv.Mat()),stats=own(new cv.Mat()),cents=own(new cv.Mat());
          var n=cv.connectedComponentsWithStats(binP,labels,stats,cents,8,cv.CV_32S);
          var st=stats.data32S,cd=cents.data64F,lab=labels.data32S;
          // Second moments per blob give each grain's width (minor axis): a sieve sorts by that, not by outline area.
          var mSx=new Float64Array(n),mSy=new Float64Array(n),mSxx=new Float64Array(n),mSyy=new Float64Array(n),mSxy=new Float64Array(n);
          for(var py=0;py<PH;py++)for(var px=0,pi=py*PW;px<PW;px++,pi++){var lb=lab[pi];if(lb>0){mSx[lb]+=px;mSy[lb]+=py;mSxx[lb]+=px*px;mSyy[lb]+=py*py;mSxy[lb]+=px*py}}
          // rej.clump counts only clumps left out; rej.split counts clumps split into grains (those are measured).
          var widths=[],lengths=[],parts=[],diams=[],rej={noise:0,edge:0,clump:0,split:0},unsplit=0;
          // Overlay positions are reported in the photo's own pixels.
          function mark(x,y,r,status){parts.push([Math.round(x/pf),Math.round(y/pf),Math.round(r/pf*10)/10,status])}
          for(var i=1;i<n;i++){
            var bx=st[i*5],by=st[i*5+1],bwid=st[i*5+2],bh=st[i*5+3],area=st[i*5+4];
            if(area<NOISE_PX){rej.noise++;continue}
            var cx=cd[i*2],cy=cd[i*2+1],rpx=Math.sqrt(area/Math.PI),status=0;
            if(bx<=cropP.x||by<=cropP.y||bx+bwid>=cropP.x+cropP.w||by+bh>=cropP.y+cropP.h){rej.edge++;status=2}
            else if(offPaper(cx/pf,cy/pf)){rej.edge++;status=2}
            else if(area>=SOLIDITY_MIN_AREA&&isClump(cv,lab,PW,i,bx,by,bwid,bh,rpx)){
              // Touching grains: split them (distance transform + watershed) instead of throwing them away.
              var pieces=splitClump(cv,lab,PW,i,bx,by,bwid,bh);
              if(pieces&&pieces.length===1){diams.push(2*Math.sqrt(pieces[0].a/Math.PI)*pum);var a1=axes(area,mSx[i],mSy[i],mSxx[i],mSyy[i],mSxy[i]);widths.push(a1[1]*pum);lengths.push(a1[0]*pum);mark(cx,cy,rpx,0);continue}
              if(pieces&&pieces.length>1&&pieces.length<=MAX_SPLIT){
                rej.split++;
                pieces.forEach(function(q){var pr=Math.sqrt(q.a/Math.PI);diams.push(2*pr*pum);var aq=axes(q.a,q.sx,q.sy,q.sxx,q.syy,q.sxy);widths.push(aq[1]*pum);lengths.push(aq[0]*pum);mark(bx+q.x,by+q.y,pr,3)});
                continue;
              }
              rej.clump++;unsplit++;status=1;
            }
            if(!status){diams.push(2*rpx*pum);var ax=axes(area,mSx[i],mSy[i],mSxx[i],mSyy[i],mSxy[i]);widths.push(ax[1]*pum);lengths.push(ax[0]*pum)}
            mark(cx,cy,rpx,status);
          }
          return {diams:diams,widths:widths,lengths:lengths,parts:parts,rej:rej,unsplit:unsplit};
        }finally{tmp.forEach(function(m){m.delete()})}
      }
      function offPaper(x,y){var yy=Math.min(bgS.rows-1,Math.round(y*s)),xx=Math.min(bw-1,Math.round(x*s));return bd[yy*bw+xx]<paperMin}
      var variants=o.variants||DEFAULT_VARIANTS,runs=[];
      for(var vi=0;vi<variants.length;vi++){
        runs.push(stage(variants[vi].work===undefined?WORK_UMPP:variants[vi].work,variants[vi].tm||1,variants[vi].pre||o.pre||null));
        if(o.progress)o.progress(vi+1,variants.length);
      }
      var main=runs[0],diams=main.diams,widths=main.widths,lengths=main.lengths,parts=main.parts,rej=main.rej,unsplit=main.unsplit;
      // Pool the runs: each grain counts 1/runs, so counts stay those of one photo.
      var pooled=diams,weights=null;
      if(runs.length>1){
        pooled=[];weights=[];
        runs.forEach(function(r){for(var q=0;q<r.diams.length;q++){pooled.push(r.diams[q]);weights.push(1/runs.length)}});
      }

      var sharp=sharpness(cv,flat,bin,crop,open,keep);

      var warnings=[];
      if(umPerPx>45)warnings.push("coin_small");
      if(sharp<5)warnings.push("blurry");
      if(diams.length<150)warnings.push("few");
      if(unsplit/Math.max(1,diams.length+unsplit)>0.30)warnings.push("clumps");
      if(shade>0.38)warnings.push("shadow");
      return {ok:true,width:W,height:H,coin:coin,coinMm:coinMm,umPerPx:umPerPx,crop:o.crop?crop:null,
        diameters:pooled,weights:weights,widths:widths,lengths:lengths,particles:parts,rejects:rej,threshold:t,sharpness:sharp,shade:shade,warnings:warnings,
        runs:o.debug?runs.map(function(r){return r.diams}):undefined};
    }finally{mats.forEach(function(m){m.delete()})}
  }

  // Optional cleanup of the (flat-fielded) working image before thresholding. Returns a new Mat.
  // pre: {g: gaussian sigma (denoise), b: bilateral denoise strength, u: [sigma, amount] unsharp mask}
  function preprocess(cv,src,pre,own){
    var cur=own(src.clone());
    if(pre.g){var gk=odd(pre.g*6);cv.GaussianBlur(cur,cur,new cv.Size(gk,gk),pre.g)}
    if(pre.b){var tmpb=own(new cv.Mat());cv.bilateralFilter(cur,tmpb,7,pre.b,3);cur=tmpb}
    if(pre.u){var bl=own(new cv.Mat()),uk=odd(pre.u[0]*6);cv.GaussianBlur(cur,bl,new cv.Size(uk,uk),pre.u[0]);cv.addWeighted(cur,1+pre.u[1],bl,-pre.u[1],0,cur)}
    return cur;
  }

  // Length and width (full axes, px) of the ellipse with the same second moments as a blob.
  function axes(a,sx,sy,sxx,syy,sxy){
    var cx=sx/a,cy=sy/a,mxx=sxx/a-cx*cx+1/12,myy=syy/a-cy*cy+1/12,mxy=sxy/a-cx*cy;
    var h=(mxx+myy)/2,d=Math.sqrt(Math.max(0,((mxx-myy)/2)*((mxx-myy)/2)+mxy*mxy));
    return [4*Math.sqrt(Math.max(h+d,0)),4*Math.sqrt(Math.max(h-d,0))];
  }

  // Cuts a blob of touching grains into pieces: each local maximum of the distance transform
  // seeds one grain, and a watershed draws the borders. Returns [{a,x,y}] (area px, centre in the blob's box).
  function splitClump(cv,lab,W,id,bx,by,bw,bh){
    var pad=3,mw=bw+2*pad,mh=bh+2*pad;
    var m=new cv.Mat(mh,mw,cv.CV_8UC1,new cv.Scalar(0)),dist=new cv.Mat(),dil=new cv.Mat(),pk=new cv.Mat(),ker=null,mk=new cv.Mat(),pl=new cv.Mat(),img8=new cv.Mat(),img3=new cv.Mat(),outside=new cv.Mat(),res=null;
    try{
      var md=m.data;
      for(var y=0;y<bh;y++){var row=(by+y)*W+bx,mr=(y+pad)*mw+pad;for(var x=0;x<bw;x++)if(lab[row+x]===id)md[mr+x]=255}
      cv.distanceTransform(m,dist,cv.DIST_L2,5);
      cv.GaussianBlur(dist,dist,new cv.Size(5,5),0);
      var mm=cv.minMaxLoc(dist),mx=mm.maxVal;
      if(mx<2)return null;
      ker=cv.getStructuringElement(cv.MORPH_ELLIPSE,new cv.Size(9,9));
      cv.dilate(dist,dil,ker);
      // A peak must be a local maximum and not a faint bump on a bigger grain's slope.
      var dd=dist.data32F,dl=dil.data32F,peak=new cv.Mat(mh,mw,cv.CV_8UC1,new cv.Scalar(0)),pd=peak.data;
      for(var i=0;i<dd.length;i++)if(dd[i]>=2.5&&dd[i]>=dl[i]-1e-4)pd[i]=255;
      var nl=cv.connectedComponents(peak,mk,8,cv.CV_32S);
      peak.delete();
      if(nl<3)return null;
      var mkd=mk.data32S,bgLabel=nl,md2=m.data;
      for(var j=0;j<mkd.length;j++)if(!md2[j])mkd[j]=bgLabel;
      // Watershed image: grain interiors dark, borders bright.
      img3.delete();img3=new cv.Mat(mh,mw,cv.CV_8UC3);
      var im=img3.data;
      for(var q=0;q<dd.length;q++){var v=255-Math.round(dd[q]/mx*255);im[q*3]=v;im[q*3+1]=v;im[q*3+2]=v}
      cv.watershed(img3,mk);
      var sa=new Float64Array(nl),sx=new Float64Array(nl),sy=new Float64Array(nl),sxx=new Float64Array(nl),syy=new Float64Array(nl),sxy=new Float64Array(nl),w=mk.data32S;
      for(var yy=0;yy<mh;yy++)for(var xx=0;xx<mw;xx++){var l=w[yy*mw+xx];if(l>0&&l<bgLabel&&md2[yy*mw+xx]){sa[l]++;sx[l]+=xx;sy[l]+=yy;sxx[l]+=xx*xx;syy[l]+=yy*yy;sxy[l]+=xx*yy}}
      res=[];
      for(var k=1;k<bgLabel;k++)if(sa[k]>=NOISE_PX)res.push({a:sa[k],x:sx[k]/sa[k]-pad,y:sy[k]/sa[k]-pad,sx:sx[k],sy:sy[k],sxx:sxx[k],syy:syy[k],sxy:sxy[k]});
    }catch(e){res=null}
    finally{m.delete();dist.delete();dil.delete();pk.delete();if(ker)ker.delete();mk.delete();pl.delete();img8.delete();img3.delete();outside.delete()}
    return res;
  }

  // Edge sharpness: Laplacian spread on particle outlines in a central window, divided by the
  // particles' contrast so it doesn't depend on how many grains or how dark they are.
  function sharpness(cv,flat,bin,crop,ker,keep){
    var w=Math.min(1200,crop.w),h=Math.min(1200,crop.h);
    var r=new cv.Rect(crop.x+Math.floor((crop.w-w)/2),crop.y+Math.floor((crop.h-h)/2),w,h);
    var f=keep(flat.roi(r)),b=keep(bin.roi(r)),dil=keep(new cv.Mat()),ero=keep(new cv.Mat()),ring=keep(new cv.Mat());
    var lap=keep(new cv.Mat()),mean=keep(new cv.Mat()),sd=keep(new cv.Mat());
    cv.dilate(b,dil,ker);cv.erode(b,ero,ker);cv.subtract(dil,ero,ring);
    if(cv.countNonZero(ring)<50||cv.countNonZero(ero)<20)return 0;
    cv.Laplacian(f,lap,cv.CV_32F);
    cv.meanStdDev(lap,mean,sd,ring);
    var pm=cv.mean(f,ero)[0],c=Math.max(20,255-pm);
    return 1000*Math.pow(sd.data64F[0],2)/(c*c);
  }

  // Several grains stuck together: either low solidity (area / convex-hull area) or a deep notch
  // in the outline where two grains meet (a convexity defect deeper than a quarter of the radius).
  function isClump(cv,lab,W,id,bx,by,bw,bh,rEq){
    var m=new cv.Mat(bh+2,bw+2,cv.CV_8UC1,new cv.Scalar(0)),cs=new cv.MatVector(),hi=new cv.Mat(),hull=new cv.Mat(),hidx=new cv.Mat(),def=new cv.Mat(),clump=false;
    try{
      var md=m.data,mw=bw+2;
      for(var y=0;y<bh;y++){var row=(by+y)*W+bx,mr=(y+1)*mw+1;for(var x=0;x<bw;x++)if(lab[row+x]===id)md[mr+x]=255}
      cv.findContours(m,cs,hi,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_NONE);
      var big=null,ba=-1;
      for(var i=0;i<cs.size();i++){var c=cs.get(i),a=cv.contourArea(c);if(a>ba){if(big)big.delete();big=c;ba=a}else c.delete()}
      if(big){
        cv.convexHull(big,hull,false,true);
        var ha=cv.contourArea(hull);
        if(ha>0&&ba/ha<CLUMP_SOLIDITY)clump=true;
        else if(big.rows>=4){
          cv.convexHull(big,hidx,false,false);
          if(hidx.rows>=3){
            cv.convexityDefects(big,hidx,def);
            for(var k=3;k<def.data32S.length;k+=4)if(def.data32S[k]/256>CLUMP_NOTCH*rEq){clump=true;break}
          }
        }
        big.delete();
      }
    }catch(e){clump=false}
    finally{m.delete();cs.delete();hi.delete();hull.delete();hidx.delete();def.delete()}
    return clump;
  }

  // Volume-weighted statistics over one or more photos' particle diameters (µm). Each list is an array of
  // diameters or {d, w}: diameters with a weight per grain (several runs pooled at 1/runs each).
  function summarize(lists){
    var d=[],w=[],any=false;
    lists.forEach(function(l){
      var dd=l.d||l,ww=l.w||null;
      for(var i=0;i<dd.length;i++){d.push(dd[i]);w.push(ww?ww[i]:1);if(ww)any=true}
    });
    var n=d.length,ord=new Array(n),i0;
    for(i0=0;i0<n;i0++)ord[i0]=i0;
    ord.sort(function(a,b){return d[a]-d[b]});
    var ds=new Array(n),ws=new Array(n),cnt=0;
    for(i0=0;i0<n;i0++){ds[i0]=d[ord[i0]];ws[i0]=w[ord[i0]];cnt+=ws[i0]}
    d=ds;w=ws;
    var out={count:Math.round(cnt),d10:0,d50:0,d90:0,fines:{},hist:[],under:0,over:0,edges:edges()};
    CUTOFFS.forEach(function(c){out.fines[c]=0});
    if(!n){for(var z=0;z<BINS;z++)out.hist.push(0);return out}
    var v=d.map(function(x,i){return w[i]*x*x*x}),tot=v.reduce(function(a,b){return a+b},0),cum=0,q=[0.1,0.5,0.9],qi=0,res=[];
    for(var i=0;i<n&&qi<3;i++){
      var prev=cum;cum+=v[i];
      while(qi<3&&cum/tot>=q[qi]){
        var f=(q[qi]*tot-prev)/v[i],lo=i?d[i-1]:d[0];
        res.push(lo+(d[i]-lo)*Math.max(0,Math.min(1,f)));qi++;
      }
    }
    out.d10=res[0];out.d50=res[1];out.d90=res[2];
    var h=[];for(var b=0;b<BINS;b++)h.push(0);
    for(var j=0;j<n;j++){
      CUTOFFS.forEach(function(c){if(d[j]<c)out.fines[c]+=v[j]});
      if(d[j]<BIN_LO)out.under+=v[j];else if(d[j]>=BIN_HI)out.over+=v[j];
      else{var k=Math.min(BINS-1,Math.floor(Math.log(d[j]/BIN_LO)/Math.log(BIN_HI/BIN_LO)*BINS));h[k]+=v[j]}
    }
    out.hist=h.map(function(x){return x/tot});out.under/=tot;out.over/=tot;
    CUTOFFS.forEach(function(c){out.fines[c]/=tot});
    return out;
  }
  function edges(){var e=[];for(var k=0;k<=BINS;k++)e.push(BIN_LO*Math.pow(BIN_HI/BIN_LO,k/BINS));return e}

  var api={analyzeImage:analyzeImage,summarize:summarize,findCoin:findCoin,BINS:BINS,BIN_LO:BIN_LO,BIN_HI:BIN_HI,CUTOFFS:CUTOFFS};
  if(typeof module==="object"&&module.exports)module.exports=api;else root.GrindAnalyze=api;
})(typeof self!=="undefined"?self:this);
