const ALLOWED_ORIGIN = "https://sochagrzegorz.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Vary": "Origin",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function readStats(env) {
  const stored = await env.STATS.get("stats");
  if (stored) {
    try {
      const stats = JSON.parse(stored);
      return {
        total: Number(stats.total) || 0,
        countries: stats.countries && typeof stats.countries === "object" ? stats.countries : {},
      };
    } catch {}
  }
  return { total: Number(await env.STATS.get("total")) || 0, countries: {} };
}

export default {
  async fetch(request, env) {
    if (request.headers.get("Origin") !== ALLOWED_ORIGIN) {
      return new Response("Forbidden", { status: 403 });
    }

    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname.endsWith("/visit") && request.method === "POST") {
      const country = /^[A-Z]{2}$/.test(request.cf?.country || "")
        ? request.cf.country
        : "XX";
      const stats = await readStats(env);
      stats.total += 1;
      stats.countries[country] = (Number(stats.countries[country]) || 0) + 1;
      await env.STATS.put("stats", JSON.stringify(stats));
      return json({ ok: true });
    }

    if (request.method === "GET") {
      const stats = await readStats(env);
      const countries = Object.entries(stats.countries)
        .map(([code, visits]) => ({ code, visits: Number(visits) || 0 }))
        .sort((a, b) => b.visits - a.visits || a.code.localeCompare(b.code));
      return json({ total: stats.total, countries: countries.slice(0, 8) });
    }

    return json({ error: "Not found" }, 404);
  },
};
