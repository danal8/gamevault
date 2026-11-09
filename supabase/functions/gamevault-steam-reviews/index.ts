const cors = {
  "Access-Control-Allow-Origin": "https://danal8.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

async function recentReviews(id: string) {
  const response = await fetch(`https://store.steampowered.com/app/${id}/?l=english`, {signal: AbortSignal.timeout(6000)});
  if (!response.ok || !new URL(response.url).pathname.startsWith(`/app/${id}/`)) {
    throw new Error("Steam store page unavailable");
  }
  const html = await response.text();
  const recent = html.match(/([0-9]+)% of the ([0-9,]+) user reviews in the last 30 days are positive/i);
  return recent ? {percent: Number(recent[1]), count: Number(recent[2].replaceAll(",", ""))} : null;
}

async function greekReviews(id: string) {
  const response = await fetch(`https://store.steampowered.com/app/${id}/?l=greek`, {signal: AbortSignal.timeout(5000)});
  if (!response.ok || !new URL(response.url).pathname.startsWith(`/app/${id}/`)) {
    throw new Error("Localized Steam store page unavailable");
  }
  const html = await response.text();
  const summary = html.match(/data-tooltip-html="Το (\d{1,3})% των ([\d.,]+) κριτικών χρηστών στη γλώσσα σας είναι θετικές"/i);
  return summary ? {percent: Number(summary[1]), count: Number(summary[2].replace(/[.,]/g, ""))} : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, {headers: cors});
  if (request.method !== "GET") return Response.json({}, {status: 405, headers: cors});
  const id = new URL(request.url).searchParams.get("appid") ?? "";
  if (!/^[1-9][0-9]{0,9}$/.test(id)) return Response.json({}, {status: 400, headers: cors});
  const [recent, greek] = await Promise.allSettled([recentReviews(id), greekReviews(id)]);
  const failed = recent.status === "rejected" && greek.status === "rejected";
  return Response.json({
    recent: recent.status === "fulfilled" ? recent.value : null,
    greek: greek.status === "fulfilled" ? greek.value : null,
  }, {status: failed ? 502 : 200, headers: {...cors, "Cache-Control": failed ? "no-store" : "public, max-age=1800"}});
});
