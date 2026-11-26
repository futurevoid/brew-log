window.onerror = function (m, u, l) {
  var e = document.getElementById("jserr");
  if (e) e.textContent = String(m) + " (line " + l + ")";
};

var $ = function (i) {
  return document.getElementById(i);
};
$("jsmsg").style.display = "none";
var scores = [
  ["الحلاوة", "sw"],
  ["الحمضية", "ac"],
  ["القوام", "bd"],
  ["المرارة", "bt"],
  ["النظافة", "cl"],
];
var adjs = [
  "أنعم",
  "أخشن",
  "حرارة أعلى",
  "حرارة أقل",
  "ريشيو أطول",
  "ريشيو أقصر",
  "صب أهدأ",
  "صب أعنف",
  "تغيير فلتر",
  "تغيير ماء",
  "تغيير أداة",
];
var sl = $("sliders");
scores.forEach(function (s) {
  var d = document.createElement("div");
  d.className = "sl";
  d.innerHTML =
    "<span>" +
    s[0] +
    '</span><input type="range" min="0" max="10" value="5" id="' +
    s[1] +
    '" data-touched="0" aria-label="' +
    s[0] +
    '"><b id="' +
    s[1] +
    'v" role="button" tabindex="0" title="اضغط للمسح">—</b>';
  sl.appendChild(d);
});
function untouch(id) {
  $(id).value = 5;
  $(id).dataset.touched = "0";
  render();
}
sl.addEventListener("click", function (e) {
  var t = e.target;
  if (t.type === "range") {
    t.dataset.touched = "1";
    render();
  } else if (t.tagName === "B" && $(t.id.slice(0, -1)).dataset.touched === "1")
    untouch(t.id.slice(0, -1));
});
sl.addEventListener("keydown", function (e) {
  if (e.target.tagName === "B" && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    untouch(e.target.id.slice(0, -1));
  }
});
adjs.forEach(function (a) {
  var l = document.createElement("label");
  l.innerHTML = '<input type="checkbox" value="' + a + '"> ' + a;
  $("adj").appendChild(l);
});

// ================= هرم التذوق =================
var PYR_CONFIG = {
  top: {
    title: "🔺 الافتتاحية",
    empty: "اضغط لاختيار نوتات الافتتاحية (العطرية وأول رشفة) +",
    presets: [
      "ياسمين",
      "زهور بيضاء",
      "برغموت",
      "حمضيات",
      "ليمون حلو",
      "خوخ",
      "مشمش",
      "فواكه استوائية",
      "تفاح أخضر",
      "توت أحمر",
      "ورد",
    ],
  },
  heart: {
    title: "🔸 العمق",
    empty: "اضغط لاختيار نوتات العمق (قلب الكوب والحلاوة) +",
    presets: [
      "كراميل",
      "عسل",
      "سكر بني",
      "توت أسود",
      "فراولة",
      "مانجو",
      "برقوق",
      "حلاوة قصب",
      "تين مجفف",
      "كرز",
      "شوكولاتة بالحليب",
    ],
  },
  base: {
    title: "🔻 القاعدة",
    empty: "اضغط لاختيار نوتات القاعدة (أساس الكوب وعمق النكهة) +",
    presets: [
      "شوكولاتة داكنة",
      "كاكاو",
      "شاي أسود",
      "مكسرات",
      "لوز محمص",
      "بندق",
      "قرفة وبهارات",
      "فانيلا",
      "دبس تمر",
      "خشب عطري",
    ],
  },
};
var pyrState = { top: [], heart: [], base: [] };
var activeTier = "top";

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function setActiveTier(tier) {
  if (!PYR_CONFIG[tier]) return;
  activeTier = tier;
  document.querySelectorAll(".pyr-tier").forEach(function (el) {
    el.classList.toggle("active", el.dataset.tier === tier);
  });
  document.querySelectorAll(".pyr-tab").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.tier === tier);
  });
  if ($("pyrActiveLabel"))
    $("pyrActiveLabel").textContent = "تعديل: " + PYR_CONFIG[tier].title;
  renderPyrPalette();
}

function togglePyrNote(tier, note) {
  note = String(note || "").trim();
  if (!note || !pyrState[tier]) return;
  var arr = pyrState[tier];
  var idx = arr.indexOf(note);
  if (idx > -1) arr.splice(idx, 1);
  else arr.push(note);
  render();
}

function renderPyrPalette() {
  var pal = $("pyrPalette");
  if (!pal) return;
  pal.style.flexDirection = "row";
  pal.style.flexWrap = "wrap";
  pal.style.gap = "6px";
  var cfg = PYR_CONFIG[activeTier];
  var selected = pyrState[activeTier] || [];
  var allChoices = cfg.presets.slice();
  selected.forEach(function (n) {
    if (allChoices.indexOf(n) < 0) allChoices.push(n);
  });
  pal.innerHTML = allChoices
    .map(function (n) {
      var on = selected.indexOf(n) > -1 ? " on" : "";
      return (
        '<button type="button" class="pyr-chip' +
        on +
        '" data-note="' +
        esc(n) +
        '">' +
        esc(n) +
        "</button>"
      );
    })
    .join("");
}

function detectCupVibe() {
  var all = pyrState.top.concat(pyrState.heart, pyrState.base);
  if (all.length < 2) return "";
  var floral = ["ياسمين", "زهور بيضاء", "برغموت", "ورد", "شاي أسود"];
  var fruity = [
    "حمضيات",
    "ليمون حلو",
    "خوخ",
    "مشمش",
    "فواكه استوائية",
    "تفاح أخضر",
    "توت أحمر",
    "توت أسود",
    "فراولة",
    "مانجو",
    "برقوق",
    "كرز",
  ];
  var classic = [
    "شوكولاتة داكنة",
    "كاكاو",
    "مكسرات",
    "لوز محمص",
    "بندق",
    "قرفة وبهارات",
    "شوكولاتة بالحليب",
    "خشب عطري",
  ];
  var sweet = [
    "كراميل",
    "عسل",
    "سكر بني",
    "حلاوة قصب",
    "تين مجفف",
    "فانيلا",
    "دبس تمر",
  ];
  var cF = 0,
    cFr = 0,
    cCl = 0,
    cSw = 0;
  all.forEach(function (n) {
    if (floral.indexOf(n) > -1) cF++;
    if (fruity.indexOf(n) > -1) cFr++;
    if (classic.indexOf(n) > -1) cCl++;
    if (sweet.indexOf(n) > -1) cSw++;
  });
  var max = Math.max(cF, cFr, cCl, cSw);
  if (max === 0) return "كوب خاص ومتفرد ✨";
  if (cF === max && cFr >= 1) return "عطري وفاكهي مشرق 🌸";
  if (cF === max) return "عطري ونظيف 🌸";
  if (cFr === max && cSw >= 1) return "فاكهي حلو وعصيري 🍓";
  if (cFr === max) return "فاكهي مشرق 🍓";
  if (cCl === max) return "كلاسيكي دافئ وممتلئ 🍫";
  return "حلو ومتوازن 🍯";
}

function updatePyramidUI() {
  ["top", "heart", "base"].forEach(function (tier) {
    var box = $("pyrNotes_" + tier);
    var tierEl = document.querySelector('.pyr-tier[data-tier="' + tier + '"]');
    var notes = pyrState[tier] || [];
    if (tierEl) tierEl.classList.toggle("filled", notes.length > 0);
    if (!box) return;
    if (!notes.length) {
      box.innerHTML =
        '<span class="pyr-empty">' + esc(PYR_CONFIG[tier].empty) + "</span>";
    } else {
      box.innerHTML = notes
        .map(function (n) {
          return (
            '<span class="pyr-note" data-tier="' +
            tier +
            '" data-note="' +
            esc(n) +
            '" title="اضغط للحذف">' +
            esc(n) +
            " <i>✕</i></span>"
          );
        })
        .join("");
    }
  });
  renderPyrPalette();
  var vibe = detectCupVibe();
  var vibeEl = $("cupVibe");
  if (vibeEl) {
    if (vibe) {
      vibeEl.hidden = false;
      vibeEl.textContent = "طابع الكوب: " + vibe;
    } else {
      vibeEl.hidden = true;
      vibeEl.textContent = "";
    }
  }
}

if ($("pyramidStage")) {
  $("pyramidStage").addEventListener("click", function (e) {
    var noteEl = e.target.closest(".pyr-note");
    if (noteEl) {
      e.stopPropagation();
      togglePyrNote(noteEl.dataset.tier, noteEl.dataset.note);
      return;
    }
    var tierEl = e.target.closest(".pyr-tier");
    if (tierEl) setActiveTier(tierEl.dataset.tier);
  });
}
document.querySelectorAll(".pyr-tab").forEach(function (btn) {
  btn.addEventListener("click", function () {
    setActiveTier(this.dataset.tier);
  });
});
if ($("pyrPalette")) {
  $("pyrPalette").addEventListener("click", function (e) {
    var chip = e.target.closest(".pyr-chip");
    if (chip) togglePyrNote(activeTier, chip.dataset.note);
  });
}
function addCustomPyrNote() {
  var inp = $("pyrCustomIn");
  if (!inp) return;
  var v = inp.value.trim();
  if (!v) return;
  if (pyrState[activeTier].indexOf(v) < 0) pyrState[activeTier].push(v);
  inp.value = "";
  render();
}
if ($("pyrAddCustom")) $("pyrAddCustom").onclick = addCustomPyrNote;
if ($("pyrCustomIn")) {
  $("pyrCustomIn").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      addCustomPyrNote();
    }
  });
}

// ================= الصبّات (Pours) =================
function addPour(v) {
  var d = document.createElement("div");
  d.className = "pour";
  d.innerHTML =
    '<div class="ac"><input class="a" type="number" min="0" step="10" inputmode="numeric" enterkeyhint="next" placeholder="50" aria-label="الكمية بالمل"><span>مل</span></div><div class="tc"><input class="t" type="text" inputmode="numeric" enterkeyhint="next" autocomplete="off" placeholder="0:45" aria-label="مدة الصبّة"><span class="tm" dir="ltr"></span></div><div class="nt"><input type="text" enterkeyhint="next" placeholder="تفتيح أو صب بطيء" aria-label="ملاحظة"></div><button type="button" class="btn del" title="حذف الصبّة" aria-label="حذف الصبّة">✕</button>';
  if (v) {
    d.querySelector(".a").value = v[0] || "";
    d.querySelector(".t").value = v[1] || "";
    d.querySelector(".nt input").value = v[2] || "";
  }
  $("pours").appendChild(d);
  return d;
}
function parseT(v) {
  v = v
    .replace(/[٠-٩]/g, function (d) {
      return d.charCodeAt(0) - 1632;
    })
    .replace(/[.,٫،;]/g, ":");
  if (!/^\d+(:\d{1,2})?$/.test(v)) return null;
  if (v.indexOf(":") > -1) {
    var a = v.split(":"),
      x = +a[1];
    return x > 59 ? null : +a[0] * 60 + x;
  }
  var ss = +v.slice(-2),
    mm = v.length > 2 ? +v.slice(0, -2) : 0;
  return ss > 59 ? null : mm * 60 + ss;
}
function fmtT(v) {
  if (v === "") return "";
  var n = Math.max(0, Math.round(+v));
  var m = Math.floor(n / 60),
    r = n % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
}
$("pours").addEventListener("click", function (e) {
  var b = e.target.closest(".del");
  if (b) {
    b.parentNode.remove();
    if (brewTimer && brewTimer.isRunning()) brewTimer.onRowsChanged();
    render();
  }
});
addPour();
addPour();
$("addPour").onclick = function () {
  addPour();
  render();
};

// ================= تايمر الصبّات والصوت =================
var brewTimer = (function () {
  var TIMER_KEY = "brewlog-timer-v1";
  var SOUND_KEY = "brewlog-timer-sound-v1";
  var state = {
    running: false,
    startedAt: 0,
    elapsedRecorded: 0,
    activeIdx: 0,
    history: [],
    prevTotalTime: "",
    soundOn: true,
  };
  var tickId = null;
  var wakeLock = null;
  var audioCtx = null;

  try {
    var snd = localStorage.getItem(SOUND_KEY);
    if (snd === "0") state.soundOn = false;
  } catch (e) {}

  function vib(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms || 15);
    } catch (e) {}
  }

  function beep(kind) {
    if (!state.soundOn) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var now = audioCtx.currentTime;

      function tone(freq, startOffset, dur, gainVal) {
        var osc = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + startOffset);
        g.gain.setValueAtTime(0.0001, now + startOffset);
        g.gain.exponentialRampToValueAtTime(gainVal, now + startOffset + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + dur + 0.02);
      }

      if (kind === "start") {
        tone(587.3, 0, 0.14, 0.14);
        tone(880, 0.1, 0.16, 0.14);
      } else if (kind === "next") {
        tone(740, 0, 0.14, 0.16);
      } else if (kind === "finish") {
        tone(523.25, 0, 0.14, 0.14);
        tone(659.25, 0.11, 0.14, 0.14);
        tone(1046.5, 0.22, 0.26, 0.16);
      } else if (kind === "undo") {
        tone(440, 0, 0.12, 0.12);
      }
    } catch (e) {}
  }

  function acquireWakeLock() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock
      .request("screen")
      .then(function (lock) {
        wakeLock = lock;
        lock.addEventListener("release", function () {
          wakeLock = null;
        });
      })
      .catch(function () {});
  }

  function releaseWakeLock() {
    if (wakeLock && wakeLock.release) {
      wakeLock.release().catch(function () {});
      wakeLock = null;
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && state.running) {
      acquireWakeLock();
      updateClockUI();
    }
  });

  function rows() {
    return [].slice.call(document.querySelectorAll("#pours .pour"));
  }

  function persist() {
    try {
      if (state.running) {
        localStorage.setItem(TIMER_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(TIMER_KEY);
      }
    } catch (e) {}
  }

  function updateSoundButtons() {
    var txt = state.soundOn ? "🔊" : "🔇";
    if ($("timerSound")) $("timerSound").textContent = txt;
    if ($("timerSoundIdle")) $("timerSoundIdle").textContent = txt;
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    try {
      localStorage.setItem(SOUND_KEY, state.soundOn ? "1" : "0");
    } catch (e) {}
    updateSoundButtons();
    if (state.soundOn) beep("next");
  }

  function highlightActiveRow(doScroll) {
    var list = rows();
    list.forEach(function (el, idx) {
      el.classList.toggle(
        "is-active",
        state.running && idx === state.activeIdx,
      );
    });
    if (doScroll && state.running && list[state.activeIdx]) {
      try {
        list[state.activeIdx].scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      } catch (e) {}
    }
  }

  function totalSecNow() {
    return Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
  }

  function updateClockUI() {
    if (!state.running) return;
    var totalSec = totalSecNow();
    if ($("timerClock")) $("timerClock").textContent = fmtT(totalSec);

    var list = rows();
    var row = list[state.activeIdx];
    var amt = row ? row.querySelector(".a").value.trim() : "";
    var meta = "الصبّة " + (state.activeIdx + 1);
    if (amt) meta += " • " + amt + " مل";
    if ($("timerMeta")) $("timerMeta").textContent = meta;

    if ($("timerUndo")) $("timerUndo").disabled = state.history.length === 0;
  }

  function syncDockUI(doScroll) {
    var running = state.running;
    document.body.classList.toggle("timer-running", running);
    if ($("timerStartWrap")) $("timerStartWrap").hidden = running;
    if ($("timerDock")) $("timerDock").hidden = !running;
    updateSoundButtons();
    highlightActiveRow(doScroll);
    if (running) updateClockUI();
  }

  function startLoop() {
    clearInterval(tickId);
    tickId = setInterval(updateClockUI, 250);
  }

  function stopLoop() {
    clearInterval(tickId);
    tickId = null;
  }

  function start() {
    if (typeof mobileAcc !== "undefined") mobileAcc.openIdx(2, false);
    var list = rows();
    if (!list.length) addPour();
    state.running = true;
    state.startedAt = Date.now();
    state.elapsedRecorded = 0;
    state.activeIdx = 0;
    state.history = [];
    state.prevTotalTime = $("time").value;

    acquireWakeLock();
    beep("start");
    vib(20);
    startLoop();
    syncDockUI(true);
    persist();
  }

  function nextPour() {
    if (!state.running) return;
    var totalSec = Math.max(
      state.elapsedRecorded + 1,
      Math.round((Date.now() - state.startedAt) / 1000),
    );
    var durSec = totalSec - state.elapsedRecorded;

    var list = rows();
    while (list.length <= state.activeIdx) {
      addPour();
      list = rows();
    }

    var row = list[state.activeIdx];
    var tInput = row.querySelector(".t");
    var prevT = tInput.value;
    tInput.value = fmtT(durSec);

    var addedRow = false;
    if (state.activeIdx + 1 >= list.length) {
      addPour();
      addedRow = true;
    }

    state.history.push({
      idx: state.activeIdx,
      prevT: prevT,
      prevElapsed: state.elapsedRecorded,
      addedRow: addedRow,
    });

    state.elapsedRecorded = totalSec;
    state.activeIdx += 1;

    beep("next");
    vib(15);
    render();
    syncDockUI(true);
    persist();
  }

  function undoLast() {
    if (!state.running || !state.history.length) return;
    var last = state.history.pop();
    var list = rows();
    if (last.addedRow && list.length > last.idx + 1) {
      var extra = list[list.length - 1];
      var isEmpty =
        !extra.querySelector(".a").value.trim() &&
        !extra.querySelector(".t").value.trim() &&
        !extra.querySelector(".nt input").value.trim();
      if (isEmpty) extra.remove();
    }
    list = rows();
    if (list[last.idx]) {
      list[last.idx].querySelector(".t").value = last.prevT;
    }
    state.activeIdx = last.idx;
    state.elapsedRecorded = last.prevElapsed;

    beep("undo");
    vib(12);
    render();
    syncDockUI(true);
    persist();
    toast("تراجعت عن آخر صبّة ↩️");
  }

  function finish() {
    if (!state.running) return;
    var totalSec = Math.max(
      state.elapsedRecorded + 1,
      Math.round((Date.now() - state.startedAt) / 1000),
    );
    var durSec = totalSec - state.elapsedRecorded;

    var list = rows();
    while (list.length <= state.activeIdx) {
      addPour();
      list = rows();
    }

    list[state.activeIdx].querySelector(".t").value = fmtT(durSec);
    $("time").value = fmtT(totalSec);

    state.running = false;
    state.history = [];
    stopLoop();
    releaseWakeLock();
    beep("finish");
    vib([20, 40, 20]);
    persist();
    syncDockUI(false);
    render();
    toast("خلص التحضير! الوقت الكلي " + fmtT(totalSec) + " ✓");
  }

  function cancel(silent) {
    if (!state.running) return;
    while (state.history.length) {
      var h = state.history.pop();
      var list = rows();
      if (h.addedRow && list.length > h.idx + 1) {
        var extra = list[list.length - 1];
        if (
          !extra.querySelector(".a").value.trim() &&
          !extra.querySelector(".nt input").value.trim()
        ) {
          extra.remove();
        }
      }
      list = rows();
      if (list[h.idx]) {
        list[h.idx].querySelector(".t").value = h.prevT;
      }
    }
    $("time").value = state.prevTotalTime;

    state.running = false;
    stopLoop();
    releaseWakeLock();
    persist();
    syncDockUI(false);
    render();
    if (!silent) {
      beep("undo");
      toast("تم إلغاء التايمر بدون مسح بياناتك");
    }
  }

  function onRowsChanged() {
    if (!state.running) return;
    var list = rows();
    if (!list.length) {
      addPour();
      state.activeIdx = 0;
    } else if (state.activeIdx >= list.length) {
      state.activeIdx = list.length - 1;
    }
    highlightActiveRow(false);
    updateClockUI();
    persist();
  }

  function restore() {
    updateSoundButtons();
    try {
      var raw = localStorage.getItem(TIMER_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && saved.running && saved.startedAt) {
        state.running = true;
        state.startedAt = saved.startedAt;
        state.elapsedRecorded = saved.elapsedRecorded || 0;
        state.activeIdx = saved.activeIdx || 0;
        state.history = Array.isArray(saved.history) ? saved.history : [];
        state.prevTotalTime = saved.prevTotalTime || "";
        if (typeof mobileAcc !== "undefined") mobileAcc.openIdx(2, false);
        acquireWakeLock();
        startLoop();
        syncDockUI(false);
      }
    } catch (e) {}
  }

  if ($("timerStart")) $("timerStart").onclick = start;
  if ($("timerNext")) $("timerNext").onclick = nextPour;
  if ($("timerFinish")) $("timerFinish").onclick = finish;
  if ($("timerUndo")) $("timerUndo").onclick = undoLast;
  if ($("timerCancel"))
    $("timerCancel").onclick = function () {
      cancel(false);
    };
  if ($("timerSound")) $("timerSound").onclick = toggleSound;
  if ($("timerSoundIdle")) $("timerSoundIdle").onclick = toggleSound;

  return {
    restore: restore,
    cancel: cancel,
    onRowsChanged: onRowsChanged,
    isRunning: function () {
      return state.running;
    },
  };
})();

// ================= الطواحين والميكرون =================
var POP = [
  "1Zpresso K-Ultra",
  "1Zpresso J-Ultra",
  "1Zpresso J-Max S",
  "1Zpresso X-Ultra",
  "1Zpresso ZP6 Special",
  "1Zpresso K-Max",
  "1Zpresso K-Plus",
  "1Zpresso Q2 (Heptagonal burrs)",
  "1Zpresso Q Air",
  "1Zpresso JX-Pro S",
  "1Zpresso X-Pro S",
  "Comandante C40 MK4",
  "Comandante C40 MK4 (with Red Clix)",
  "Comandante C60 Baracuda",
  "KINGrinder K1",
  "KINGrinder K6",
  "Timemore C3",
  "Timemore Sculptor 064",
  "Timemore Sculptor 064S",
  "Timemore Sculptor 078",
  "Timemore Sculptor 078S",
  "Fiorenzato Pietro",
  "Fellow Ode Brew Grinder Gen 1",
  "Fellow Ode Brew Grinder Gen 2",
  "Weber Workshops EG-1",
  "Weber Workshops KEY Mk1",
  "Varia VS3 (Gen 2)",
  "Option-O Lagom P64",
  "Option-O Lagom Mini (Moonshine burrs)",
  "Option-O Lagom Mini (Obsidian burrs)",
  "Mahlkönig EK43 S",
  "Eureka Atom 75",
  "Eureka Mignon Specialità",
  "Turin DF54",
  "Turin DF64 (Gen 2)",
  "Turin DF64V",
  "Turin DF83",
  "Turin DF83V",
  "Baratza Encore",
  "Baratza Sette 30",
  "Baratza Forté BG",
  "Wilfa Svart",
].map(Micron.find);
var TAG = { "fiorenzato-pietro": "Pietro" };
var ND = "ما لقيت رقم ميكرون منشور لها، فما أحوّل عشان ما أخمّن.";
var EX = {
  "x-c5": {
    l: "Timemore C5 Pro",
    um: 31,
    f: "clk",
    ph: "12",
    h: "اكتب عدد الكليكات من نقطة الصفر (48 كليك = لفة)",
    s: "Timemore الرسمي",
  },
  "x-millab": {
    l: "Millab M01",
    um: 12.5,
    f: "n10",
    ph: "8.0",
    h: "اكتب رقم.كليك مثل 3.5 (كل رقم = 10 كليكات)",
    s: "Millab الرسمي",
  },
  "x-a2": {
    l: "Femobook A2",
    um: 18,
    f: "clk",
    ph: "60",
    h: "اكتب عدد الكليكات من الصفر (40 كليك = لفة)",
    s: "Femobook الرسمي",
  },
  "x-jeplus": {
    l: "1Zpresso JE-Plus",
    um: 12.5,
    f: "top",
    ph: "1.5",
    h: "كليكات من الصفر مثل 60، أو لفة.رقم مثل 1.5 (4 كليكات لكل رقم، 40 كليك = لفة)",
    s: "1Zpresso الرسمي",
  },
};
[
  "Monolith Flat Max",
  "Monolith MC",
  "Monolith SDRM",
  "Lagom P100",
  "Lagom 01",
  "Lagom P80",
  "Lagom Casa",
  "Comandante Tigershark",
  "Mavo Z Pro",
  "Mavo Phoenix Pro",
  "Mahlkönig X64 SD",
  "Eureka Single Dose",
  "Varia VS6",
  "Milo Play",
  "GE83",
  "G64",
  "GZZT Z63",
  "Hibrew G5",
  "G5 mini",
  "Starseeker edge plus",
  "Potu-F Ghost Burr",
  "E55",
  "Codex D7",
  "Storm",
  "MX Cool aries",
  "A4Z",
  "E-pro",
].forEach(function (l, i) {
  EX["x-nd" + i] = {
    l: l,
    nd:
      l === "Comandante Tigershark"
        ? "ما تأكدت من مواصفاتها فما أحوّل. إذا هي C40 MK4 اختر C40 MK4."
        : l === "E-pro"
          ? "ما عرفت أي طاحونة هذي بالضبط، ولا لقيت لها رقم موثق."
          : ND,
  };
});
function grName(k) {
  var g = Micron.info(k);
  return g ? g.name : EX[k] ? EX[k].l : "";
}
var gs = $("grinder");
function opts(keys) {
  return keys
    .map(function (k) {
      return '<option value="' + k + '">' + esc(grName(k)) + "</option>";
    })
    .join("");
}
var exk = Object.keys(EX);
var allKeys = Micron.list
  .map(function (g) {
    return g.key;
  })
  .concat(exk);
var ALIAS = [
  ["كماندنتي", "comandante"],
  ["كوماندانتي", "comandante"],
  ["تايمور", "timemore"],
  ["تايمر", "timemore"],
  ["كينقرايندر", "kingrinder"],
  ["كنقرايندر", "kingrinder"],
  ["فيلو", "fellow"],
  ["لاقوم", "lagom"],
  ["نيش", "niche"],
  ["باراتزا", "baratza"],
  ["يوريكا", "eureka"],
  ["ويبر", "weber"],
  ["فاريا", "varia"],
  ["زبريسو", "1zpresso"],
  ["زيبريسو", "1zpresso"],
];
function gnorm(q) {
  q = String(q).toLowerCase();
  ALIAS.forEach(function (a) {
    q = q.split(a[0]).join(a[1]);
  });
  return q.replace(/[\s\-_.()+]/g, "");
}
function buildGrinders(q) {
  var cur = gs.value,
    n = gnorm(q || "");
  if (!n) {
    gs.innerHTML =
      '<option value="">— اختر الطاحونة —</option>' +
      '<optgroup label="الأكثر استخداماً">' +
      opts(POP) +
      "</optgroup>" +
      '<optgroup label="كل الطواحين (A-Z)">' +
      opts(
        Micron.list.map(function (g) {
          return g.key;
        }),
      ) +
      "</optgroup>" +
      '<optgroup label="حركة البر فقط، مو حجم حبيبات">' +
      opts(
        exk.filter(function (k) {
          return !EX[k].nd;
        }),
      ) +
      "</optgroup>" +
      '<optgroup label="بدون رقم ميكرون">' +
      opts(
        exk.filter(function (k) {
          return EX[k].nd;
        }),
      ) +
      "</optgroup>" +
      '<option value="__o">طاحونة ثانية</option>';
    gs.value = cur;
    return;
  }
  var hit = allKeys.filter(function (k) {
    return gnorm(grName(k)).indexOf(n) > -1;
  });
  var keep = cur && cur !== "__o" && hit.indexOf(cur) < 0 ? [cur] : [];
  gs.innerHTML =
    '<option value="">' +
    (hit.length
      ? "— " + hit.length + " نتيجة —"
      : "— ما لقيت، جرّب اسم ثاني —") +
    "</option>" +
    opts(keep.concat(hit)) +
    '<option value="__o">طاحونة ثانية</option>';
  gs.value = hit.length === 1 ? hit[0] : cur;
}
buildGrinders("");
$("gq").addEventListener("input", function (e) {
  e.stopPropagation();
  buildGrinders(this.value);
  render();
});

function clicks(g, s) {
  s = Micron.norm(s);
  var p = s.split("."),
    a = p.map(Number);
  if (
    p.some(function (x) {
      return x === "";
    }) ||
    a.some(isNaN)
  )
    return { e: "الرقم غير مفهوم" };
  if (g.f === "clk")
    return p.length > 1
      ? { e: "اكتب عدد الكليكات كامل بدون نقطة، مثل 90" }
      : { c: a[0] };
  if (g.f === "n10") {
    if (p.length === 1) return { c: a[0] * 10 };
    if (p.length === 2 && p[1].length === 1) return { c: a[0] * 10 + a[1] };
    return { e: "الصيغة رقم.كليك والكليك من 0 إلى 9، مثل 3.5" };
  }
  if (g.f === "top") {
    if (p.length === 1) return { c: a[0] };
    if (p.length === 2 && p[1].length === 1) return { c: a[0] * 40 + a[1] * 4 };
    return { e: "الصيغة كليكات فقط، أو لفة.رقم مثل 1.5" };
  }
}

var dialCtrl = null;
if (window.Dial && $("grindDialMount")) {
  dialCtrl = Dial.create({
    container: $("grindDialMount"),
    getGrinderKey: function () {
      return $("grinder").value;
    },
    getGrindValue: function () {
      return $("grind").value.trim();
    },
    setGrindValue: function (v) {
      $("grind").value = v;
    },
    onChange: function () {
      render();
    },
  });
}

function mic() {
  var k = $("grinder").value,
    s = $("grind").value.trim(),
    el = $("micv"),
    x = EX[k],
    g = !x && Micron.info(k);
  if (!g && !x) {
    $("grind").placeholder = "مثل 24";
    el.innerHTML =
      '<span class="hint">اختر الطاحونة وبعدين حرّك العجلة أو اكتب الرقم عشان يتحول لميكرون</span>';
    return "";
  }
  if (x && x.nd) {
    $("grind").placeholder = "مثل 24";
    el.innerHTML =
      "<b>" + esc(x.l) + '</b><br><span class="hint">' + x.nd + "</span>";
    return "";
  }
  if (x) {
    $("grind").placeholder = x.ph;
    var hx =
      "<b>" +
      esc(x.l) +
      "</b>: " +
      x.um +
      ' µm حركة بر لكل كليك <span class="hint">(' +
      x.s +
      "، ما لها جدول حجم حبيبات فهذا مو قابل للمقارنة مع باقي الطواحين)</span>";
    if (!s) {
      el.innerHTML = hx + '<br><span class="hint">' + x.h + "</span>";
      return "";
    }
    var c = clicks(x, s);
    if (c.e) {
      el.innerHTML = hx + '<br><span style="color:#d9534f">' + c.e + "</span>";
      return "";
    }
    var n = Math.round(c.c * x.um);
    el.innerHTML =
      hx +
      '<br><span class="big">≈ ' +
      n +
      ' µm</span> <span class="hint">حركة بر: ' +
      c.c +
      " × " +
      x.um +
      "</span>";
    return "≈" + n + " µm حركة بر";
  }
  $("grind").placeholder = g.ph;
  var head =
    "<b>" +
    esc(g.name) +
    '</b> <span class="hint">من ' +
    g.lo +
    " إلى " +
    g.hi +
    " µm</span>";
  if (!s) {
    el.innerHTML =
      head + '<br><span class="hint">' + esc(Micron.hint(k)) + "</span>";
    return "";
  }
  var r = Micron.calc(k, s);
  if (r.e) {
    el.innerHTML =
      head + '<br><span style="color:#d9534f">' + esc(r.e) + "</span>";
    return "";
  }
  var how =
    r.via === "clicks"
      ? r.clicks + " كليك من الصفر = " + r.label
      : r.between
        ? "بين إعدادين في الجدول"
        : "الإعداد " + r.label;
  el.innerHTML =
    head +
    '<br><span class="big">≈ ' +
    r.um +
    ' µm</span> <span class="hint">' +
    esc(how) +
    "</span>" +
    (r.alt
      ? '<br><span class="hint">إذا تقصد ' + esc(r.alt) + " اكتبها كاملة</span>"
      : "") +
    (r.zone
      ? '<br><span class="hint">على الطاحونة: ' + esc(r.zone) + "</span>"
      : "") +
    (r.methods.length
      ? '<br><span class="hint">يناسب عادة: <span class="methods">' +
        esc(r.methods.slice(0, 3).join("، ")) +
        "</span></span>"
      : "");
  return "≈" + r.um + " µm";
}

function val(i) {
  var e = $(i);
  if (e.tagName === "SELECT") {
    if (e.value === "__o") return $(i + "_o").value.trim();
    if (i === "grinder" && e.value) return grName(e.value);
  }
  return e.value.trim();
}
function line(k, v) {
  return v ? k + ": " + v : "";
}
function fmtDate(v) {
  if (!v) return "";
  var p = v.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

function drawRadar() {
  var svg = $("tasteRadar");
  if (!svg) return;
  var cx = 110,
    cy = 115,
    R = 72,
    N = scores.length;
  function pt(idx, val10) {
    var ang = -Math.PI / 2 + (2 * Math.PI * idx) / N;
    var r = (val10 / 10) * R;
    return [
      +(cx + r * Math.cos(ang)).toFixed(1),
      +(cy + r * Math.sin(ang)).toFixed(1),
    ];
  }
  var grids = [3.3, 6.6, 10]
    .map(function (lv) {
      var pts = scores
        .map(function (_, i) {
          return pt(i, lv).join(",");
        })
        .join(" ");
      return '<polygon class="radar-grid" points="' + pts + '"/>';
    })
    .join("");
  var axes = scores
    .map(function (s, i) {
      var p = pt(i, 10),
        lp = pt(i, 12.6);
      return (
        '<line class="radar-axis" x1="' +
        cx +
        '" y1="' +
        cy +
        '" x2="' +
        p[0] +
        '" y2="' +
        p[1] +
        '"/>' +
        '<text class="radar-lbl" x="' +
        lp[0] +
        '" y="' +
        (lp[1] + 4) +
        '">' +
        s[0] +
        "</text>"
      );
    })
    .join("");
  var vals = scores.map(function (s) {
    var e = $(s[1]);
    return e.dataset.touched === "1" ? +e.value : 5;
  });
  var polyPts = vals
    .map(function (v, i) {
      return pt(i, v).join(",");
    })
    .join(" ");
  var dots = vals
    .map(function (v, i) {
      var p = pt(i, v);
      return (
        '<circle class="radar-dot" cx="' +
        p[0] +
        '" cy="' +
        p[1] +
        '" r="3.5"/>'
      );
    })
    .join("");
  svg.innerHTML =
    grids +
    axes +
    '<polygon class="radar-poly" points="' +
    polyPts +
    '"/>' +
    dots;
}

// ================= نظام الطيّ الذكي للجوال (Smart Mobile Accordion) =================
var mobileAcc = (function () {
  var activeIdx = 0;
  var cards = [];
  var pills = [];
  var barEl = null;

  var META = [
    { short: "القهوة", icon: "🌱", next: "التالي: التحضير ←" },
    { short: "التحضير", icon: "⚙️", next: "التالي: الصبّات ←" },
    { short: "الصبّات", icon: "💧", next: "التالي: الطعم ←" },
    { short: "الطعم", icon: "✨", next: "التالي: التعديل ←" },
    {
      short: "التعديل",
      icon: "🔧",
      next: "معاينة البوست الجاهز ✨",
      final: true,
    },
  ];

  function init() {
    var main = document.querySelector("main");
    if (!main) return;
    var fieldsets = [].slice.call(main.querySelectorAll(":scope > fieldset"));
    if (!fieldsets.length) return;

    barEl = document.createElement("div");
    barEl.className = "mob-step-bar";
    barEl.id = "mobStepBar";
    barEl.setAttribute("role", "tablist");
    barEl.setAttribute("aria-label", "أقسام التحضير");
    main.insertBefore(barEl, fieldsets[0]);

    fieldsets.forEach(function (fs, idx) {
      var info = META[idx] || {
        short: "قسم " + (idx + 1),
        icon: "•",
        next: "التالي ←",
      };
      var leg = fs.querySelector(":scope > legend");
      var fullTitle = leg
        ? leg.textContent.trim()
        : info.icon + " " + info.short;

      var body = document.createElement("div");
      body.className = "acc-body";
      var inner = document.createElement("div");
      inner.className = "acc-inner";

      var children = [].slice.call(fs.childNodes);
      children.forEach(function (node) {
        if (node !== leg) inner.appendChild(node);
      });

      var nextWrap = document.createElement("div");
      nextWrap.className = "acc-next-wrap";
      var nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "btn acc-next-btn" + (info.final ? " final" : "");
      nextBtn.textContent = info.next;
      nextBtn.addEventListener("click", function () {
        if (info.final) {
          openSheet();
        } else {
          openIdx(idx + 1, true);
        }
      });
      nextWrap.appendChild(nextBtn);
      inner.appendChild(nextWrap);
      body.appendChild(inner);

      var hdr = document.createElement("button");
      hdr.type = "button";
      hdr.className = "acc-header";
      hdr.setAttribute("aria-expanded", idx === 0 ? "true" : "false");
      hdr.innerHTML =
        '<div class="acc-title-grp">' +
        '  <span class="acc-badge">' +
        (idx + 1) +
        "</span>" +
        '  <div class="acc-name-col">' +
        '    <span class="acc-title">' +
        esc(fullTitle) +
        "</span>" +
        '    <span class="acc-sum"></span>' +
        "  </div>" +
        "</div>" +
        '<span class="acc-chev" aria-hidden="true">▼</span>';

      hdr.addEventListener("click", function () {
        if (activeIdx === idx) {
          fs.classList.toggle("acc-open");
          hdr.setAttribute(
            "aria-expanded",
            fs.classList.contains("acc-open") ? "true" : "false",
          );
        } else {
          openIdx(idx, true);
        }
      });

      fs.classList.add("acc-card");
      if (idx === 0) fs.classList.add("acc-open");
      fs.insertBefore(hdr, leg ? leg.nextSibling : fs.firstChild);
      fs.appendChild(body);

      var pill = document.createElement("button");
      pill.type = "button";
      pill.className = "mob-pill" + (idx === 0 ? " active" : "");
      pill.innerHTML =
        '<span class="pill-dot">' +
        info.icon +
        "</span><span>" +
        esc(info.short) +
        "</span>";
      pill.addEventListener("click", function () {
        openIdx(idx, true);
      });
      barEl.appendChild(pill);

      cards.push({
        fs: fs,
        hdr: hdr,
        badge: hdr.querySelector(".acc-badge"),
        sum: hdr.querySelector(".acc-sum"),
        idx: idx,
        info: info,
      });
      pills.push(pill);
    });
  }

  function openIdx(idx, doScroll) {
    if (idx < 0 || idx >= cards.length) return;
    activeIdx = idx;
    cards.forEach(function (c, i) {
      var isOpen = i === idx;
      c.fs.classList.toggle("acc-open", isOpen);
      c.hdr.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    pills.forEach(function (p, i) {
      p.classList.toggle("active", i === idx);
    });

    if (pills[idx] && barEl) {
      try {
        pills[idx].scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      } catch (e) {}
    }

    if (doScroll && window.innerWidth <= 860 && cards[idx]) {
      setTimeout(function () {
        var barH = barEl ? barEl.offsetHeight + 10 : 54;
        var top =
          cards[idx].fs.getBoundingClientRect().top + window.scrollY - barH;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }, 90);
    }
  }

  function updateSummaries(data) {
    if (!cards.length) return;

    // 0: القهوة
    var cParts = [
      val("roaster"),
      val("coffee"),
      val("origin"),
      val("process"),
    ].filter(Boolean);
    var cDone = !!(val("coffee") || val("roaster"));

    // 1: التحضير
    var bParts = [
      val("method"),
      val("grind") ? "طحنة " + val("grind") : "",
      data.ratioStr ? data.ratioStr.replace("النسبة: ", "") : "",
      val("time") ? val("time") : "",
    ].filter(Boolean);
    var bDone = !!(val("method") || val("grind") || val("dose"));

    // 2: الصبّات
    var pCount = data.pourItems.length;
    var pParts = [];
    if (pCount) pParts.push(pCount + (pCount === 1 ? " صبّة" : " صبّات"));
    if (data.totalWater > 0) pParts.push(data.totalWater + " مل");
    var pDone = pCount > 0;

    // 3: الطعم
    var noteCount =
      pyrState.top.length + pyrState.heart.length + pyrState.base.length;
    var tParts = [];
    if (noteCount) tParts.push(noteCount + " إيحاءات");
    if (data.scCount) tParts.push("تقييم " + data.scCount + "/5");
    if (val("taste")) tParts.push(trunc(val("taste"), 24));
    var tDone = !!(noteCount || data.scCount || val("taste") || val("notes"));

    // 4: التعديل
    var aCount = data.adjCount;
    var aParts = aCount ? [aCount + " تعديلات مختارة"] : [];
    var aDone = aCount > 0;

    var states = [
      { done: cDone, text: cParts.join(" • ") },
      { done: bDone, text: bParts.join(" • ") },
      { done: pDone, text: pParts.join(" • ") },
      { done: tDone, text: tParts.join(" • ") },
      { done: aDone, text: aParts.join(" • ") },
    ];

    states.forEach(function (st, i) {
      var c = cards[i];
      if (!c) return;
      c.fs.classList.toggle("acc-done", st.done);
      c.badge.textContent = st.done ? "✓" : String(i + 1);
      c.sum.textContent = st.text;
      if (pills[i]) {
        pills[i].classList.toggle("done", st.done);
        var dot = pills[i].querySelector(".pill-dot");
        if (dot) dot.textContent = st.done ? "✓" : c.info.icon;
      }
    });
  }

  return {
    init: init,
    openIdx: openIdx,
    updateSummaries: updateSummaries,
    getActive: function () {
      return activeIdx;
    },
  };
})();

function render() {
  document.querySelectorAll("select[data-o]").forEach(function (s) {
    $(s.id + "_o").hidden = s.value !== "__o";
  });
  if (dialCtrl) dialCtrl.sync();
  if (varPick) varPick.sync();
  var mu = mic();
  // A photo measurement from grind.html replaces the chart estimate in the post.
  var gm = null;
  try {
    gm = $("gmeas").value ? JSON.parse($("gmeas").value) : null;
  } catch (e) {
    gm = null;
  }
  $("gmv").hidden = !gm;
  if (gm)
    $("gmv").innerHTML =
      '<span>قياس من صورة: <b dir="ltr">' +
      (gm.eq ? "≈ " + gm.eq + " µm" : "D50 " + gm.d50 + " µm") +
      "</b>" +
      (gm.eq ? (gm.g ? " على سلّم " + esc(gm.g) : " بميكرون الجداول") : "") +
      ' · نواعم <bdi dir="ltr">' +
      gm.f +
      '%</bdi></span><button type="button" class="btn" id="gmx" aria-label="شيل القياس">✕</button>';
  var tl = [];
  ["method", "origin", "process", "grinder"].forEach(function (i) {
    var v = $(i).value;
    if (v && v !== "__o") {
      var tg = i === "grinder" ? TAG[v] : v;
      if (
        i === "method" &&
        ["V60", "Orea", "Pulsar", "AeroPress"].indexOf(v) < 0
      )
        tg = "";
      if (tg) tl.push(tg);
    } else if (v === "__o" && i === "process") tl.push("معالجة-أخرى");
    else if (v === "__o" && i === "origin") tl.push("دولة أخرى");
  });
  $("tags").innerHTML = tl.length
    ? tl
        .map(function (t) {
          return '<span class="tg">' + t + "</span>";
        })
        .join("")
    : '<span class="hint">تظهر هنا بعد ما تختار</span>';
  var d = +val("dose"),
    y = +val("yield");
  var ratioStr = d > 0 && y > 0 ? "النسبة: 1:" + (y / d).toFixed(1) : "";
  $("ratio").textContent = ratioStr;
  var head = [val("roaster") ? "[" + val("roaster") + "]" : "", val("coffee")]
    .filter(Boolean)
    .join(" ");
  var t = head ? head + (val("method") ? " — " + val("method") : "") : "";
  $("title").textContent = t || "العنوان يظهر هنا بعد ما تكتب المحمصة والمحصول";

  var coffee = [
    line("المحمصة", val("roaster")),
    line("المحصول", val("coffee")),
    line("البلد", val("origin")),
    line("المعالجة", val("process")),
    line("السلالة", val("variety")),
    line("درجة التحميص", val("level")),
    line("تاريخ التحميص", fmtDate(val("roast"))),
  ].filter(Boolean);
  var brew = [
    line("طريقة التحضير", val("method")),
    line("الأداة", val("tool")),
    line("الفلتر", val("filter")),
    line("الطاحونة", val("grinder")),
    line(
      "درجة الطحن",
      val("grind")
        ? val("grind") +
            (mu && $("addmic").checked && !gm ? " (" + mu + ")" : "")
        : "",
    ),
    gm
      ? gm.eq
        ? "التحليل من صورة: ≈" +
          gm.eq +
          " µm " +
          (gm.g ? "على سلّم " + gm.g : "بميكرون جداول الطواحين") +
          " · نواعم " +
          gm.f +
          "% (<" +
          gm.c +
          " µm) · " +
          Number(gm.n).toLocaleString("en-US") +
          " حبيبة"
        : "التحليل من صورة: D50 " +
          gm.d50 +
          " µm · D10 " +
          gm.d10 +
          " · D90 " +
          gm.d90 +
          " · نواعم " +
          gm.f +
          "% (<" +
          gm.c +
          " µm) · " +
          Number(gm.n).toLocaleString("en-US") +
          " حبيبة"
      : "",
    line("الماء", val("water")),
    line("الحرارة", val("temp") ? val("temp") + "°" : ""),
    line("الجرعة", val("dose") ? val("dose") + " غ" : ""),
    line("الناتج", val("yield") ? val("yield") + " غ" : ""),
    ratioStr,
    line("الوقت الكلي", val("time")),
  ].filter(Boolean);
  var L = coffee.concat(coffee.length && brew.length ? [""] : [], brew);

  var run = 0,
    pourItems = [];
  var ps = [].slice
    .call(document.querySelectorAll(".pour"))
    .map(function (p, idx) {
      var a = p.querySelector(".a").value.trim(),
        t = p.querySelector(".t").value.trim(),
        b = p.querySelector(".nt input").value.trim(),
        f = "",
        bad = false;
      if (t !== "") {
        var sec = parseT(t);
        if (sec === null) bad = true;
        else {
          run += sec;
          f = fmtT(run);
        }
      }
      p.querySelector(".tm").textContent = bad
        ? "؟ مثل 1:20"
        : f
          ? "= " + f
          : "";
      if (+a > 0 || f) pourItems.push({ n: idx + 1, a: +a || 0, f: f });
      var parts = [a ? a + " مل" : "", f, b].filter(Boolean);
      return parts.length ? "- " + parts.join(" | ") : "";
    })
    .filter(Boolean);

  var pv = $("pourVis");
  var totalWater = pourItems.reduce(function (sum, x) {
    return sum + x.a;
  }, 0);
  if (pv) {
    if (totalWater > 0) {
      pv.hidden = false;
      var segs = pourItems
        .filter(function (x) {
          return x.a > 0;
        })
        .map(function (x) {
          var w = Math.max(8, Math.round((x.a / totalWater) * 100));
          return (
            '<div class="pour-seg" style="width:' +
            w +
            '%" title="صبّة ' +
            x.n +
            ": " +
            x.a +
            ' مل"></div>'
          );
        })
        .join("");
      var metas = pourItems
        .map(function (x) {
          return (
            "<span>صبّة " +
            x.n +
            ": " +
            (x.a ? x.a + " مل" : "—") +
            (x.f ? " (" + x.f + ")" : "") +
            "</span>"
          );
        })
        .join("");
      pv.innerHTML =
        '<div class="pour-vis-bar">' +
        segs +
        '</div><div class="pour-vis-meta">' +
        metas +
        "</div>";
    } else {
      pv.hidden = true;
    }
  }

  if (ps.length) {
    L.push("", "الوصفة:");
    L = L.concat(ps);
  }

  updatePyramidUI();
  var pyrLines = [];
  if (pyrState.top.length)
    pyrLines.push("🔺 الافتتاحية: " + pyrState.top.join(" • "));
  if (pyrState.heart.length)
    pyrLines.push("🔸 العمق: " + pyrState.heart.join(" • "));
  if (pyrState.base.length)
    pyrLines.push("🔻 القاعدة: " + pyrState.base.join(" • "));
  var vibe = detectCupVibe();
  if (vibe) pyrLines.push("✨ طابع الكوب: " + vibe);

  var sc = [];
  scores.forEach(function (s) {
    var e = $(s[1]);
    if (e.dataset.touched === "1") sc.push(s[0] + ": " + e.value + "/10");
    $(s[1] + "v").textContent =
      e.dataset.touched === "1" ? e.value + "/10" : "—";
  });
  drawRadar();

  if (val("taste")) L.push("", line("الطعم", val("taste")));
  if (pyrLines.length) {
    L.push("", "هرم التذوق:");
    L = L.concat(pyrLines);
  }
  if (sc.length) {
    if (!val("taste") && !pyrLines.length) L.push("");
    L = L.concat(sc);
  }
  if (val("notes")) L.push("", line("ملاحظات عامة", val("notes")));
  var ch = [].slice
    .call(document.querySelectorAll("#adj input:checked"))
    .map(function (c) {
      return "- " + c.value;
    });
  if (ch.length) {
    L.push("", "وش يحتاج تعديل؟");
    L = L.concat(ch);
  }
  var o = $("out");
  o.value = L.join("\n")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n");
  o.style.height = "auto";
  o.style.height = o.scrollHeight + 2 + "px";

  if ($("mbTitle")) $("mbTitle").textContent = t || "سجل التحضير ☕";
  if ($("mbSub"))
    $("mbSub").textContent =
      ratioStr || (o.value ? "البوست جاهز للنسخ ✓" : "عبّ الحقول للنسخ السريع");

  mobileAcc.updateSummaries({
    ratioStr: ratioStr,
    pourItems: pourItems,
    totalWater: totalWater,
    scCount: sc.length,
    adjCount: ch.length,
  });

  renderBeans();
  save();
}
document.addEventListener("input", function (e) {
  if (
    e.target.id === "pyrCustomIn" ||
    e.target.id === "varQ" ||
    e.target.id === "varPickSel"
  )
    return;
  if (e.target.type === "range") e.target.dataset.touched = "1";
  render();
});
document.addEventListener("change", function (e) {
  if (
    e.target.id === "pyrCustomIn" ||
    e.target.id === "varQ" ||
    e.target.id === "varPickSel"
  )
    return;
  render();
});

// ================= النسخ والـ Toast =================
var toastT;
function toast(msg, act, ms) {
  var t = $("toast");
  t.textContent = msg;
  if (act) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = act[0];
    b.onclick = function () {
      t.hidden = true;
      act[1]();
    };
    t.appendChild(b);
  }
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(function () {
    t.hidden = true;
  }, ms || 2500);
}
function flashBtn(btn) {
  if (!btn) return;
  btn.classList.add("copied");
  setTimeout(function () {
    btn.classList.remove("copied");
  }, 1400);
}
function copy(text, label, btn, rec) {
  function ok() {
    $("msg").textContent = "تم نسخ " + label + " ✓";
    flashBtn(btn);
    var r = rec ? recordBrew() : null;
    if (r === "saved") toast("تم نسخ " + label + " ✓ وانحفظت التحضيرة");
    else if (r === "unknown")
      toast(
        "تم نسخ " + label + " ✓",
        [
          "💾 احفظ المحصول",
          function () {
            saveBean();
          },
        ],
        5000,
      );
    else toast("تم نسخ " + label + " ✓");
  }
  function no() {
    toast("ما اننسخ، حدد النص وانسخه يدوي");
  }
  function fb() {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy") ? ok() : no();
    } catch (e) {
      no();
    }
    document.body.removeChild(ta);
  }
  try {
    navigator.clipboard.writeText(text).then(ok, fb);
  } catch (e) {
    fb();
  }
}
var SITE = "https://h2beanbook.vercel.app";
function postText() {
  var t = $("out").value;
  return t ? t + "\n\n☕✨ **عجبك؟ سوّ سجلك بنفسك!**\n👉 <" + SITE + ">" : "";
}
function titleText() {
  var t = $("title").textContent;
  return t.indexOf("يظهر هنا") < 0 ? t : "";
}
$("copyAll").onclick = function () {
  var t = postText();
  if (t) copy(t, "النص", this, true);
  else toast("النص فاضي، عبّ الحقول أول");
};
$("copyTitle").onclick = function () {
  var t = titleText();
  if (t) copy(t, "العنوان", this);
  else toast("اكتب المحمصة والمحصول عشان يطلع العنوان");
};
$("copyBoth").onclick = function () {
  var t = [titleText(), postText()].filter(Boolean).join("\n\n");
  if (t) copy(t, "العنوان والنص", this, true);
  else toast("ما فيه شي ينسخ، عبّ الحقول أول");
};
if ($("mbCopy"))
  $("mbCopy").onclick = function () {
    var t = [titleText(), postText()].filter(Boolean).join("\n\n");
    if (t) copy(t, "العنوان والنص", this, true);
    else toast("ما فيه شي ينسخ، عبّ الحقول أول");
  };
if ($("mbPreview")) $("mbPreview").onclick = openSheet;
if (navigator.share) {
  $("share").hidden = false;
  $("share").onclick = function () {
    var t = postText();
    if (!t) {
      toast("النص فاضي، عبّ الحقول أول");
      return;
    }
    recordBrew();
    navigator.share({ text: t }).catch(function () {});
  };
}

// ================= السلالة: أكثر من سلالة =================
// The hidden #variety holds the chosen varieties joined with "، " (an old single value is just a list of one, and an old
// "other" value is read from #variety_o), so drafts, saved beans and the post line need no other change.
var VARIETIES = ["74110", "74112", "74148", "74158", "Batian", "Bourbon", "Bourbon Aji", "Catuai", "Caturra", "Castillo", "Chiroso", "Dega", "ETH47", "Field Blend", "Geisha", "Gesha", "Gesha 1931", "Gesha Inca", "Green Tip Gesha", "Heirloom", "Heirloom (إثيوبي محلي)", "Heirloom/Landrace", "Java", "Kurume", "Laurina", "Maragesha", "Mejorado", "Mokka", "Ombligon", "Pacamara", "Parainema", "Pacas", "Pink Bourbon", "Red Bourbon", "Rosado", "Ruiru 11", "Sidra", "SL9", "SL28", "SL34", "Sln9", "Sudan Rume", "Typica", "Villa Sarchi", "Walega", "Wolisho", "Wush Wush", "Yellow Bourbon"];
var varPick = (function () {
  var SEP = "، ";
  var shown = null;
  function parse(str) {
    if (str === "__o") str = $("variety_o").value;
    var seen = {},
      out = [];
    String(str || "")
      .split(/\s*[،,]\s*/)
      .forEach(function (x) {
        x = x.trim();
        if (x && !seen[x.toLowerCase()]) {
          seen[x.toLowerCase()] = 1;
          out.push(x);
        }
      });
    return out;
  }
  function chosen() {
    return parse($("variety").value);
  }
  function has(list, x) {
    return list.some(function (y) {
      return y.toLowerCase() === x.toLowerCase();
    });
  }
  function put(list) {
    $("variety").value = list.join(SEP);
    $("variety_o").value = "";
    draw();
    render();
  }
  function add(x) {
    x = String(x || "")
      .replace(/[،,]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    if (!x) return;
    var exact = VARIETIES.filter(function (v) {
      return v.toLowerCase() === x.toLowerCase();
    })[0];
    var list = chosen();
    if (!has(list, exact || x)) list.push(exact || x);
    $("varQ").value = "";
    $("varOther").hidden = true;
    put(list);
  }
  // The dropdown lists the varieties not chosen yet; the chosen ones are the pills above it.
  function drawList() {
    var list = chosen();
    $("varPickSel").innerHTML =
      '<option value="">+ أضف سلالة</option>' +
      VARIETIES.filter(function (v) {
        return !has(list, v);
      })
        .map(function (v) {
          return '<option value="' + esc(v) + '">' + esc(v) + "</option>";
        })
        .join("") +
      '<option value="__o">سلالة أخرى…</option>';
  }
  function draw() {
    var list = chosen();
    shown = $("variety").value;
    $("varSel").innerHTML = list
      .map(function (v) {
        return (
          '<button type="button" class="vchip on" data-x="' +
          esc(v) +
          '" aria-label="شيل ' +
          esc(v) +
          '">' +
          esc(v) +
          " ✕</button>"
        );
      })
      .join("");
    drawList();
  }
  // Called from render(): redraw when the value changed from outside (draft load, saved coffee, reset).
  function sync() {
    if ($("variety").value === "__o")
      $("variety").value = parse("__o").join(SEP);
    if ($("variety").value !== shown) draw();
  }
  $("varSel").addEventListener("click", function (e) {
    var b = e.target.closest("[data-x]");
    if (!b) return;
    var x = b.getAttribute("data-x");
    put(
      chosen().filter(function (y) {
        return y.toLowerCase() !== x.toLowerCase();
      }),
    );
  });
  $("varPickSel").addEventListener("change", function () {
    var v = this.value;
    this.value = "";
    if (v === "__o") {
      $("varOther").hidden = false;
      $("varQ").focus();
    } else if (v) add(v);
  });
  $("varAdd").addEventListener("click", function () {
    add($("varQ").value);
  });
  $("varQ").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      add($("varQ").value);
    }
  });
  return { sync: sync, add: add, chosen: chosen };
})();

// ================= أرشيف المحاصيل والتحضيرة السابقة =================
var BEANS_KEY = "brewlog-beans-v1";
var BEAN_IDS = [
  "origin_o",
  "process_o",
  "variety_o",
  "roaster",
  "coffee",
  "origin",
  "process",
  "variety",
  "level",
  "roast",
];
var LAST_IDS = [
  "method_o",
  "grinder_o",
  "method",
  "tool",
  "filter",
  "grinder",
  "grind",
  "water",
  "temp",
  "dose",
  "yield",
  "time",
];
var beans = loadBeans();
var beanCollapsed = false;
var stripSig = "";

function loadBeans() {
  try {
    var a = JSON.parse(localStorage.getItem(BEANS_KEY) || "[]");
    return Array.isArray(a)
      ? a.filter(function (b) {
          return b && b.id && b.f;
        })
      : [];
  } catch (e) {
    return [];
  }
}
function storeBeans() {
  try {
    localStorage.setItem(BEANS_KEY, JSON.stringify(beans));
    return true;
  } catch (e) {
    toast("ما قدرت أحفظ في المتصفح");
    return false;
  }
}
function keyOf(r, c) {
  function n(x) {
    return String(x || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }
  return n(c) ? n(r) + "|" + n(c) : "";
}
function curKey() {
  return keyOf($("roaster").value, $("coffee").value);
}
function curBean() {
  var k = curKey();
  if (!k) return null;
  return (
    beans.filter(function (b) {
      return b.id === k;
    })[0] || null
  );
}
function touchBean(b) {
  beans = [b].concat(
    beans.filter(function (x) {
      return x !== b;
    }),
  );
}
function setField(id, v) {
  var e = $(id);
  if (!e) return;
  v = v == null ? "" : String(v);
  e.value = v;
  if (e.tagName === "SELECT" && e.value !== v) {
    if (v && $(id + "_o")) {
      e.value = "__o";
      $(id + "_o").value = v;
    } else e.selectedIndex = 0;
  }
}
function beanFields() {
  var f = {};
  BEAN_IDS.forEach(function (id) {
    f[id] = $(id).value.trim();
  });
  ["origin", "process", "variety"].forEach(function (k) {
    if (f[k] !== "__o") f[k + "_o"] = "";
  });
  return f;
}
function brewSnap() {
  var s = {};
  LAST_IDS.forEach(function (id) {
    s[id] = $(id).value.trim();
  });
  if (s.method !== "__o") s.method_o = "";
  if (s.grinder !== "__o") s.grinder_o = "";
  s.taste = $("taste").value.trim();
  s.notes = $("notes").value.trim();
  s.ts = Date.now();
  return s;
}
function hasBrew(s) {
  return !!(s.method || s.tool || s.grinder || s.grind || s.dose || s.yield);
}

function daysSince(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return null;
  var p = v.split("-"),
    d = new Date(+p[0], +p[1] - 1, +p[2]),
    n = new Date(),
    t = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((t - d) / 864e5);
}
function daysTxt(n) {
  if (n === null || n < 0) return "";
  if (n === 0) return "محمصة اليوم";
  if (n === 1) return "يوم من التحميص";
  if (n === 2) return "يومين من التحميص";
  return n + (n <= 10 ? " أيام" : " يوم") + " من التحميص";
}
function agoTxt(ts) {
  if (!ts) return "";
  var a = new Date(ts),
    n = new Date(),
    d = Math.round(
      (new Date(n.getFullYear(), n.getMonth(), n.getDate()) -
        new Date(a.getFullYear(), a.getMonth(), a.getDate())) /
        864e5,
    );
  if (d <= 0) return "اليوم";
  if (d === 1) return "أمس";
  if (d === 2) return "قبل يومين";
  return "قبل " + d + (d <= 10 ? " أيام" : " يوم");
}
function trunc(s, n) {
  s = String(s).replace(/\s*\n+\s*/g, " / ");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function saveBean() {
  var key = curKey();
  if (!key) {
    toast("اكتب اسم المحصول أول");
    return;
  }
  var b = curBean(),
    isNew = !b,
    s = brewSnap();
  if (isNew) b = { id: key, f: {}, last: null };
  b.f = beanFields();
  if (!b.last && hasBrew(s)) b.last = s;
  touchBean(b);
  storeBeans();
  render();
  toast(isNew ? "انحفظ المحصول ✓" : "تحدّث المحصول ✓");
}
function applyBean(id) {
  var b = beans.filter(function (x) {
    return x.id === id;
  })[0];
  if (!b) return;
  var before = snap();
  BEAN_IDS.forEach(function (k) {
    setField(k, b.f[k]);
  });
  beanCollapsed = true;
  render();
  if (window.innerWidth <= 860 && mobileAcc.getActive() === 0) {
    mobileAcc.openIdx(1, true);
  }
  toast(
    "تعبّى «" + (b.f.coffee || "") + "»",
    [
      "تراجع",
      function () {
        load(before);
        render();
      },
    ],
    5000,
  );
}
function newBean() {
  var before = snap();
  BEAN_IDS.forEach(function (k) {
    setField(k, "");
  });
  beanCollapsed = false;
  mobileAcc.openIdx(0, true);
  render();
  $("roaster").focus();
  toast(
    "جهّزت محصول جديد",
    [
      "تراجع",
      function () {
        load(before);
        render();
      },
    ],
    5000,
  );
}
function delBean() {
  var b = curBean();
  if (!b) return;
  var before = beans.slice();
  beans = beans.filter(function (x) {
    return x !== b;
  });
  storeBeans();
  render();
  toast(
    "انحذف المحصول من الأرشيف",
    [
      "تراجع",
      function () {
        beans = before;
        storeBeans();
        render();
      },
    ],
    6000,
  );
}
function applyLast() {
  var b = curBean();
  if (!b || !b.last) return;
  var before = snap();
  $("gq").value = "";
  buildGrinders("");
  LAST_IDS.forEach(function (id) {
    setField(id, b.last[id]);
  });
  render();
  toast(
    "انعبّت إعدادات آخر تحضيرة",
    [
      "تراجع",
      function () {
        load(before);
        render();
      },
    ],
    5000,
  );
}
function recordBrew() {
  var key = curKey(),
    s = brewSnap();
  if (!key || !hasBrew(s)) return null;
  var b = curBean();
  if (!b) return "unknown";
  b.last = s;
  touchBean(b);
  storeBeans();
  render();
  return "saved";
}

function renderStrip(b) {
  var cur = b ? b.id : "";
  var sig =
    cur +
    "#" +
    beans
      .map(function (x) {
        return x.id + "~" + x.f.coffee + "~" + x.f.roaster;
      })
      .join("#");
  if (sig === stripSig) return;
  stripSig = sig;
  var cs = Math.max(0.82, 1 - Math.max(0, beans.length - 3) * 0.045);
  $("beanStrip").style.setProperty("--cs", cs.toFixed(2));
  var h =
    '<button type="button" class="bean-chip new" data-new="1">+ جديد</button>';
  h += beans
    .map(function (x) {
      return (
        '<button type="button" class="bean-chip' +
        (x.id === cur ? " on" : "") +
        '" data-id="' +
        esc(x.id) +
        '">' +
        (x.f.roaster ? "<i>" + esc(x.f.roaster) + "</i>" : "") +
        "<span>" +
        esc(x.f.coffee || "") +
        "</span></button>"
      );
    })
    .join("");
  if (!beans.length)
    h +=
      '<span class="bean-empty">ما فيه محاصيل محفوظة، عبّ بيانات المحصول واضغط 💾 احفظ المحصول.</span>';
  $("beanStrip").innerHTML = h;
}
function renderLast(b) {
  var card = $("lastCard"),
    L = b && b.last;
  if (!L) {
    card.hidden = true;
    return;
  }
  var m = L.method === "__o" ? L.method_o : L.method,
    gr = L.grinder === "__o" ? L.grinder_o : L.grinder ? grName(L.grinder) : "",
    d = +L.dose,
    y = +L.yield,
    both = d > 0 && y > 0;
  var main = [
    m,
    L.grind ? "طحنة " + L.grind : "",
    both ? "1:" + (y / d).toFixed(1) : "",
    L.time ? "وقت " + L.time : "",
  ].filter(Boolean);
  var sub = [
    gr ? "الطاحونة: " + gr : "",
    L.temp ? L.temp + "°" : "",
    both ? L.dose + " غ ← " + L.yield + " غ" : "",
    L.water ? "ماء " + L.water : "",
  ].filter(Boolean);
  var notes = [
    L.taste ? "الطعم: " + trunc(L.taste, 60) : "",
    L.notes ? "الملاحظة: " + trunc(L.notes, 70) : "",
  ].filter(Boolean);
  var h =
    '<div><b class="last-title">💡 آخر تحضيرة</b> <span class="hint">(' +
    esc(agoTxt(L.ts)) +
    ")</span></div>";
  if (main.length)
    h += '<div class="last-main">' + main.map(esc).join(" • ") + "</div>";
  if (sub.length)
    h += '<div class="hint">' + sub.map(esc).join(" • ") + "</div>";
  if (notes.length)
    h += '<div class="last-notes">' + notes.map(esc).join("<br>") + "</div>";
  $("lastBody").innerHTML = h;
  var cur = brewSnap(),
    same = LAST_IDS.every(function (id) {
      return (cur[id] || "") === (L[id] || "");
    });
  $("lastCopy").disabled = same;
  $("lastCopy").textContent = same ? "✓ نفس الإعدادات" : "نسخ الإعدادات";
  card.hidden = false;
}
function renderBeans() {
  var key = curKey(),
    b = curBean(),
    n = daysSince($("roast").value),
    dh = $("roastDays"),
    dt = n === null ? "" : n < 0 ? "التاريخ بعد اليوم، تأكد منه" : daysTxt(n);
  dh.textContent = dt;
  dh.hidden = !dt;

  var col = beanCollapsed && !!key;
  $("beanFields").hidden = col;
  $("beanSummary").hidden = !col;
  if (col) {
    var meta = [val("roaster"), val("origin"), val("process")]
      .filter(Boolean)
      .map(esc);
    var d = daysTxt(n);
    if (d) meta.push('<span class="bs-days">' + esc(d) + "</span>");
    $("beanSummaryText").innerHTML =
      "<b>" +
      esc(val("coffee")) +
      "</b>" +
      (meta.length
        ? ' <span class="bs-meta">• ' + meta.join(" • ") + "</span>"
        : "");
  }
  $("beanSave").textContent = b ? "💾 حدّث المحصول" : "💾 احفظ المحصول";
  $("beanFold").hidden = !key || col;
  $("beanDel").hidden = !b;
  renderStrip(b);
  renderLast(b);
}
function fitNotes() {
  var n = $("notes");
  n.style.height = "auto";
  if (n.scrollHeight > n.clientHeight + 1)
    n.style.height = n.scrollHeight + 2 + "px";
  else n.style.height = "";
}

$("beanStrip").addEventListener("click", function (e) {
  var c = e.target.closest(".bean-chip");
  if (!c) return;
  if (c.dataset.new) newBean();
  else applyBean(c.dataset.id);
});
$("beanSave").onclick = saveBean;
$("beanEdit").onclick = function () {
  beanCollapsed = false;
  render();
};
$("beanFold").onclick = function () {
  beanCollapsed = true;
  render();
};
$("beanDel").onclick = delBean;
$("lastCopy").onclick = applyLast;

// ================= معاينة البوست كنافذة من تحت (الجوال) =================
function openSheet() {
  $("sidePanel").classList.add("open");
  $("sheetBackdrop").classList.add("open");
  document.body.classList.add("sheet-open");
}
function closeSheet() {
  $("sidePanel").classList.remove("open");
  $("sheetBackdrop").classList.remove("open");
  document.body.classList.remove("sheet-open");
}
$("sheetClose").onclick = closeSheet;
$("sheetBackdrop").onclick = closeSheet;
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeSheet();
});
window.addEventListener("resize", function () {
  if (window.innerWidth > 860) closeSheet();
});
(function () {
  var g = $("sheetGrip"),
    sp = $("sidePanel"),
    y0 = 0,
    dy = 0,
    drag = false;
  function end() {
    if (!drag) return;
    drag = false;
    sp.style.transition = "";
    sp.style.transform = "";
    if (dy > 80) closeSheet();
    dy = 0;
  }
  g.addEventListener(
    "touchstart",
    function (e) {
      if (e.target.closest("button")) return;
      drag = true;
      y0 = e.touches[0].clientY;
      dy = 0;
      sp.style.transition = "none";
    },
    { passive: true },
  );
  g.addEventListener(
    "touchmove",
    function (e) {
      if (!drag) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      sp.style.transform = "translateY(" + dy + "px)";
    },
    { passive: true },
  );
  g.addEventListener("touchend", end);
  g.addEventListener("touchcancel", end);
})();

// ================= الحفظ التلقائي والمسح =================
var DRAFT = "brewlog-draft-v1";
function snap() {
  var v = {};
  document
    .querySelectorAll("main input[id],main select[id],main textarea[id]")
    .forEach(function (e) {
      if (
        e.id !== "gq" &&
        e.id !== "varQ" &&
        e.id !== "varPickSel" &&
        e.id !== "pyrCustomIn" &&
        e.type !== "range"
      )
        v[e.id] = e.type === "checkbox" ? e.checked : e.value;
    });
  var r = {};
  scores.forEach(function (x) {
    r[x[1]] = [$(x[1]).value, $(x[1]).dataset.touched];
  });
  var p = [].slice.call(document.querySelectorAll(".pour")).map(function (d) {
    return [
      d.querySelector(".a").value,
      d.querySelector(".t").value,
      d.querySelector(".nt input").value,
    ];
  });
  var a = [].slice
    .call(document.querySelectorAll("#adj input:checked"))
    .map(function (c) {
      return c.value;
    });
  var pyr = {
    top: pyrState.top.slice(),
    heart: pyrState.heart.slice(),
    base: pyrState.base.slice(),
  };
  return { v: v, r: r, p: p, a: a, pyr: pyr, bc: beanCollapsed };
}
function load(st) {
  beanCollapsed = !!st.bc;
  $("gq").value = "";
  buildGrinders("");
  Object.keys(st.v || {}).forEach(function (id) {
    var e = $(id);
    if (!e) return;
    if (e.type === "checkbox") e.checked = !!st.v[id];
    else e.value = st.v[id];
  });
  Object.keys(st.r || {}).forEach(function (id) {
    if ($(id)) {
      $(id).value = st.r[id][0];
      $(id).dataset.touched = st.r[id][1] === "1" ? "1" : "0";
    }
  });
  $("pours").innerHTML = "";
  (st.p && st.p.length ? st.p : [0, 0]).forEach(function (x) {
    addPour(x || null);
  });
  document.querySelectorAll("#adj input").forEach(function (c) {
    c.checked = (st.a || []).indexOf(c.value) > -1;
  });
  if (st.pyr) {
    pyrState.top = Array.isArray(st.pyr.top) ? st.pyr.top.slice() : [];
    pyrState.heart = Array.isArray(st.pyr.heart) ? st.pyr.heart.slice() : [];
    pyrState.base = Array.isArray(st.pyr.base) ? st.pyr.base.slice() : [];
  } else {
    pyrState = { top: [], heart: [], base: [] };
  }
}
var loaded = false;
function save() {
  if (!loaded) return;
  try {
    localStorage.setItem(DRAFT, JSON.stringify(snap()));
  } catch (e) {}
}
function clearForm() {
  if (brewTimer && brewTimer.isRunning()) brewTimer.cancel(true);
  document
    .querySelectorAll(
      "input[type=text],input[type=search],input[type=number],input[type=date],textarea:not(#out)",
    )
    .forEach(function (e) {
      e.value = "";
    });
  document.querySelectorAll("#adj input").forEach(function (c) {
    c.checked = false;
  });
  buildGrinders("");
  document.querySelectorAll("select").forEach(function (x) {
    x.selectedIndex = 0;
  });
  $("addmic").checked = true;
  $("gmeas").value = "";
  $("variety").value = "";
  $("variety_o").value = "";
  scores.forEach(function (s) {
    $(s[1]).value = 5;
    $(s[1]).dataset.touched = "0";
  });
  pyrState = { top: [], heart: [], base: [] };
  $("pours").innerHTML = "";
  addPour();
  addPour();
  beanCollapsed = false;
  mobileAcc.openIdx(0, false);
}
$("reset").onclick = function () {
  var before = snap();
  clearForm();
  render();
  toast(
    "انمسح كل شي",
    [
      "تراجع",
      function () {
        load(before);
        render();
        toast("رجع كل شي ✓");
      },
    ],
    7000,
  );
};

document.querySelectorAll("main input").forEach(function (e) {
  if (!/^(checkbox|range)$/.test(e.type))
    e.setAttribute("enterkeyhint", "next");
});
document.addEventListener("keydown", function (e) {
  var t = e.target;
  if (
    e.key !== "Enter" ||
    e.isComposing ||
    t.tagName !== "INPUT" ||
    t.id === "pyrCustomIn" ||
    /^(checkbox|range)$/.test(t.type)
  )
    return;
  e.preventDefault();
  var f = [].slice
    .call(document.querySelectorAll("main input,main select,main textarea"))
    .filter(function (x) {
      return x.offsetParent && !/^(checkbox|range)$/.test(x.type);
    });
  var i = f.indexOf(t);
  if (f[i + 1]) f[i + 1].focus();
  else t.blur();
});
function isDark() {
  var t = document.documentElement.getAttribute("data-theme");
  if (t) return t === "dark";
  return !!(
    window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches
  );
}
function themeLabel() {
  var d = isDark();
  $("theme").textContent = d ? "☀️ فاتح" : "🌙 داكن";
  document.documentElement.style.colorScheme = d ? "dark" : "light";
}
try {
  var st = localStorage.getItem("theme");
  if (st === "dark" || st === "light")
    document.documentElement.setAttribute("data-theme", st);
} catch (e) {}
$("theme").onclick = function () {
  var t = isDark() ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("theme", t);
  } catch (e) {}
  themeLabel();
};
themeLabel();
mobileAcc.init();
try {
  var dr = localStorage.getItem(DRAFT);
  if (dr) load(JSON.parse(dr));
} catch (e) {}
loaded = true;
setActiveTier("top");
render();
fitNotes();
brewTimer.restore();

// The ✕ on the photo-measurement chip removes it from the post.
$("gmv").addEventListener("click", function (e) {
  if (e.target.closest("#gmx")) {
    $("gmeas").value = "";
    render();
    save();
  }
});

window.addEventListener("load", function () {
  if (window.autoAnimate) {
    autoAnimate($("pours"), { duration: 220 });
    autoAnimate($("tags"), { duration: 180 });
    autoAnimate($("pyrNotes_top"), { duration: 180 });
    autoAnimate($("pyrNotes_heart"), { duration: 180 });
    autoAnimate($("pyrNotes_base"), { duration: 180 });
  }
});
