import { Type } from "@google/genai";
import { NextResponse } from "next/server";
import { generateJson } from "@/lib/gemini";

export const runtime = "nodejs";

// Open Food Facts — відкрита база продуктів зі штрихкодами (без ключа).
const OFF = "https://world.openfoodfacts.org";
const UA = { "User-Agent": "RealLifeRPG/0.1 (personal nutrition tracker)" };

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_uk?: string;
  brands?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};

function mapOff(p: OffProduct) {
  const n = p.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]) || Math.round(num(n["energy_100g"]) / 4.184);
  const name = (p.product_name_uk || p.product_name || "").trim();
  if (!name) return null;
  return {
    id: `off-${p.code}`,
    name: p.brands ? `${name} · ${p.brands.split(",")[0].trim()}` : name,
    kcal,
    protein: num(n["proteins_100g"]),
    fat: num(n["fat_100g"]),
    carbs: num(n["carbohydrates_100g"]),
    portion: num(p.serving_quantity) || undefined,
    source: "off" as const,
  };
}

const FIELDS = "code,product_name,product_name_uk,brands,nutriments,serving_quantity";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const barcode = url.searchParams.get("barcode")?.replace(/\D/g, "");
  const q = url.searchParams.get("q")?.trim();
  const signal = AbortSignal.timeout(8000);

  try {
    if (barcode) {
      const r = await fetch(`${OFF}/api/v2/product/${barcode}.json?fields=${FIELDS}`, { headers: UA, signal });
      const j = (await r.json()) as { status: number; product?: OffProduct };
      const item = j.status === 1 && j.product ? mapOff({ ...j.product, code: barcode }) : null;
      if (!item) return NextResponse.json({ error: "Продукт зі штрихкодом не знайдено" }, { status: 404 });
      return NextResponse.json({ items: [item] });
    }
    if (q && q.length >= 2) {
      const params = new URLSearchParams({
        search_terms: q, search_simple: "1", action: "process", json: "1", page_size: "20", fields: FIELDS,
      });
      const r = await fetch(`${OFF}/cgi/search.pl?${params}`, { headers: UA, signal, next: { revalidate: 86400 } });
      const j = (await r.json()) as { products?: OffProduct[] };
      const items = (j.products ?? []).map(mapOff).filter((x) => x && x.kcal > 0).slice(0, 15);
      return NextResponse.json({ items });
    }
    return NextResponse.json({ items: [] });
  } catch (e) {
    console.error("[food:get]", e);
    return NextResponse.json({ error: "База продуктів не відповідає" }, { status: 502 });
  }
}

const mealSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          grams: { type: Type.NUMBER },
          kcal: { type: Type.NUMBER, description: "на всю порцію" },
          protein: { type: Type.NUMBER, description: "г на всю порцію" },
          fat: { type: Type.NUMBER, description: "г на всю порцію" },
          carbs: { type: Type.NUMBER, description: "г на всю порцію" },
        },
        required: ["name", "grams", "kcal", "protein", "fat", "carbs"],
      },
    },
  },
  required: ["items"],
};

/** ШІ: «2 яйця, 150 г гречки і курка» → список продуктів з КБЖВ. */
export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const meal = (text ?? "").trim().slice(0, 500);
  if (!meal) return NextResponse.json({ error: "Опиши, що з'їв" }, { status: 400 });

  const prompt = `Ти — нутриціолог. Користувач описав прийом їжі: «${meal}».
Розбий на окремі продукти. Якщо вага не вказана — оціни типову порцію в Україні.
Для кожного продукту дай назву українською, вагу в грамах і калорії/білки/жири/вуглеводи НА ВСЮ ПОРЦІЮ.
Використовуй усереднені довідкові значення (USDA / таблиці калорійності), числа округлюй до 1 знака.`;

  try {
    const data = await generateJson<{ items: { name: string; grams: number; kcal: number; protein: number; fat: number; carbs: number }[] }>(
      prompt, mealSchema, 0.2,
    );
    return NextResponse.json({ items: (data.items ?? []).slice(0, 12) });
  } catch (e) {
    console.error("[food:ai]", e);
    return NextResponse.json({ error: "ШІ не відповів. Спробуй ще раз." }, { status: 502 });
  }
}
