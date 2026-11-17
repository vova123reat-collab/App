"use client";
import { useMemo, useRef, useState } from "react";
import { Card, Label } from "./ui";
import { useGame } from "@/lib/store";
import { CAT_LABEL, Food, FOODS, proteinDensity, scale } from "@/lib/foods";
import { Nutrition } from "@/lib/game";

type Mode = "base" | "online" | "ai";
type Pick = Nutrition & { id: string; name: string; portion?: number; portionLabel?: string };
type AiItem = Nutrition & { name: string; grams: number; on: boolean };

declare global {
  interface Window {
    BarcodeDetector?: new (o?: { formats: string[] }) => { detect: (src: ImageBitmap) => Promise<{ rawValue: string }[]> };
  }
}

function Macro({ n, big = false }: { n: Nutrition; big?: boolean }) {
  return (
    <div className={`flex gap-3 tabular-nums ${big ? "text-sm" : "text-[11px] text-mute"}`}>
      <span><b className="text-protein">{n.protein}</b>Б</span>
      <span>{n.fat}Ж</span>
      <span>{n.carbs}В</span>
      <span>{n.kcal} ккал</span>
    </div>
  );
}

/** Крок 2: вибір ваги порції. */
function PortionPicker({ food, onBack, onDone }: { food: Pick; onBack: () => void; onDone: () => void }) {
  const addFoods = useGame((s) => s.addFoods);
  const [grams, setGrams] = useState(String(food.portion ?? 100));
  const g = Math.max(0, Number(grams) || 0);
  const n = scale(food, g);
  const presets = Array.from(new Set([food.portion, 50, 100, 150, 200].filter(Boolean) as number[])).slice(0, 5);

  return (
    <div className="space-y-3">
      <button className="text-xs text-mute" onClick={onBack}>← назад</button>
      <div>
        <div className="font-bold">{food.name}</div>
        <div className="text-[11px] text-mute">на 100 г: {food.protein} Б · {food.fat} Ж · {food.carbs} В · {food.kcal} ккал</div>
      </div>
      <div className="flex gap-2 items-center">
        <input inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value.replace(/\D/g, ""))} className="!w-24 text-lg" autoFocus />
        <span className="text-mute">г</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p} className="btn" onClick={() => setGrams(String(p))}>
            {p} г{p === food.portion && food.portionLabel ? ` · ${food.portionLabel}` : ""}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-line p-3"><Macro n={n} big /></div>
      <button
        className="btn btn-primary w-full"
        disabled={g <= 0}
        onClick={() => { addFoods([{ ...n, name: food.name, grams: g }]); onDone(); }}
      >
        + ДОДАТИ {n.protein} г БІЛКА
      </button>
    </div>
  );
}

export function FoodSheet({ onClose }: { onClose: () => void }) {
  const days = useGame((s) => s.days);
  const addFoods = useGame((s) => s.addFoods);
  const [mode, setMode] = useState<Mode>("base");
  const [pick, setPick] = useState<Pick | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Food["cat"] | "all" | "protein">("all");
  const [online, setOnline] = useState<Pick[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiItems, setAiItems] = useState<AiItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2000); };

  // Нещодавні: останні унікальні продукти з журналу — додаються в один тап тією ж порцією.
  const recent = useMemo(() => {
    const all = Object.values(days).flatMap((d) => d.foods ?? []).sort((a, b) => b.at - a.at);
    const seen = new Set<string>();
    return all.filter((f) => !seen.has(f.name) && seen.add(f.name)).slice(0, 8);
  }, [days]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let r = FOODS.filter((f) => !s || f.name.toLowerCase().includes(s));
    if (cat === "protein") r = [...r].sort((a, b) => proteinDensity(b) - proteinDensity(a)).slice(0, 15);
    else if (cat !== "all") r = r.filter((f) => f.cat === cat);
    return r;
  }, [q, cat]);

  const searchOnline = async (params: string) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/food?${params}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setOnline(j.items);
      if (!j.items.length) setErr("Нічого не знайдено");
      if (params.startsWith("barcode") && j.items[0]) setPick(j.items[0]);
    } catch (e) { setErr((e as Error).message || "Помилка"); }
    finally { setBusy(false); }
  };

  const scanPhoto = async (file: File) => {
    if (!window.BarcodeDetector) return setErr("Сканер не підтримується — введи цифри штрихкоду");
    try {
      const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      const codes = await det.detect(await createImageBitmap(file));
      if (!codes[0]) return setErr("Штрихкод не розпізнано, спробуй ближче");
      setQ(codes[0].rawValue);
      searchOnline(`barcode=${codes[0].rawValue}`);
    } catch { setErr("Не вдалося прочитати фото"); }
  };

  const askAi = async () => {
    if (!aiText.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/food", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiText }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setAiItems(j.items.map((x: Omit<AiItem, "on">) => ({ ...x, on: true })));
    } catch (e) { setErr((e as Error).message || "Помилка"); }
    finally { setBusy(false); }
  };

  const aiTotal = aiItems.filter((x) => x.on).reduce(
    (a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein, fat: a.fat + x.fat, carbs: a.carbs + x.carbs }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
  const r1 = (n: Nutrition): Nutrition => ({ kcal: Math.round(n.kcal), protein: Math.round(n.protein * 10) / 10, fat: Math.round(n.fat * 10) / 10, carbs: Math.round(n.carbs * 10) / 10 });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid grid-cols-[minmax(0,1fr)] items-end sm:place-items-center" onClick={onClose}>
      <div className="w-full min-w-0 sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <Card className="rounded-b-none sm:rounded-b-xl max-h-[88dvh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3">
          <div className="flex justify-between items-center">
            <b>Додати їжу</b>
            <button onClick={onClose} className="text-mute">✕</button>
          </div>

          {pick ? (
            <PortionPicker food={pick} onBack={() => setPick(null)} onDone={() => { setPick(null); flash("Додано ✓"); }} />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-line p-1 text-xs">
                {([["base", "База"], ["online", "Онлайн / штрихкод"], ["ai", "✦ ШІ"]] as [Mode, string][]).map(([m, l]) => (
                  <button key={m} onClick={() => { setMode(m); setErr(null); }} className={`rounded-md py-1.5 ${mode === m ? "bg-card-2 text-ink" : "text-mute"}`}>{l}</button>
                ))}
              </div>

              {mode === "base" && (
                <>
                  {recent.length > 0 && !q && (
                    <div>
                      <Label>Нещодавні · один тап</Label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {recent.map((f) => (
                          <button key={f.id} className="btn text-left" onClick={() => {
                            addFoods([{ name: f.name, grams: f.grams, kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs }]);
                            flash(`+${f.protein} г білка`);
                          }}>
                            <div className="text-xs">{f.name.length > 22 ? f.name.slice(0, 22) + "…" : f.name}</div>
                            <div className="text-[10px] text-mute">{f.grams} г · {f.protein} Б</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <input placeholder="пошук: курка, сир, гречка…" value={q} onChange={(e) => setQ(e.target.value)} className="text-sm" />
                  <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
                    {(["all", "protein", ...Object.keys(CAT_LABEL)] as (typeof cat)[]).map((c) => (
                      <button key={c} onClick={() => setCat(c)}
                        className={`shrink-0 rounded-full border px-2.5 py-1 ${cat === c ? "border-ink text-ink" : "border-line text-mute"}`}>
                        {c === "all" ? "Усі" : c === "protein" ? "🔥 Найбільше білка" : CAT_LABEL[c as Food["cat"]]}
                      </button>
                    ))}
                  </div>
                  <ul className="divide-y divide-line">
                    {list.map((f) => (
                      <li key={f.id}>
                        <button className="w-full py-2.5 text-left" onClick={() => setPick(f)}>
                          <div className="flex justify-between gap-2 text-sm">
                            <span>{f.name}</span>
                            <span className="shrink-0 text-protein text-xs">{f.protein} г</span>
                          </div>
                          <Macro n={f} />
                        </button>
                      </li>
                    ))}
                    {list.length === 0 && (
                      <li className="py-3 text-xs text-mute">
                        Немає в базі. <button className="link" onClick={() => { setMode("online"); searchOnline(`q=${encodeURIComponent(q)}`); }}>Шукати онлайн</button>
                      </li>
                    )}
                  </ul>
                  <div className="text-[10px] text-mute">Значення на 100 г, усереднені.</div>
                </>
              )}

              {mode === "online" && (
                <>
                  <div className="flex gap-2">
                    <input placeholder="назва або штрихкод" value={q} onChange={(e) => setQ(e.target.value)} className="text-sm"
                      onKeyDown={(e) => e.key === "Enter" && searchOnline(/^\d{8,14}$/.test(q) ? `barcode=${q}` : `q=${encodeURIComponent(q)}`)} />
                    <button className="btn shrink-0" disabled={busy}
                      onClick={() => searchOnline(/^\d{8,14}$/.test(q) ? `barcode=${q}` : `q=${encodeURIComponent(q)}`)}>
                      {busy ? "…" : "Знайти"}
                    </button>
                  </div>
                  <button className="btn w-full" onClick={() => fileRef.current?.click()}>📷 Сфотографувати штрихкод</button>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                    onChange={(e) => e.target.files?.[0] && scanPhoto(e.target.files[0])} />
                  <ul className="divide-y divide-line">
                    {online.map((f) => (
                      <li key={f.id}>
                        <button className="w-full py-2.5 text-left" onClick={() => setPick(f)}>
                          <div className="flex justify-between gap-2 text-sm"><span>{f.name}</span><span className="shrink-0 text-protein text-xs">{f.protein} г</span></div>
                          <Macro n={f} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="text-[10px] text-mute">Дані: Open Food Facts (відкрита база магазинних продуктів).</div>
                </>
              )}

              {mode === "ai" && (
                <>
                  <textarea rows={3} className="text-sm" value={aiText} onChange={(e) => setAiText(e.target.value)}
                    placeholder="напр.: 3 яйця, 200 г гречки, куряче філе з долоню і склянка кефіру" />
                  <button className="btn btn-primary w-full" onClick={askAi} disabled={busy}>{busy ? "ШІ рахує…" : "✦ ПОРАХУВАТИ"}</button>
                  {aiItems.length > 0 && (
                    <>
                      <ul className="divide-y divide-line">
                        {aiItems.map((x, i) => (
                          <li key={i} className="flex items-start gap-2 py-2">
                            <input type="checkbox" checked={x.on} className="!w-4 !p-0 mt-1 accent-[#4ade80]"
                              onChange={() => setAiItems(aiItems.map((y, j) => (j === i ? { ...y, on: !y.on } : y)))} />
                            <div className="flex-1">
                              <div className="text-sm">{x.name} · {x.grams} г</div>
                              <Macro n={r1(x)} />
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="rounded-lg border border-line p-3"><Macro n={r1(aiTotal)} big /></div>
                      <button className="btn btn-primary w-full" onClick={() => {
                        addFoods(aiItems.filter((x) => x.on).map(({ name, grams, ...n }) => ({ name, grams, ...r1(n) })));
                        setAiItems([]); setAiText(""); flash("Додано ✓");
                      }}>+ ДОДАТИ ВСЕ</button>
                      <div className="text-[10px] text-mute">Оцінка ШІ приблизна — перевір вагу порцій.</div>
                    </>
                  )}
                </>
              )}

              {err && <div className="text-xs text-hp">{err}</div>}
            </>
          )}
          {toast && <div className="text-xs text-xp">{toast}</div>}
        </Card>
      </div>
    </div>
  );
}
