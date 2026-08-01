/**
 * Derives where and how a request came from.
 *
 * Geography comes from Vercel's edge headers, which are set before the request
 * reaches this function. The raw IP is deliberately never read or stored: it is
 * personal data under GDPR, needs a lawful basis and a retention policy, and
 * answers no question that country and city do not already answer.
 */

export interface RequestContext {
  country: string | null;
  city: string | null;
  region: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
}

/** Two-letter code to a readable name for the countries most likely to appear. */
const COUNTRY_NAMES: Record<string, string> = {
  IN: "India", US: "United States", GB: "United Kingdom", DE: "Germany",
  FR: "France", NL: "Netherlands", SG: "Singapore", JP: "Japan",
  KR: "South Korea", CN: "China", CA: "Canada", AU: "Australia",
  BR: "Brazil", NG: "Nigeria", ZA: "South Africa", AE: "United Arab Emirates",
  ES: "Spain", IT: "Italy", PL: "Poland", UA: "Ukraine", RU: "Russia",
  ID: "Indonesia", VN: "Vietnam", PH: "Philippines", TR: "Turkey",
  MX: "Mexico", AR: "Argentina", SE: "Sweden", CH: "Switzerland",
  IE: "Ireland", PT: "Portugal", HK: "Hong Kong", TW: "Taiwan",
};

export function countryName(code: string | null): string {
  if (!code) return "Unknown";
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

/** Turns a country code into its flag emoji via regional indicator symbols. */
export function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "🌍";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => base + c.charCodeAt(0) - 65)
  );
}

/**
 * Identifies the browser family.
 *
 * Order matters: Edge and Opera both include "Chrome" in their user agent, and
 * Chrome includes "Safari", so the more specific checks have to come first.
 */
function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Brave/.test(ua)) return "Brave";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

function detectOS(ua: string): string {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua) && !/Mobile/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

function detectDevice(ua: string): string {
  if (/iPad|Tablet/.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/.test(ua)) return "Mobile";
  return "Desktop";
}

export function readRequestContext(req: Request): RequestContext {
  const headers = req.headers;
  const ua = headers.get("user-agent") ?? "";

  // Vercel sets these at the edge. They are absent in local development, which
  // is why every field is nullable rather than defaulted to something false.
  const city = headers.get("x-vercel-ip-city");

  return {
    country: headers.get("x-vercel-ip-country"),
    // The city header is percent-encoded, so "New%20Delhi" would otherwise be stored verbatim.
    city: city ? decodeURIComponent(city) : null,
    region: headers.get("x-vercel-ip-country-region"),
    browser: ua ? detectBrowser(ua) : null,
    os: ua ? detectOS(ua) : null,
    device: ua ? detectDevice(ua) : null,
  };
}

/** Reduces a referrer URL to its host, which is the part worth grouping on. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
