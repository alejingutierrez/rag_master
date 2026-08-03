/**
 * Auditoría del sitemap público contra la respuesta real de cada URL.
 *
 * Uso:
 *   npm run seo:audit:indexability
 *   npm run seo:audit:indexability -- --sitemap=https://dominio/sitemap.xml --concurrency=4
 *   npm run seo:audit:indexability -- --sitemap=http://127.0.0.1:3100/sitemap.xml --base-url=http://127.0.0.1:3100
 */

type Issue = { kind: string; url: string; detail?: string | number };
const BOT_USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const option = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const sitemapUrl = option("sitemap") ?? "https://historiacolombiana.com/sitemap.xml";
const baseUrl = option("base-url");
const concurrency = Math.max(1, Math.min(12, Number(option("concurrency") ?? 4) || 4));

function xmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function urlKey(value: string): string {
  const u = new URL(value);
  const path = u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "");
  return `${u.origin}${path}${u.search}`;
}

function pathKey(value: string): string {
  const u = new URL(value);
  const path = u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "");
  return `${path}${u.search}`;
}

function crawlUrl(publicUrl: string): string {
  if (!baseUrl) return publicUrl;
  const publicTarget = new URL(publicUrl);
  return new URL(`${publicTarget.pathname}${publicTarget.search}`, baseUrl).toString();
}

function attr(tag: string, name: string): string {
  return (tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i")) ?? [])[1] ?? "";
}

function metaContent(head: string, name: string): string {
  const tags = head.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = tags.find((candidate) => attr(candidate, "name").toLowerCase() === name);
  return tag ? attr(tag, "content") : "";
}

function canonicalHref(head: string): string {
  const tags = head.match(/<link\b[^>]*>/gi) ?? [];
  const tag = tags.find((candidate) =>
    attr(candidate, "rel")
      .toLowerCase()
      .split(/\s+/)
      .includes("canonical"),
  );
  return tag ? xmlDecode(attr(tag, "href")) : "";
}

const sitemapResponse = await fetch(sitemapUrl, {
  signal: AbortSignal.timeout(30_000),
  // Next.js bloquea el streaming de metadata para crawlers conocidos. Usar el
  // agente de Google prueba exactamente el HTML indexable, con `<head>` completo.
  headers: { "user-agent": BOT_USER_AGENT },
});
if (!sitemapResponse.ok) {
  throw new Error(`Sitemap HTTP ${sitemapResponse.status}: ${sitemapUrl}`);
}

const xml = await sitemapResponse.text();
const urlBlocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1]);
const urls = urlBlocks.map((block) => {
  const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "";
  return xmlDecode(loc);
});
if (!urls.length) throw new Error(`El sitemap no contiene URLs: ${sitemapUrl}`);

const issues: Issue[] = [];
const sitemapKeys = new Set<string>();
const internalLinks = new Map<string, string>();
for (let index = 0; index < urlBlocks.length; index += 1) {
  const url = urls[index];
  if (!url) {
    issues.push({ kind: "missing_loc", url: sitemapUrl, detail: index + 1 });
    continue;
  }
  const key = urlKey(url);
  if (sitemapKeys.has(key)) issues.push({ kind: "duplicate_url", url });
  sitemapKeys.add(key);

  const lastmod = urlBlocks[index].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
  if (!lastmod) continue;
  const timestamp = Date.parse(lastmod);
  if (!Number.isFinite(timestamp)) issues.push({ kind: "invalid_lastmod", url, detail: lastmod });
  else if (timestamp > Date.now() + 86_400_000) {
    issues.push({ kind: "future_lastmod", url, detail: lastmod });
  }
}
let cursor = 0;
let ok = 0;

async function worker(): Promise<void> {
  while (true) {
    const index = cursor++;
    if (index >= urls.length) return;
    const url = urls[index];
    const target = crawlUrl(url);
    try {
      let response: Response | undefined;
      let html = "";
      let contentType = "";
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch(target, {
          redirect: "follow",
          signal: AbortSignal.timeout(30_000),
          headers: { "user-agent": BOT_USER_AGENT },
        });
        contentType = response.headers.get("content-type") ?? "";
        if (response.status !== 200 || !contentType.includes("text/html")) break;
        html = await response.text();
        if (/<\/head>/i.test(html) && /<\/html>/i.test(html)) break;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
      if (!response) throw new Error("No se recibió respuesta");
      if (response.status !== 200) {
        issues.push({ kind: "status", url, detail: response.status });
        continue;
      }
      const redirected = baseUrl
        ? pathKey(response.url) !== pathKey(target)
        : urlKey(response.url) !== urlKey(url);
      if (redirected) {
        issues.push({ kind: "redirect", url, detail: response.url });
      }
      if (!contentType.includes("text/html")) {
        issues.push({ kind: "content_type", url, detail: contentType });
        continue;
      }
      if (!/<\/head>/i.test(html) || !/<\/html>/i.test(html)) {
        issues.push({ kind: "incomplete_html", url });
        continue;
      }
      // Next puede entregar metadata bloqueante en `<head>` a bots o transmitirla
      // al final del documento para otros agentes. En ambos casos el navegador la
      // incorpora al DOM; por eso se inspecciona el HTML completo.
      const title = (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1]?.trim() ?? "";
      const description = metaContent(html, "description");
      const canonical = canonicalHref(html);
      const robots = `${metaContent(html, "robots")} ${response.headers.get("x-robots-tag") ?? ""}`;
      const h1Count = (html.match(/<h1\b/gi) ?? []).length;
      const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
      const lang = attr(htmlTag, "lang").toLowerCase();

      if (!title) issues.push({ kind: "missing_title", url });
      if (!description) issues.push({ kind: "missing_description", url });
      if (!canonical) issues.push({ kind: "missing_canonical", url });
      else if (urlKey(canonical) !== urlKey(url)) {
        issues.push({ kind: "canonical_mismatch", url, detail: canonical });
      }
      if (/\bnoindex\b/i.test(robots)) issues.push({ kind: "noindex_in_sitemap", url });
      if (h1Count !== 1) issues.push({ kind: "h1_count", url, detail: h1Count });
      if (!lang) issues.push({ kind: "missing_lang", url });
      else if (!lang.startsWith("es")) issues.push({ kind: "unexpected_lang", url, detail: lang });

      for (const match of html.matchAll(
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      )) {
        try {
          JSON.parse(match[1]);
        } catch {
          issues.push({ kind: "invalid_json_ld", url });
        }
      }

      for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
        try {
          const linked = new URL(xmlDecode(match[1]), url);
          if (linked.origin !== new URL(url).origin) continue;
          if (linked.pathname.startsWith("/_next/")) continue;
          linked.hash = "";
          const normalized = linked.toString();
          if (!internalLinks.has(normalized)) internalLinks.set(normalized, url);
        } catch {
          // Esquemas no navegables (`mailto:`, `tel:`) y hrefs inválidos no son
          // enlaces internos HTTP que deba rastrear este auditor.
        }
      }
      ok += 1;
    } catch (error) {
      issues.push({
        kind: "fetch_error",
        url,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const sitemapPaths = new Set(urls.map(pathKey));
const extraInternalLinks = [...internalLinks.entries()].filter(
  ([linked]) => !sitemapPaths.has(pathKey(linked)),
);
let linkCursor = 0;
async function linkWorker(): Promise<void> {
  while (true) {
    const index = linkCursor++;
    if (index >= extraInternalLinks.length) return;
    const [linked, source] = extraInternalLinks[index];
    try {
      const response = await fetch(crawlUrl(linked), {
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
        headers: { "user-agent": BOT_USER_AGENT },
      });
      if (response.status >= 300 && response.status < 400) {
        issues.push({
          kind: "redirecting_internal_link",
          url: linked,
          detail: `${response.status} desde ${source}`,
        });
      } else if (response.status >= 400) {
        issues.push({
          kind: "broken_internal_link",
          url: linked,
          detail: `${response.status} desde ${source}`,
        });
      }
    } catch (error) {
      issues.push({
        kind: "internal_link_fetch_error",
        url: linked,
        detail: error instanceof Error ? `${error.message} desde ${source}` : String(error),
      });
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => linkWorker()));

const byKind = issues.reduce<Record<string, number>>((acc, issue) => {
  acc[issue.kind] = (acc[issue.kind] ?? 0) + 1;
  return acc;
}, {});

console.log(
  `Sitemap audit: ${urls.length} URL(s), ${internalLinks.size} enlace(s) interno(s), ${issues.length} issue(s), ${ok} HTML 200`,
);
if (issues.length) {
  console.log(JSON.stringify({ byKind, issues: issues.slice(0, 100) }, null, 2));
  process.exitCode = 1;
}
