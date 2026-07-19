import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShopifyProduct = {
  featured_image?: string | null;
  image?: {
    src?: string | null;
  } | null;
  images?: Array<
    | string
    | {
        src?: string | null;
      }
  >;
};

function absoluteUrl(
  value: string,
  sourceUrl: URL,
): string {
  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  return new URL(value, sourceUrl).toString();
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

function imageFromShopifyProduct(
  product: ShopifyProduct,
  sourceUrl: URL,
): string | null {
  const candidates = [
    product.featured_image,
    product.image?.src,
    ...(product.images ?? []).map((image) =>
      typeof image === "string"
        ? image
        : image.src,
    ),
  ];

  const image = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" &&
      candidate.trim().length > 0,
  );

  return image
    ? absoluteUrl(image, sourceUrl)
    : null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function imageFromHtml(
  html: string,
  sourceUrl: URL,
): string | null {
  const metaPatterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return absoluteUrl(
        decodeHtml(match[1]),
        sourceUrl,
      );
    }
  }

  const jsonImageMatch = html.match(
    /"image"\s*:\s*(?:"([^"]+)"|\[\s*"([^"]+)")/i,
  );
  const jsonImage =
    jsonImageMatch?.[1] ??
    jsonImageMatch?.[2];

  if (jsonImage) {
    return absoluteUrl(
      decodeHtml(
        jsonImage.replace(/\\\//g, "/"),
      ),
      sourceUrl,
    );
  }

  return null;
}

async function fetchSource(url: URL) {
  return fetch(url, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      Accept:
        "text/html,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.7",
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
        const imageUrl =
          imageFromShopifyProduct(
            product,
            sourceUrl,
          );

        if (imageUrl) {
          return NextResponse.json({
            imageUrl,
            source: "shopify-product",
          });
        }
      } catch {
        // Try the next candidate or HTML metadata.
      }
    }

    const pageResponse =
      await fetchSource(sourceUrl);

    if (!pageResponse.ok) {
      throw new Error(
        `Produktseite antwortet mit Status ${pageResponse.status}.`,
      );
    }

    const html = await pageResponse.text();
    const imageUrl = imageFromHtml(
      html,
      sourceUrl,
    );

    if (!imageUrl) {
      return NextResponse.json(
        {
          error:
            "Auf dieser Produktseite wurde kein geeignetes Vorschaubild gefunden. Du kannst die direkte Bild-URL manuell eintragen.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      imageUrl,
      source: "page-metadata",
    });
  } catch (caughtError) {
    return NextResponse.json(
      {
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Produktbild konnte nicht geladen werden.",
      },
      {
        status: 502,
      },
    );
  }
}
