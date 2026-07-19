import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShopifyImage =
  | string
  | {
      src?: string | null;
      url?: string | null;
      alt?: string | null;
      width?: number | null;
      height?: number | null;
    };

type ShopifyProduct = {
  title?: string;
  featured_image?: ShopifyImage | null;
  image?: ShopifyImage | null;
  images?: ShopifyImage[];
  media?: Array<{
    src?: string | null;
    preview_image?: ShopifyImage | null;
    image?: ShopifyImage | null;
  }>;
  variants?: Array<{
    featured_image?: ShopifyImage | null;
  }>;
};

type ImageCandidate = {
  url: string;
  source: string;
  context: string;
  score: number;
  width?: number;
  height?: number;
};

function absoluteUrl(
  value: string,
  sourceUrl: URL,
): string {
  const cleaned = decodeHtml(
    value
      .replace(/\\\//g, "/")
      .trim(),
  );

  if (cleaned.startsWith("//")) {
    return `https:${cleaned}`;
  }

  return new URL(cleaned, sourceUrl).toString();
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);

    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function productJsonCandidates(
  sourceUrl: URL,
): URL[] {
  if (!sourceUrl.pathname.includes("/products/")) {
    return [];
  }

  const path = sourceUrl.pathname.replace(
    /\/$/,
    "",
  );
  const withoutLocale = path.replace(
    /^\/[a-z]{2}(?:-[a-z]{2})?(?=\/products\/)/i,
    "",
  );
  const candidates = [
    new URL(`${path}.js`, sourceUrl.origin),
    new URL(`${path}.json`, sourceUrl.origin),
    new URL(`${withoutLocale}.js`, sourceUrl.origin),
    new URL(
      `${withoutLocale}.json`,
      sourceUrl.origin,
    ),
  ];

  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        (entry) => entry.href === candidate.href,
      ) === index,
  );
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function imageValue(
  image: ShopifyImage | null | undefined,
): {
  url: string;
  alt: string;
  width?: number;
  height?: number;
} | null {
  if (typeof image === "string") {
    return {
      url: image,
      alt: "",
    };
  }

  if (!image) {
    return null;
  }

  const url = image.src ?? image.url;

  if (!url) {
    return null;
  }

  return {
    url,
    alt: image.alt ?? "",
    width: image.width ?? undefined,
    height: image.height ?? undefined,
  };
}

function candidateKey(url: string): string {
  try {
    const parsed = new URL(url);

    for (const parameter of [
      "width",
      "height",
      "crop",
      "format",
      "quality",
      "v",
    ]) {
      parsed.searchParams.delete(parameter);
    }

    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function scoreCandidate(
  candidate: ImageCandidate,
): number {
  const text =
    `${candidate.url} ${candidate.context}`.toLowerCase();
  let score = candidate.score;

  const positiveTerms = [
    "filament",
    "spool",
    "refill",
    "product",
    "pla",
    "petg",
    "abs",
    "asa",
    "tpu",
    "bambu",
  ];

  const negativeTerms = [
    "swatch",
    "colour-swatch",
    "color-swatch",
    "color_chip",
    "color-chip",
    "colour-chip",
    "colorcard",
    "color-card",
    "colour-card",
    "hex-code",
    "hex_code",
    "selector",
    "variant-color",
    "variant_colour",
    "gradient",
    "logo",
    "icon",
    "payment",
    "badge",
    "flag",
  ];

  for (const term of positiveTerms) {
    if (text.includes(term)) {
      score += 6;
    }
  }

  for (const term of negativeTerms) {
    if (text.includes(term)) {
      score -= 70;
    }
  }

  if (
    candidate.width &&
    candidate.height
  ) {
    const smaller = Math.min(
      candidate.width,
      candidate.height,
    );
    const larger = Math.max(
      candidate.width,
      candidate.height,
    );
    const ratio = larger / smaller;

    if (smaller >= 450) {
      score += 18;
    } else if (smaller < 120) {
      score -= 45;
    }

    if (ratio > 2.2) {
      score -= 35;
    } else if (ratio <= 1.5) {
      score += 12;
    }
  }

  return score;
}

function addCandidate(
  candidates: ImageCandidate[],
  sourceUrl: URL,
  rawUrl: string | null | undefined,
  options: {
    source: string;
    context?: string;
    score?: number;
    width?: number;
    height?: number;
  },
) {
  if (!rawUrl) {
    return;
  }

  try {
    const url = absoluteUrl(rawUrl, sourceUrl);

    if (!isHttpUrl(url)) {
      return;
    }

    candidates.push({
      url,
      source: options.source,
      context: options.context ?? "",
      score: options.score ?? 0,
      width: options.width,
      height: options.height,
    });
  } catch {
    // Ignore invalid image URLs.
  }
}

function candidatesFromShopify(
  product: ShopifyProduct,
  sourceUrl: URL,
): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];

  const addShopifyImage = (
    image: ShopifyImage | null | undefined,
    source: string,
    score: number,
  ) => {
    const value = imageValue(image);

    if (!value) {
      return;
    }

    addCandidate(
      candidates,
      sourceUrl,
      value.url,
      {
        source,
        context:
          `${product.title ?? ""} ${value.alt}`,
        score,
        width: value.width,
        height: value.height,
      },
    );
  };

  addShopifyImage(
    product.featured_image,
    "shopify-featured",
    32,
  );
  addShopifyImage(
    product.image,
    "shopify-main",
    30,
  );

  for (const image of product.images ?? []) {
    addShopifyImage(
      image,
      "shopify-gallery",
      24,
    );
  }

  for (const media of product.media ?? []) {
    addShopifyImage(
      media.preview_image,
      "shopify-media-preview",
      28,
    );
    addShopifyImage(
      media.image,
      "shopify-media-image",
      26,
    );

    addCandidate(
      candidates,
      sourceUrl,
      media.src,
      {
        source: "shopify-media",
        context: product.title ?? "",
        score: 18,
      },
    );
  }

  for (const variant of product.variants ?? []) {
    addShopifyImage(
      variant.featured_image,
      "shopify-variant",
      14,
    );
  }

  return candidates;
}

function getAttribute(
  tag: string,
  name: string,
): string {
  const expression = new RegExp(
    `${name}\\s*=\\s*["']([^"']+)["']`,
    "i",
  );

  return expression.exec(tag)?.[1] ?? "";
}

function largestSrcsetImage(
  value: string,
): string {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return (
    entries.at(-1)?.split(/\s+/)[0] ?? ""
  );
}

function collectImagesFromJsonLd(
  value: unknown,
  results: string[],
) {
  if (typeof value === "string") {
    if (
      value.startsWith("http") ||
      value.startsWith("//")
    ) {
      results.push(value);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectImagesFromJsonLd(
        item,
        results,
      );
    }

    return;
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return;
  }

  const record = value as Record<
    string,
    unknown
  >;

  for (const [key, nestedValue] of Object.entries(
    record,
  )) {
    if (
      key.toLowerCase() === "image" ||
      key.toLowerCase() === "contenturl" ||
      key.toLowerCase() === "thumbnailurl"
    ) {
      collectImagesFromJsonLd(
        nestedValue,
        results,
      );
    } else if (
      typeof nestedValue === "object" &&
      nestedValue !== null
    ) {
      collectImagesFromJsonLd(
        nestedValue,
        results,
      );
    }
  }
}

function candidatesFromHtml(
  html: string,
  sourceUrl: URL,
): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];

  const metaPatterns = [
    {
      pattern:
        /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
      source: "open-graph",
      score: 25,
    },
    {
      pattern:
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/gi,
      source: "open-graph",
      score: 25,
    },
    {
      pattern:
        /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
      source: "twitter-image",
      score: 22,
    },
    {
      pattern:
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/gi,
      source: "twitter-image",
      score: 22,
    },
  ];

  for (const {
    pattern,
    source,
    score,
  } of metaPatterns) {
    for (const match of html.matchAll(pattern)) {
      addCandidate(
        candidates,
        sourceUrl,
        match[1],
        {
          source,
          score,
        },
      );
    }
  }

  const jsonLdPattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(
    jsonLdPattern,
  )) {
    try {
      const parsed = JSON.parse(
        decodeHtml(match[1].trim()),
      );
      const images: string[] = [];

      collectImagesFromJsonLd(
        parsed,
        images,
      );

      for (const image of images) {
        addCandidate(
          candidates,
          sourceUrl,
          image,
          {
            source: "json-ld",
            score: 27,
          },
        );
      }
    } catch {
      // Ignore broken or dynamically templated JSON-LD.
    }
  }

  for (const match of html.matchAll(
    /<img\b[^>]*>/gi,
  )) {
    const tag = match[0];
    const alt = decodeHtml(
      getAttribute(tag, "alt"),
    );
    const source =
      getAttribute(tag, "data-zoom") ||
      getAttribute(tag, "data-src") ||
      getAttribute(tag, "data-original") ||
      getAttribute(tag, "src") ||
      largestSrcsetImage(
        getAttribute(tag, "srcset"),
      );

    const width = Number(
      getAttribute(tag, "width"),
    );
    const height = Number(
      getAttribute(tag, "height"),
    );

    addCandidate(
      candidates,
      sourceUrl,
      source,
      {
        source: "html-image",
        context: alt,
        score: /filament|spool|pla|petg|bambu/i.test(
          alt,
        )
          ? 30
          : 4,
        width:
          Number.isFinite(width) &&
          width > 0
            ? width
            : undefined,
        height:
          Number.isFinite(height) &&
          height > 0
            ? height
            : undefined,
      },
    );
  }

  return candidates;
}

function bestCandidates(
  candidates: ImageCandidate[],
): ImageCandidate[] {
  const bestByKey = new Map<
    string,
    ImageCandidate
  >();

  for (const candidate of candidates) {
    const scored = {
      ...candidate,
      score: scoreCandidate(candidate),
    };
    const key = candidateKey(scored.url);
    const existing = bestByKey.get(key);

    if (
      !existing ||
      scored.score > existing.score
    ) {
      bestByKey.set(key, scored);
    }
  }

  const filtered = [...bestByKey.values()]
    .filter((candidate) => candidate.score > -25)
    .sort(
      (first, second) =>
        second.score - first.score,
    );

  return filtered.slice(0, 12);
}

async function fetchSource(url: URL) {
  return fetch(url, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      Accept:
        "text/html,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language":
        "de-DE,de;q=0.9,en;q=0.7",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    },
    signal: AbortSignal.timeout(12_000),
  });
}

export async function GET(
  request: NextRequest,
) {
  const rawUrl =
    request.nextUrl.searchParams.get("url") ??
    "";

  if (!isHttpUrl(rawUrl)) {
    return NextResponse.json(
      {
        error:
          "Bitte gib einen gültigen HTTP- oder HTTPS-Produktlink ein.",
      },
      {
        status: 400,
      },
    );
  }

  const sourceUrl = new URL(rawUrl);
  const collected: ImageCandidate[] = [];

  try {
    for (const candidate of productJsonCandidates(
      sourceUrl,
    )) {
      try {
        const response =
          await fetchSource(candidate);

        if (!response.ok) {
          continue;
        }

        const product =
          (await response.json()) as ShopifyProduct;

        collected.push(
          ...candidatesFromShopify(
            product,
            sourceUrl,
          ),
        );
      } catch {
        // Try the next endpoint and then the product page.
      }
    }

    const pageResponse =
      await fetchSource(sourceUrl);

    if (pageResponse.ok) {
      const html = await pageResponse.text();

      collected.push(
        ...candidatesFromHtml(
          html,
          sourceUrl,
        ),
      );
    } else if (collected.length === 0) {
      throw new Error(
        `Produktseite antwortet mit Status ${pageResponse.status}.`,
      );
    }

    const images =
      bestCandidates(collected).map(
        (candidate) => candidate.url,
      );

    if (images.length === 0) {
      return NextResponse.json(
        {
          error:
            "Auf dieser Produktseite wurden keine geeigneten Produktbilder gefunden. Du kannst weiterhin eine direkte Bild-URL eintragen.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      imageUrl: images[0],
      images,
      source: "product-gallery",
    });
  } catch (caughtError) {
    return NextResponse.json(
      {
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Produktbilder konnten nicht geladen werden.",
      },
      {
        status: 502,
      },
    );
  }
}
