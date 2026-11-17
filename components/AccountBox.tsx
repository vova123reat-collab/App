"use client";
import { useEffect, useState } from "react";
import { Label } from "./ui";
import {
  Account, CodeMode, createPairCode, onAccount, redeemPairCode, refreshAccount, requestCode, signOut, supabase, verifyCode,
} from "@/lib/supabase";

/** Показує одноразовий код для входу на іншому пристрої з таймером. */
function PairCodeView({ code, expiresAt, onDone }: { code: string; expiresAt: string; onDone: () => void }) {
  const [left, setLeft] = useState(() => new Date(expiresAt).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const l = new Date(expiresAt).getTime() - Date.now();
      setLeft(l);
      if (l <= 0) onDone();
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onDone]);
  const s = Math.max(0, Math.floor(left / 1000));
  return (
    <div className="rounded-md border border-xp/40 bg-xp/5 p-3 text-center">
      <div className="text-[11px] text-mute">На іншому пристрої: Профіль → «Ввести код»</div>
      <div className="my-1 text-2xl font-bold tracking-[0.25em] tabular-nums select-all">{code.slice(0, 4)}-{code.slice(4)}</div>
      <div className="text-[11px] text-mute">діє ще {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} · один раз</div>
    </div>
  );
}

export function AccountBox() {
  const [acc, setAcc] = useState<Account | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<CodeMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pair, setPair] = useState<{ code: string; expiresAt: string } | null>(null);
  const [pairInput, setPairInput] = useState("");

  useEffect(() => onAccount(setAcc), []);

  // Поки чекаємо підтвердження прив'язки — перевіряємо сервер кожні 4 с
  // (користувач міг натиснути посилання в листі в іншому браузері).
  useEffect(() => {
    if (mode !== "link") return;
    const t = setInterval(async () => {
      const a = await refreshAccount();
      if (a?.email) {
        setMode(null); setCode("");
        setMsg({ ok: true, text: "Email прив'язано — прогрес збережено ✓" });
      }
    }, 4000);
    return () => clearInterval(t);
  }, [mode]);

  if (!supabase) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const send = () => run(async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) throw new Error("Невірний email");
    const m = await requestCode(e);
    setMode(m);
    setMsg({
      ok: true,
      text: m === "link"
        ? `Лист надіслано на ${e} (перевір «Спам»). Натисни кнопку в листі — тут підхопиться само за кілька секунд.`
        : `Лист надіслано на ${e} (перевір «Спам»). На iPhone у програмі з головного екрана: НЕ натискай, а затисни кнопку → «Скопіювати посилання» і встав сюди.`,
    });
  });

  const verify = () => run(async () => {
    await verifyCode(email.trim().toLowerCase(), code, mode!);
    setMsg({ ok: true, text: mode === "login" ? "Увійшов — прогрес завантажено ✓" : "Email прив'язано — прогрес збережено ✓" });
    setMode(null); setCode("");
  });

  return (
    <div className="rounded-lg border border-line p-3 space-y-2">
      <Label>Акаунт</Label>

      {acc?.email ? (
        <>
          <div className="text-sm">✓ {acc.email}</div>
          <div className="text-[11px] text-mute">Прогрес синхронізується між усіма пристроями з цим акаунтом.</div>
          {pair ? (
            <PairCodeView code={pair.code} expiresAt={pair.expiresAt} onDone={() => setPair(null)} />
          ) : (
            <button className="btn btn-primary w-full text-xs" disabled={busy}
              onClick={() => run(async () => setPair(await createPairCode()))}>
              📱 ПІДКЛЮЧИТИ ІНШИЙ ПРИСТРІЙ
            </button>
          )}
          <button className="btn text-xs" disabled={busy}
            onClick={() => confirm("Вийти? Прогрес лишиться в акаунті, а цей пристрій очиститься.") && run(signOut)}>
            Вийти
          </button>
        </>
      ) : (
        <>
          <div className="rounded-md border border-line p-2 space-y-2">
            <div className="text-xs"><b>Вже є акаунт</b> на іншому пристрої? Введи код підключення:</div>
            <div className="flex gap-2">
              <input placeholder="ABCD-EFGH" value={pairInput} autoCapitalize="characters" autoComplete="off"
                onChange={(e) => setPairInput(e.target.value.toUpperCase())} className="text-base tracking-widest" />
              <button className="btn btn-primary shrink-0" disabled={busy || pairInput.replace(/[^0-9A-Z]/g, "").length !== 8}
                onClick={() => run(async () => {
                  await redeemPairCode(pairInput);
                  setPairInput("");
                  setMsg({ ok: true, text: "Увійшов — прогрес завантажено ✓" });
                })}>
                {busy ? "…" : "Увійти"}
              </button>
            </div>
            <div className="text-[10px] text-mute">Код: на пристрої з акаунтом → Профіль → «Підключити інший пристрій».</div>
          </div>
          <div className="text-[11px] text-mute">
            Новий акаунт: прив&apos;яжи email — прогрес цього пристрою збережеться.
          </div>
          {!mode ? (
            <div className="flex gap-2">
              <input type="email" inputMode="email" autoComplete="email" placeholder="ти@gmail.com" value={email}
                onChange={(e) => setEmail(e.target.value)} className="text-sm" />
              <button className="btn btn-primary shrink-0" onClick={send} disabled={busy}>{busy ? "…" : "Надіслати"}</button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input autoComplete="one-time-code" placeholder="посилання або код з листа" value={code} autoFocus
                  onChange={(e) => setCode(e.target.value.trim())} className="text-sm" />
                <button className="btn btn-primary shrink-0" onClick={verify} disabled={busy || code.length < 6}>{busy ? "…" : "OK"}</button>
              </div>
              <button className="btn w-full text-xs" onClick={async () => {
                try { setCode((await navigator.clipboard.readText()).trim()); } catch { setMsg({ ok: false, text: "Встав вручну: довге натискання → Вставити" }); }
              }}>📋 Вставити з буфера</button>
              <button className="text-[11px] text-mute underline" onClick={() => { setMode(null); setCode(""); setMsg(null); }}>
                інший email / надіслати ще раз
              </button>
            </>
          )}
        </>
      )}
      {msg && <div className={`text-[11px] ${msg.ok ? "text-xp" : "text-hp"}`}>{msg.text}</div>}
    </div>
  );
}
