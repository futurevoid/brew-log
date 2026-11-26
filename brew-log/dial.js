(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./micron.js"));
  } else {
    root.Dial = factory(root.Micron);
  }
})(typeof self !== "undefined" ? self : this, function (Micron) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function vib(ms) {
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
      ) {
        navigator.vibrate(ms || 8);
      }
    } catch (e) {}
  }

  function splitGroups(label) {
    return String(label || "").split(/[.+\/]/);
  }

  function parseTriple(label) {
    var p = String(label || "0").split(".");
    return [
      Number(p[0] || 0),
      p.length > 1 ? p[1] : "0",
      p.length > 2 ? p[2] : "0",
    ];
  }

  function detectProfile(grinderKey, labels) {
    var n = labels.length;
    var allInt = true;
    var allNum = true;
    var hasLetter = false;
    var hasThreePart = false;
    var hasPlus = false;
    var hasSlash = false;

    for (var i = 0; i < n; i++) {
      var s = String(labels[i] || "").trim();
      if (!/^\d+$/.test(s)) allInt = false;
      if (!/^[+-]?\d+(\.\d+)?$/.test(s)) allNum = false;
      if (/[A-Za-z]/.test(s)) hasLetter = true;
      if (s.indexOf("+") > -1) hasPlus = true;
      if (s.indexOf("/") > -1) hasSlash = true;
      if (s.split(".").length >= 3) hasThreePart = true;
    }

    // 1. Triple format: 1Zpresso, Knock Aergrind, Timemore C3 ESP, Millab E01, Helor 106, Weber KEY
    if (hasThreePart) {
      var turnT = n;
      for (var ti = 1; ti < n; ti++) {
        if (/^1(\.0)*$/.test(labels[ti])) {
          turnT = ti;
          break;
        }
      }
      var maxRotT = parseTriple(labels[n - 1])[0];
      return {
        mode: "triple",
        turnSize: turnT,
        multiTurn: turnT < n,
        maxRot: maxRotT,
        arcSpan: 360,
      };
    }

    // 2. Macro number + micro letter: Baratza Forté, Vario, Vario+, Preciso
    if (hasLetter) {
      var turnL = n;
      var m0 = /^(\d+)/.exec(labels[0]);
      if (m0) {
        for (var li = 1; li < n; li++) {
          var ml = /^(\d+)/.exec(labels[li]);
          if (ml && ml[1] !== m0[1]) {
            turnL = li;
            break;
          }
        }
      }
      var lastM = /^(\d+)/.exec(labels[n - 1]);
      return {
        mode: "letter",
        turnSize: turnL,
        multiTurn: turnL < n,
        maxRot: lastM ? Number(lastM[1]) : 1,
        arcSpan: 360,
      };
    }

    // 3. Explicit rotation+value or rotation/clicks: Eureka Mignon, Orbit, Blade R3, Varia Evo, Arco, Cafflano
    if (hasPlus && !/^(\+?\d+(\.\d+)?)$/.test(labels[1] || "")) {
      var turnP = n;
      for (var pi = 1; pi < n; pi++) {
        if (/^1\+/.test(labels[pi])) {
          turnP = pi;
          break;
        }
      }
      return {
        mode: "rot_plus",
        turnSize: turnP,
        multiTurn: turnP < n,
        maxRot: Math.floor((n - 1) / turnP),
        arcSpan: 360,
      };
    }

    if (hasSlash) {
      var turnS = n;
      for (var si = 1; si < n; si++) {
        if (/^1\//.test(labels[si])) {
          turnS = si;
          break;
        }
      }
      return {
        mode: "rot_slash",
        turnSize: turnS,
        multiTurn: turnS < n,
        maxRot: Math.floor((n - 1) / turnS),
        arcSpan: 360,
      };
    }

    // 4. Rotation.clicks with zero-padded clicks or 0..11/0..13: KINGrinder K4/K6, Niche Zero, Knock Feld2/Feldgrind, Kaldi
    var isZeroPadClicks = labels[1] && /^0\.0\d$/.test(labels[1]);
    var isKnockFeld =
      grinderKey.indexOf("knock-feld") === 0 ||
      grinderKey.indexOf("kaldi-") === 0;
    if (isZeroPadClicks || isKnockFeld) {
      var turnR = n;
      for (var ri = 2; ri < n; ri++) {
        if (/^1(\.0+)?$/.test(labels[ri])) {
          turnR = ri;
          break;
        }
      }
      if (turnR < n) {
        return {
          mode: "rot_dot",
          turnSize: turnR,
          multiTurn: true,
          maxRot: Math.floor((n - 1) / turnR),
          arcSpan: 360,
        };
      }
    }

    // 5. Known multi-turn numeric/special dials by real hardware mechanics
    if (grinderKey.indexOf("orphan-espresso-lido-og") === 0) {
      return {
        mode: "multi_num",
        turnSize: 20,
        multiTurn: true,
        maxRot: Math.floor((n - 1) / 20),
        arcSpan: 360,
      };
    }
    if (
      grinderKey.indexOf("weber-workshops-eg-1") === 0 ||
      grinderKey.indexOf("varia-vs3") === 0
    ) {
      return {
        mode: "multi_dec",
        turnSize: 100,
        multiTurn: true,
        maxRot: Math.floor((n - 1) / 100),
        arcSpan: 360,
      };
    }
    if (
      grinderKey.indexOf("kingrinder-k0") === 0 ||
      grinderKey.indexOf("kingrinder-k1") === 0 ||
      grinderKey.indexOf("kingrinder-k2") === 0 ||
      grinderKey.indexOf("kingrinder-k3") === 0 ||
      grinderKey.indexOf("kingrinder-k5") === 0
    ) {
      return {
        mode: "multi_num",
        turnSize: 40,
        multiTurn: true,
        maxRot: Math.floor((n - 1) / 40),
        arcSpan: 360,
      };
    }
    if (grinderKey.indexOf("kingrinder-p") === 0) {
      return {
        mode: "multi_num",
        turnSize: 30,
        multiTurn: true,
        maxRot: Math.floor((n - 1) / 30),
        arcSpan: 360,
      };
    }
    if (grinderKey.indexOf("red-clix") > -1) {
      return {
        mode: "multi_num",
        turnSize: 40,
        multiTurn: true,
        maxRot: Math.floor((n - 1) / 40),
        arcSpan: 360,
      };
    }
    if (grinderKey.indexOf("gold-clix") > -1) {
      return {
        mode: "multi_num",
        turnSize: 55,
        multiTurn: true,
        maxRot: Math.floor((n - 1) / 55),
        arcSpan: 360,
      };
    }
    if (grinderKey.indexOf("lagom-mini") > -1) {
      return {
        mode: "multi_num",
        turnSize: 100,
        multiTurn: true,
        maxRot: Math.floor((n - 1) / 100),
        arcSpan: 360,
      };
    }
    if (n > 300) {
      return {
        mode: "multi_num",
        turnSize: 100,
        multiTurn: true,
        maxRot: Math.floor((n - 1) / 100),
        arcSpan: 360,
      };
    }

    // 6. Single-ring physical dial (Comandante C40, Baratza Encore/ESP, EK43, Lagom P64, Pietro, DF54/64/83, Fellow Ode/Opus, Timemore C2/C3/S3/Sculptor, KitchenAid, Wilfa...)
    return {
      mode: allInt ? "single_int" : "single_dec",
      turnSize: n,
      multiTurn: false,
      maxRot: 0,
      arcSpan: 320,
    };
  }

  function buildMarks(labels, uniqueIdx, prof) {
    var marks = [];
    var mode = prof.mode;
    var turn = prof.turnSize;

    // 1. Triple (1Zpresso, Knock Aergrind, C3 ESP, Weber KEY, Helor 106)
    if (mode === "triple") {
      var limit = Math.min(labels.length, turn);
      var nums = [];
      var seenN = Object.create(null);
      for (var i = 0; i < limit; i++) {
        var tr = parseTriple(labels[i]);
        if (!(tr[1] in seenN)) {
          seenN[tr[1]] = i;
          nums.push({ idx: i, text: tr[1] });
        }
      }
      var tickStep = limit > 90 ? 1 : 1;
      for (var t = 0; t < limit; t += tickStep) {
        marks.push({
          angle: (t / limit) * 360,
          major: false,
          label: "",
        });
      }
      nums.forEach(function (item) {
        marks.push({
          angle: (item.idx / limit) * 360,
          major: true,
          label: item.text,
        });
      });
      return marks;
    }

    // 2. Letter ring (Baratza Forté / Vario / Preciso)
    if (mode === "letter") {
      var limitL = Math.min(labels.length, turn);
      var labelEvery = limitL > 16 ? 2 : 1;
      for (var li = 0; li < limitL; li++) {
        var letter = labels[li].replace(/^\d+/, "");
        var isMajL = li % labelEvery === 0;
        marks.push({
          angle: (li / limitL) * 360,
          major: isMajL,
          label: isMajL ? letter : "",
        });
      }
      return marks;
    }

    // 3. Rotation + / Rotation / / Rotation . (K6, Niche, Mignon, Orbit, Blade R3, Arco, Feld, Varia Evo, Cafflano)
    if (mode === "rot_plus" || mode === "rot_slash" || mode === "rot_dot") {
      var lim = Math.min(labels.length, turn);
      var tickCount = lim <= 100 ? lim : 60;
      for (var rt = 0; rt < tickCount; rt++) {
        marks.push({
          angle: (rt / tickCount) * 360,
          major: false,
          label: "",
        });
      }

      if (mode === "rot_plus") {
        // Show whole numbers in the first rotation (e.g. 0..5 for Mignon, 0..9 for Orbit, 0..11 for Blade R3, 1..8 for Cafflano)
        var maxLbls = 12;
        var wholes = [];
        for (var wp = 0; wp < lim; wp++) {
          var clean = labels[wp].replace(/\.0$/, "");
          if (/^\d+$/.test(clean)) wholes.push({ idx: wp, text: clean });
        }
        var strideP = Math.max(1, Math.ceil(wholes.length / maxLbls));
        wholes.forEach(function (w, wi) {
          if (wi % strideP === 0) {
            marks.push({
              angle: (w.idx / lim) * 360,
              major: true,
              label: w.text,
            });
          }
        });
      } else if (mode === "rot_slash") {
        // Goat Story Arco: 0..59 -> show every 5 clicks
        var stepS = lim > 24 ? 5 : 1;
        for (var rs = 0; rs < lim; rs += stepS) {
          marks.push({
            angle: (rs / lim) * 360,
            major: true,
            label: String(rs),
          });
        }
      } else {
        // KINGrinder K4/K6 (60), Niche Zero (90), Knock Feld2 (12), Feldgrind (14)
        var stepD = lim >= 80 ? 10 : lim >= 40 ? 5 : 1;
        for (var rd = 0; rd < lim; rd += stepD) {
          marks.push({
            angle: (rd / lim) * 360,
            major: true,
            label: String(rd),
          });
        }
      }
      return marks;
    }

    // 4. Multi-turn decimal (Varia VS3, Weber EG-1): 0..9 around ring with 10 ticks each
    if (mode === "multi_dec") {
      for (var md = 0; md < 100; md++) {
        var isM = md % 10 === 0;
        marks.push({
          angle: (md / 100) * 360,
          major: isM,
          label: isM ? String(md / 10) : "",
        });
      }
      return marks;
    }

    // 5. Multi-turn integer (KINGrinder K0-K3/P0-P2, Red Clix, Lagom Mini, Lido OG, Mazzer ZM)
    if (mode === "multi_num") {
      var tCount = Math.min(turn, 60);
      var majorDiv = turn <= 30 ? 5 : turn <= 60 ? 5 : 10;
      for (var mn = 0; mn < tCount; mn++) {
        marks.push({
          angle: (mn / tCount) * 360,
          major: false,
          label: "",
        });
      }
      for (var ml2 = 0; ml2 < turn; ml2 += majorDiv) {
        marks.push({
          angle: (ml2 / turn) * 360,
          major: true,
          label: String(ml2),
        });
      }
      return marks;
    }

    // 6. Single-ring physical arc (320° so min and max never overlap)
    var uLen = uniqueIdx.length;
    var span = prof.arcSpan;
    var uLabels = uniqueIdx.map(function (idx) {
      return labels[idx];
    });
    var tickStride = uLen > 120 ? 2 : 1;
    for (var si2 = 0; si2 < uLen; si2 += tickStride) {
      marks.push({
        angle: (si2 / (uLen - 1)) * span,
        major: false,
        label: "",
      });
    }

    // Choose clean major labels
    var wholeIndices = [];
    for (var wi2 = 0; wi2 < uLen; wi2++) {
      if (/^[+-]?\d+(\.0)?$/.test(uLabels[wi2])) {
        wholeIndices.push(wi2);
      }
    }
    var candidates = wholeIndices.length >= 4 ? wholeIndices : [];
    if (!candidates.length) {
      for (var ci = 0; ci < uLen; ci++) candidates.push(ci);
    }

    var targetLabels = 11;
    var lblStride = Math.max(1, Math.ceil(candidates.length / targetLabels));
    for (var k = 0; k < candidates.length; k++) {
      var uPos = candidates[k];
      var isEnd = k === 0 || k === candidates.length - 1;
      var show = k % lblStride === 0 || isEnd;
      if (
        isEnd &&
        k > 0 &&
        candidates.length -
          1 -
          Math.floor((candidates.length - 1) / lblStride) * lblStride <
          lblStride * 0.45
      ) {
        // Avoid crowding the last label right next to the second-to-last
        show = k === candidates.length - 1;
      }
      marks.push({
        angle: (uPos / (uLen - 1)) * span,
        major: true,
        label: show ? uLabels[uPos].replace(/\.0$/, "") : "",
      });
    }
    return marks;
  }

  function buildModel(grinderKey) {
    if (!Micron || typeof Micron.steps !== "function") return null;
    var st = Micron.steps(grinderKey);
    if (!st || !st.labels || st.labels.length < 2) return null;

    var labels = st.labels;
    var n = labels.length;

    // Unique logical positions — each stores its exact FIRST index in the chart (matches Micron.calc)
    var uniqueIdx = [];
    var seen = Object.create(null);
    for (var i = 0; i < n; i++) {
      var normLab = Micron.norm(labels[i]);
      if (!(normLab in seen)) {
        seen[normLab] = i;
        uniqueIdx.push(i);
      }
    }

    var prof = detectProfile(st.key, labels);
    var marks = buildMarks(labels, uniqueIdx, prof);

    return {
      key: st.key,
      name: st.name,
      lo: st.lo,
      hi: st.hi,
      labels: labels,
      microns: st.microns,
      count: n,
      uniqueIdx: uniqueIdx,
      prof: prof,
      marks: marks,
    };
  }

  function firstOccurrence(model, idx) {
    var clamped = clamp(idx, 0, model.count - 1);
    var normLab = Micron.norm(model.labels[clamped]);
    for (var i = 0; i < clamped; i++) {
      if (Micron.norm(model.labels[i]) === normLab) return i;
    }
    return clamped;
  }

  function uniquePosOf(model, chartIdx) {
    var first = firstOccurrence(model, chartIdx);
    var pos = model.uniqueIdx.indexOf(first);
    if (pos >= 0) return pos;
    pos = 0;
    for (var i = 0; i < model.uniqueIdx.length; i++) {
      if (model.uniqueIdx[i] <= first) pos = i;
    }
    return pos;
  }

  function findClosestStep(model, rawInput) {
    if (!model || !Micron) return -1;
    var trimmed = String(rawInput || "").trim();
    if (!trimmed) return -1;

    var calc = Micron.calc(model.key, trimmed);
    if (calc && !calc.e && typeof calc.i === "number" && isFinite(calc.i)) {
      return firstOccurrence(model, Math.round(calc.i));
    }

    var targetNorm = Micron.norm(trimmed);
    for (var i = 0; i < model.count; i++) {
      if (Micron.norm(model.labels[i]) === targetNorm) return i;
    }
    return -1;
  }

  function stepDelta(model, currentIndex, delta) {
    if (!model || !model.uniqueIdx.length) return 0;
    var pos = uniquePosOf(model, currentIndex < 0 ? 0 : currentIndex);
    var nextPos = clamp(pos + delta, 0, model.uniqueIdx.length - 1);
    return model.uniqueIdx[nextPos];
  }

  function centerReadout(model, index, hasValue) {
    var idx = clamp(index, 0, model.count - 1);
    var lab = model.labels[idx];
    var umVal = model.microns[idx];
    var prof = model.prof;

    if (!hasValue) {
      return {
        primary: "—",
        micron: "حرّك العجلة",
        detail: model.lo + " – " + model.hi + " µm",
        rotLabel: "",
        rotRatio: 0,
      };
    }

    var detail = "";
    var rotLabel = "";
    var rotRatio = 0;

    if (prof.mode === "triple") {
      var tr = parseTriple(lab);
      detail = "رقم " + tr[1] + " • كليك " + tr[2];
      if (prof.maxRot > 0) {
        rotLabel = "لفة " + tr[0];
        rotRatio = tr[0] / Math.max(1, prof.maxRot);
      }
    } else if (prof.mode === "letter") {
      var lm = /^(\d+)([A-Za-z]+)$/.exec(lab);
      if (lm) {
        detail = "رقم " + lm[1] + " • حرف " + lm[2];
        rotLabel = "المستوى " + lm[1];
        rotRatio = (Number(lm[1]) - 1) / Math.max(1, prof.maxRot - 1);
      }
    } else if (
      prof.mode === "rot_plus" ||
      prof.mode === "rot_slash" ||
      prof.mode === "rot_dot"
    ) {
      var curRot = Math.floor(idx / prof.turnSize);
      var clickInRot = idx % prof.turnSize;
      detail = "كليك " + clickInRot;
      if (prof.maxRot > 0) {
        rotLabel = "لفة " + curRot;
        rotRatio = curRot / Math.max(1, prof.maxRot);
      }
    } else if (prof.multiTurn) {
      var rNum = Math.floor(idx / prof.turnSize);
      rotLabel = "لفة " + (rNum + 1);
      rotRatio = rNum / Math.max(1, prof.maxRot);
    }

    return {
      primary: lab,
      micron: "≈ " + umVal + " µm",
      detail: detail,
      rotLabel: rotLabel,
      rotRatio: clamp(rotRatio, 0, 1),
    };
  }

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, String(attrs[k]));
      });
    }
    return el;
  }

  function create(opts) {
    var container = opts.container;
    var getGrinderKey = opts.getGrinderKey;
    var getGrindValue = opts.getGrindValue;
    var setGrindValue = opts.setGrindValue;
    var onChange = opts.onChange || function () {};

    if (!container) return null;

    var model = null;
    var index = 0;
    var hasValue = false;
    var syncingFromInput = false;
    var builtModelKey = "";
    var rotorEl = null;
    var labelNodes = [];
    var rotArcEl = null;

    container.innerHTML =
      '<div class="grind-ctrl" id="grindCtrl" hidden>' +
      '  <div class="dial-panel" id="dialPanel">' +
      '    <div class="dial-wheel" id="dialWheel" role="slider" tabindex="0" aria-label="عجلة درجة الطحن">' +
      '      <svg class="dial-svg" id="dialSvg" viewBox="0 0 240 240" aria-hidden="true"></svg>' +
      '      <div class="dial-center">' +
      '        <div class="dial-val" id="dialVal">—</div>' +
      '        <div class="dial-um" id="dialUm">حرّك العجلة</div>' +
      '        <div class="dial-sub" id="dialSub"></div>' +
      '        <div class="dial-rot" id="dialRot" hidden></div>' +
      "      </div>" +
      "    </div>" +
      '    <div class="dial-actions">' +
      '      <button type="button" class="btn grind-step-btn" id="grindFineBtn" title="أنعم بكليك واحد">− أنعم</button>' +
      '      <span class="dial-range-lbl" id="dialRangeLbl"></span>' +
      '      <button type="button" class="btn grind-step-btn" id="grindCoarseBtn" title="أخشن بكليك واحد">+ أخشن</button>' +
      "    </div>" +
      "  </div>" +
      "</div>";

    var ctrlEl = container.querySelector("#grindCtrl");
    var fineBtn = container.querySelector("#grindFineBtn");
    var coarseBtn = container.querySelector("#grindCoarseBtn");
    var rangeLbl = container.querySelector("#dialRangeLbl");
    var wheelEl = container.querySelector("#dialWheel");
    var svgRoot = container.querySelector("#dialSvg");
    var valEl = container.querySelector("#dialVal");
    var umEl = container.querySelector("#dialUm");
    var subEl = container.querySelector("#dialSub");
    var rotEl = container.querySelector("#dialRot");

    function buildWheelSVG() {
      if (!model) return;
      builtModelKey = model.key;
      labelNodes = [];
      rotArcEl = null;
      while (svgRoot.firstChild) svgRoot.removeChild(svgRoot.firstChild);

      // Outer dial ring background
      svgRoot.appendChild(
        svgEl("circle", { cx: 120, cy: 120, r: 112, class: "dial-svg-outer" }),
      );

      // Inner rotation progress track for multi-turn grinders
      if (model.prof.multiTurn) {
        svgRoot.appendChild(
          svgEl("circle", { cx: 120, cy: 120, r: 66, class: "dial-rot-track" }),
        );
        rotArcEl = svgEl("circle", {
          cx: 120,
          cy: 120,
          r: 66,
          class: "dial-rot-arc",
          transform: "rotate(-90 120 120)",
        });
        svgRoot.appendChild(rotArcEl);
      }

      // Rotating group
      rotorEl = svgEl("g", { class: "dial-svg-rotor" });
      model.marks.forEach(function (mk) {
        // angle 0 = 12 o'clock, increasing angle = clockwise
        var rad = ((mk.angle - 90) * Math.PI) / 180;
        var rOut = 107;
        var rIn = mk.major ? 93 : 99;
        var x1 = 120 + rOut * Math.cos(rad);
        var y1 = 120 + rOut * Math.sin(rad);
        var x2 = 120 + rIn * Math.cos(rad);
        var y2 = 120 + rIn * Math.sin(rad);

        rotorEl.appendChild(
          svgEl("line", {
            x1: x1.toFixed(1),
            y1: y1.toFixed(1),
            x2: x2.toFixed(1),
            y2: y2.toFixed(1),
            class: mk.major ? "dial-svg-tick major" : "dial-svg-tick",
          }),
        );

        if (mk.label) {
          var rLbl = 80;
          var lx = 120 + rLbl * Math.cos(rad);
          var ly = 120 + rLbl * Math.sin(rad);
          var txt = svgEl("text", {
            x: lx.toFixed(1),
            y: ly.toFixed(1),
            class: "dial-svg-lbl",
            "text-anchor": "middle",
            "dominant-baseline": "central",
          });
          txt.textContent = mk.label;
          rotorEl.appendChild(txt);
          labelNodes.push({ el: txt, x: lx, y: ly });
        }
      });
      svgRoot.appendChild(rotorEl);

      // Fixed top pointer triangle at 12 o'clock
      svgRoot.appendChild(
        svgEl("polygon", {
          points: "120,17 114,4 126,4",
          class: "dial-svg-pointer",
        }),
      );
    }

    function activeAngleDeg() {
      if (!model) return 0;
      var prof = model.prof;
      if (!prof.multiTurn) {
        var uPos = uniquePosOf(model, index);
        var uMax = Math.max(1, model.uniqueIdx.length - 1);
        return (uPos / uMax) * prof.arcSpan;
      }
      return (index / prof.turnSize) * 360;
    }

    function updateWheelVisual() {
      if (!model) return;
      if (builtModelKey !== model.key || !rotorEl) {
        buildWheelSVG();
      }

      // Rotate rotor counter-clockwise by activeAngleDeg so the active mark sits at 12 o'clock
      var rotDeg = -activeAngleDeg();
      rotorEl.setAttribute(
        "transform",
        "rotate(" + rotDeg.toFixed(2) + " 120 120)",
      );
      for (var i = 0; i < labelNodes.length; i++) {
        var ln = labelNodes[i];
        ln.el.setAttribute(
          "transform",
          "rotate(" +
            (-rotDeg).toFixed(2) +
            " " +
            ln.x.toFixed(1) +
            " " +
            ln.y.toFixed(1) +
            ")",
        );
      }

      var ro = centerReadout(model, index, hasValue);
      valEl.textContent = ro.primary;
      umEl.textContent = ro.micron;
      subEl.textContent = ro.detail;
      subEl.hidden = !ro.detail;
      rotEl.textContent = ro.rotLabel;
      rotEl.hidden = !ro.rotLabel;

      if (rotArcEl) {
        var circ = 2 * Math.PI * 66;
        var filled = hasValue ? Math.max(0.04, ro.rotRatio) * circ : 0;
        rotArcEl.setAttribute(
          "stroke-dasharray",
          filled.toFixed(1) + " " + circ.toFixed(1),
        );
      }

      var uPos = uniquePosOf(model, index);
      wheelEl.setAttribute("aria-valuemin", "0");
      wheelEl.setAttribute("aria-valuemax", String(model.uniqueIdx.length - 1));
      wheelEl.setAttribute("aria-valuenow", String(uPos));
      wheelEl.setAttribute(
        "aria-valuetext",
        hasValue
          ? ro.primary + " — " + model.microns[index] + " µm"
          : "غير محدد",
      );
    }

    function updateControlsUI() {
      if (!model) {
        ctrlEl.hidden = true;
        return;
      }
      ctrlEl.hidden = false;

      var uLen = model.uniqueIdx.length;
      var uPos = uniquePosOf(model, index);

      rangeLbl.textContent = model.lo + " – " + model.hi + " µm";
      fineBtn.disabled = hasValue && uPos <= 0;
      coarseBtn.disabled = hasValue && uPos >= uLen - 1;

      updateWheelVisual();
    }

    function commitChartIndex(newChartIdx, opts2) {
      if (!model) return;
      var snapped = firstOccurrence(model, Math.round(newChartIdx));
      var changed = !hasValue || snapped !== index;
      index = snapped;
      hasValue = true;
      var exactLabel = model.labels[index];

      updateControlsUI();

      if (changed && (!opts2 || !opts2.silentVibrate)) {
        vib(8);
      }

      if (!opts2 || !opts2.skipWrite) {
        syncingFromInput = true;
        setGrindValue(exactLabel);
        syncingFromInput = false;
        onChange(exactLabel, index, model);
      }
    }

    function moveBy(delta) {
      if (!model) return;
      if (!hasValue) {
        commitChartIndex(index);
        return;
      }
      var next = stepDelta(model, index, delta);
      commitChartIndex(next);
    }

    fineBtn.addEventListener("click", function () {
      moveBy(-1);
    });
    coarseBtn.addEventListener("click", function () {
      moveBy(1);
    });

    wheelEl.addEventListener("keydown", function (e) {
      if (!model) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        moveBy(-1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        moveBy(1);
      } else if (e.key === "Home") {
        e.preventDefault();
        commitChartIndex(model.uniqueIdx[0]);
      } else if (e.key === "End") {
        e.preventDefault();
        commitChartIndex(model.uniqueIdx[model.uniqueIdx.length - 1]);
      }
    });

    (function bindWheelDrag() {
      var dragging = false;
      var lastAngle = 0;
      var accumDeg = 0;

      function pointerAngle(clientX, clientY) {
        var rect = wheelEl.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
      }

      function deltaAngle(prev, cur) {
        var d = cur - prev;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        return d;
      }

      wheelEl.addEventListener("pointerdown", function (e) {
        if (!model) return;
        dragging = true;
        lastAngle = pointerAngle(e.clientX, e.clientY);
        accumDeg = 0;
        if (wheelEl.setPointerCapture) {
          try {
            wheelEl.setPointerCapture(e.pointerId);
          } catch (err) {}
        }
        e.preventDefault();
      });

      wheelEl.addEventListener("pointermove", function (e) {
        if (!dragging || !model) return;
        var ang = pointerAngle(e.clientX, e.clientY);
        var dAng = deltaAngle(lastAngle, ang);
        lastAngle = ang;
        // Counter-clockwise drag (dAng < 0) brings higher clockwise numbers to 12 o'clock (+steps)
        accumDeg -= dAng;

        var spanSteps = model.prof.multiTurn
          ? model.prof.turnSize
          : Math.max(1, model.uniqueIdx.length - 1);
        var degPerStep = clamp(model.prof.arcSpan / spanSteps, 3.2, 18);
        var steps = Math.trunc(accumDeg / degPerStep);
        if (steps !== 0) {
          accumDeg -= steps * degPerStep;
          moveBy(steps);
        }
      });

      function stopDrag(e) {
        if (!dragging) return;
        dragging = false;
        accumDeg = 0;
        if (e && wheelEl.releasePointerCapture) {
          try {
            wheelEl.releasePointerCapture(e.pointerId);
          } catch (err) {}
        }
      }

      wheelEl.addEventListener("pointerup", stopDrag);
      wheelEl.addEventListener("pointercancel", stopDrag);

      wheelEl.addEventListener(
        "wheel",
        function (e) {
          if (!model) return;
          e.preventDefault();
          var dir = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
          moveBy(dir);
        },
        { passive: false },
      );
    })();

    function sync() {
      if (syncingFromInput) return;
      var key = getGrinderKey();
      var nextModel = buildModel(key);
      var grinderChanged =
        (!model && nextModel) ||
        (model && !nextModel) ||
        (model && nextModel && model.key !== nextModel.key);

      model = nextModel;
      if (!model) {
        index = 0;
        hasValue = false;
        builtModelKey = "";
        updateControlsUI();
        return;
      }

      var curVal = getGrindValue();
      var matched = findClosestStep(model, curVal);
      if (matched >= 0) {
        index = matched;
        hasValue = true;
      } else {
        hasValue = false;
        if (grinderChanged || index >= model.count) {
          index = firstOccurrence(model, Math.round((model.count - 1) * 0.4));
        }
      }

      updateControlsUI();
    }

    return {
      sync: sync,
      getModel: function () {
        return model;
      },
      getIndex: function () {
        return index;
      },
    };
  }

  return {
    create: create,
    buildModel: buildModel,
    stepDelta: stepDelta,
    findClosestStep: findClosestStep,
  };
});

