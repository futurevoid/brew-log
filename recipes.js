// Pour helpers for the brew log. The user types the pours; these only supply the ready recipes (4:6 and Hoffmann) scaled to a dose,
// and an equal split of the water that is left. Pure functions, no page access, so tools/test_recipes.js can check them. Each
// pour is {a: ml poured in this step, d: seconds from the start of this pour to the start of the next one (the last one runs to
// the end of the brew), note}. That is the same meaning the pour table already uses for its amount and time columns.
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
  ];

  function byId(id) {
    return LIST.filter(function (r) {
      return r.id === id;
    })[0];
  }

  // opts: {dose, ratio}. Returns {rows, water, total, temp, method} or null when the numbers do not make sense.
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

  // `total` ml shared as equally as whole millilitres allow over n pours (the extra millilitres go to the first ones).
  function equal(total, n) {
    total = Math.round(+total);
    n = Math.round(+n);
    if (!(total > 0) || !(n >= 1 && n <= 20)) return null;
    var out = [],
      base = Math.floor(total / n),
      extra = total - base * n;
    for (var i = 0; i < n; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
  }

  return { LIST: LIST, byId: byId, plan: plan, equal: equal };
});
