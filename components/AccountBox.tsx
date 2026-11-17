"use client";
import { useEffect, useState } from "react";
import { Label } from "./ui";
import { Account, CodeMode, onAccount, refreshAccount, requestCode, signOut, supabase, verifyCode } from "@/lib/supabase";

export function AccountBox() {
  const [acc, setAcc] = useState<Account | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<CodeMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
          <div className="text-[11px] text-mute">Прогрес синхронізується між усіма пристроями з цим email.</div>
          <button className="btn text-xs" disabled={busy}
            onClick={() => confirm("Вийти? Прогрес лишиться в акаунті, а цей пристрій очиститься.") && run(signOut)}>
            Вийти
          </button>
        </>
      ) : (
        <>
          <div className="text-[11px] text-mute">
            Зараз прогрес живе лише на цьому пристрої. Прив&apos;яжи email — і зможеш увійти з будь-якого телефона.
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
