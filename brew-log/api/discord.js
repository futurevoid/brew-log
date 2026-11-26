// Vercel serverless function: posts a brew to the Discord forum through a webhook. The webhook URL is a secret, so it lives only
// in the DISCORD_WEBHOOK_URL environment variable of the Vercel project and never in the site's files. The page sends the post
// text here; this function checks it and forwards it.
//
// Environment variables (Vercel project settings):
//   DISCORD_WEBHOOK_URL  required  webhook of the forum channel (https://discord.com/api/webhooks/...)
//   ALLOWED_ORIGINS      required  sites allowed to call this, comma separated, e.g. https://futurevoid.github.io,https://x.vercel.app
//   DISCORD_TAG_IDS      optional  JSON mapping a tag name used by the page to the forum tag id, e.g. {"V60":"123..."}
//   DISCORD_GUILD_ID     optional  server id, only used to give the page a link to the new post
//
// Request (POST, JSON): {title, body, tags: [names], threadUrl}. A threadUrl of an existing forum post makes it a reply in that
// post; without one it opens a new forum post with title and tags.
"use strict";

var LIMIT = { title: 100, tags: 5, content: 2000, embed: 4096, perWindow: 5, windowMs: 10 * 60 * 1000 };
var hits = {}; // ip -> timestamps. Per instance only, so it slows spam down but is not a strict limit.

function list(v) {
  return String(v || "")
    .split(",")
    .map(function (s) {
      return s.trim().replace(/\/+$/, "");
    })
    .filter(Boolean);
}
function threadId(url) {
  var m = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/\d+\/(\d+)(?:\/\d+)?\/?$/.exec(String(url || "").trim());
  return m ? m[1] : null;
}
function tagMap(env) {
  try {
    var m = JSON.parse(env.DISCORD_TAG_IDS || "{}");
    return m && typeof m === "object" ? m : {};
  } catch (e) {
    return {};
  }
}
function send(res, status, obj, origin) {
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.status(status).json(obj);
}

module.exports = async function handler(req, res, deps) {
  deps = deps || {};
  var env = deps.env || process.env,
    fetchFn = deps.fetch || fetch,
    now = deps.now ? deps.now() : Date.now();
  var allowed = list(env.ALLOWED_ORIGINS),
    hook = String(env.DISCORD_WEBHOOK_URL || ""),
    origin = String((req.headers && req.headers.origin) || "").replace(/\/+$/, "");
  var okOrigin = allowed.indexOf(origin) > -1 ? origin : "";

  if (req.method === "OPTIONS") {
    if (okOrigin) {
      res.setHeader("Access-Control-Allow-Origin", okOrigin);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
      res.setHeader("Vary", "Origin");
    }
    return res.status(okOrigin ? 204 : 403).end();
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "طريقة غير مدعومة" });
  if (!allowed.length || !/^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(hook))
    return send(res, 500, { ok: false, error: "الخدمة غير مضبوطة بعد" }, okOrigin);
  if (!okOrigin) return send(res, 403, { ok: false, error: "هذا الموقع غير مسموح له" });

  var ip = String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim() || "unknown";
  hits[ip] = (hits[ip] || []).filter(function (t) {
    return now - t < LIMIT.windowMs;
  });
  if (hits[ip].length >= LIMIT.perWindow) {
    var wait = Math.ceil((LIMIT.windowMs - (now - hits[ip][0])) / 1000);
    return send(res, 429, { ok: false, error: "طلبات كثيرة، جرّب بعد شوي", retryAfter: wait }, okOrigin);
  }

  var b = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch (e) {
      b = null;
    }
  }
  if (!b || typeof b !== "object") return send(res, 400, { ok: false, error: "الطلب غير صالح" }, okOrigin);

  var text = typeof b.body === "string" ? b.body.trim() : "",
    title = typeof b.title === "string" ? b.title.trim() : "",
    link = typeof b.threadUrl === "string" ? b.threadUrl.trim() : "",
    reply = !!link,
    tid = reply ? threadId(link) : null;
  if (reply && !tid) return send(res, 400, { ok: false, error: "رابط المنشور غير صحيح" }, okOrigin);
  if (!text) return send(res, 400, { ok: false, error: "النص فاضي" }, okOrigin);
  if (!reply && (!title || title.length > LIMIT.title))
    return send(res, 400, { ok: false, error: "العنوان لازم يكون من 1 إلى " + LIMIT.title + " حرف" }, okOrigin);

  var names = Array.isArray(b.tags)
    ? b.tags
        .filter(function (t) {
          return typeof t === "string" && t.trim();
        })
        .map(function (t) {
          return t.trim();
        })
    : [];
  var map = tagMap(env),
    ids = [],
    dropped = [];
  names.forEach(function (n) {
    if (typeof map[n] === "string" && /^\d+$/.test(map[n]) && ids.indexOf(map[n]) < 0 && ids.length < LIMIT.tags) ids.push(map[n]);
    else dropped.push(n);
  });
  // Tags the server could not apply are listed in the post so a moderator can add them.
  if (!reply && dropped.length) text += "\n\n🏷️ التاقات: " + dropped.join(" · ");
  if (text.length > LIMIT.embed) return send(res, 400, { ok: false, error: "النص أطول من المسموح" }, okOrigin);

  var payload = { allowed_mentions: { parse: [] } };
  if (text.length <= LIMIT.content) payload.content = text;
  else payload.embeds = [{ description: text }];
  if (!reply) {
    payload.thread_name = title;
    if (ids.length) payload.applied_tags = ids;
  }
  var url = hook + "?wait=true" + (reply ? "&thread_id=" + tid : "");

  hits[ip].push(now);
  var ctl = typeof AbortController === "function" ? new AbortController() : null,
    timer = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : null,
    r,
    j = {};
  try {
    r = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctl ? ctl.signal : undefined,
    });
    try {
      j = await r.json();
    } catch (e) {
      j = {};
    }
  } catch (e) {
    return send(res, 502, { ok: false, error: "ما قدرت أوصل لديسكورد" }, okOrigin);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!r.ok) {
    if (r.status === 429) return send(res, 429, { ok: false, error: "ديسكورد يطلب الانتظار", retryAfter: Math.ceil(j.retry_after || 5) }, okOrigin);
    if (r.status === 404 || r.status === 400)
      return send(res, 502, { ok: false, error: reply ? "ما لقيت المنشور، أو أنه مو من قناة المحاصيل" : "ديسكورد رفض الطلب" }, okOrigin);
    return send(res, 502, { ok: false, error: "ديسكورد رفض الطلب (" + r.status + ")" }, okOrigin);
  }
  var out = { ok: true, droppedTags: dropped };
  if (env.DISCORD_GUILD_ID && /^\d+$/.test(String(env.DISCORD_GUILD_ID)) && j.channel_id)
    out.url = "https://discord.com/channels/" + env.DISCORD_GUILD_ID + "/" + j.channel_id + (reply && j.id ? "/" + j.id : "");
  return send(res, 200, out, okOrigin);
};
module.exports._reset = function () {
  hits = {};
};
