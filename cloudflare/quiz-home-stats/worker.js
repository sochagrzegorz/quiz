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

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403 });

    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname.endsWith("/visit") && request.method === "POST") {
      const country = /^[A-Z]{2}$/.test(request.cf?.country || "")
        ? request.cf.country
        : "XX";
      const keys = ["total", "country:" + country];
      const current = await Promise.all(
        keys.map(async (key) => Number(await env.STATS.get(key)) || 0),
      );
      await Promise.all(
        keys.map((key, index) => env.STATS.put(key, String(current[index] + 1))),
      );
      return json({ ok: true });
    }

    if (request.method === "GET" && !url.pathname.endsWith("/visit")) {
      const total = Number(await env.STATS.get("total")) || 0;
      const listed = await env.STATS.list({ prefix: "country:", limit: 300 });
      const countries = await Promise.all(
        listed.keys.map(async (item) => ({
          code: item.name.slice(8),
          visits: Number(await env.STATS.get(item.name)) || 0,
        })),
      );
      countries.sort((a, b) => b.visits - a.visits || a.code.localeCompare(b.code));
      return json({ total, countries: countries.slice(0, 8) });
    }

    return json({ error: "Not found" }, 404);
  },
};
