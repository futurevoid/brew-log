// Pour plans for the brew log: a ready recipe (or your own numbers) turned into pours for a given dose. Pure functions, no page
// access, so tools/test_recipes.js can check them. Each pour is {a: ml poured in this step, d: seconds from the start of this
// pour to the start of the next one (the last one runs to the end of the brew), note}. That is the same meaning the pour
// table already uses for its amount and time columns.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Recipes = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Whole millilitres per step that add up to exactly `total`. cum: cumulative fractions of the water, ending at 1.
  function steps(total, cum) {
    var out = [],
      prev = 0;
    cum.forEach(function (c) {
      var t = Math.round(total * c);
      out.push(t - prev);
      prev = t;
    });
    return out;
  }

  var LIST = [
    {
      id: "46",
      name: "4:6 — تتسو كاسويا",
      dose: 20,
      ratio: 15,
      temp: 92,
      method: "V60",
      src: "من وصفة تتسو كاسويا (بطل العالم لتحضير القهوة 2016) كما نشرتها Hario: 20 غ و300 مل بحرارة 92°، والصبّات 50 و70 و60 و60 و60 مل، وينتهي عند 3:30. الصبّتان الأخيرتان عند 2:10 و2:40 من Hario، أما الفواصل الأولى (45 ثانية) فتقريبية. الكميات تتغير بنفس النسبة مع جرعتك.",
    },
    {
      id: "hoff",
      name: "V60 — جيمس هوفمان",
      dose: 30,
      ratio: 500 / 30,
      temp: 97,
      method: "V60",
      src: "مبنية على طريقة جيمس هوفمان: 30 غ و500 غ ماء، تفتيح بضعف وزن البن لمدة 45 ثانية مع تدويخ، ثم صبّ إلى 60% من الماء، ثم إلى الكمية كاملة، وتحريك خفيف وتدويخ. الأوقات تقريبية والمجموع حوالي 3:30.",
    },
    {
      id: "custom",
      name: "حسب رغبتي",
      dose: 15,
      ratio: 16,
      temp: null,
      method: "",
      src: "حساب بأرقامك: تفتيح، ثم الماء الباقي على صبّات متساوية.",
    },
  ];

  function byId(id) {
    return LIST.filter(function (r) {
      return r.id === id;
    })[0];
  }

  // opts: {dose, ratio} for every recipe; custom also takes bloomX, bloomSec, pours, gap, totalSec (optional end time).
  // Returns {rows, water, total, temp, method} or null when the numbers do not make sense.
  function plan(id, opts) {
    var r = byId(id),
      dose = +opts.dose,
      ratio = +opts.ratio;
    if (!r || !(dose >= 5 && dose <= 100) || !(ratio >= 8 && ratio <= 25))
      return null;
    var water = Math.round(dose * ratio),
      a,
      d,
      note;
    if (id === "46") {
      a = steps(water, [50 / 300, 120 / 300, 180 / 300, 240 / 300, 1]);
      d = [45, 45, 40, 30, 50];
      note = ["تفتيح", "", "", "", ""];
    } else if (id === "hoff") {
      var bloom = Math.round(dose * 2);
      if (bloom >= Math.round(water * 0.6)) return null;
      a = steps(water, [bloom / water, 0.6, 1]);
      d = [45, 30, 135];
      note = [
        "تفتيح مع تدويخ خفيف",
        "صبّ مستمر",
        "صبّ إلى الكمية كاملة، ثم تحريك خفيف بالملعقة وتدويخ",
      ];
    } else {
      var n = Math.round(+opts.pours),
        bx = +opts.bloomX,
        bs = Math.round(+opts.bloomSec),
        gap = Math.round(+opts.gap);
      if (!(n >= 1 && n <= 8) || !(bx >= 0 && bx <= 4) || !(bs >= 0 && bs <= 180) || !(gap >= 5 && gap <= 180))
        return null;
      var b = Math.round(dose * bx);
      if (b >= water) return null;
      var cum = [],
        i;
      if (b > 0) cum.push(b / water);
      for (i = 1; i <= n; i++) cum.push((b + ((water - b) * i) / n) / water);
      a = steps(water, cum);
      d = [];
      note = [];
      if (b > 0) {
        d.push(bs);
        note.push("تفتيح");
      }
      for (i = 0; i < n; i++) {
        d.push(gap);
        note.push("");
      }
      var end = Math.round(+opts.totalSec) || 0,
        used = d.reduce(function (x, y) {
          return x + y;
        }, 0);
      if (end > used) d[d.length - 1] += end - used;
    }
    var rows = a.map(function (ml, i) {
      return { a: ml, d: d[i], note: note[i] };
    });
    return {
      rows: rows,
      water: water,
      total: d.reduce(function (x, y) {
        return x + y;
      }, 0),
      temp: r.temp,
      method: r.method,
    };
  }

  return { LIST: LIST, byId: byId, plan: plan };
});
