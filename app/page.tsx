"use client";
import { useEffect, useState } from "react";
import { CharacterCard, FocusCard, FuelCard } from "@/components/HomeCards";
import { SkillsScreen } from "@/components/SkillsScreen";
import { QuestsScreen } from "@/components/QuestsScreen";
import { ActivityScreen } from "@/components/ActivityScreen";
import { TrainingScreen } from "@/components/TrainingScreen";
import { Card } from "@/components/ui";
import { AccountBox } from "@/components/AccountBox";
import { useGame } from "@/lib/store";
import { startSync, SyncStatus } from "@/lib/supabase";
import { kcalGoal, proteinGoal, waterGoal } from "@/lib/game";

type Tab = "home" | "skills" | "training" | "activity" | "quests";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Персонаж", icon: "◉" },
  { id: "skills", label: "Навички", icon: "⌬" },
  { id: "training", label: "Тренування", icon: "🏋" },
  { id: "activity", label: "Активність", icon: "⚡" },
  { id: "quests", label: "Квести", icon: "☰" },
];

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { profile, setProfile } = useGame();
  const num = (v: string) => Number(v.replace(",", ".")) || 0;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid grid-cols-[minmax(0,1fr)] items-end sm:place-items-center" onClick={onClose}>
      <div className="w-full min-w-0 sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card className="space-y-3 rounded-b-none sm:rounded-b-xl max-h-[88dvh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex justify-between"><b>Профіль</b><button onClick={onClose} className="text-mute">✕</button></div>
          <AccountBox />
          <label className="block text-xs text-mute">Імʼя
            <input value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} className="mt-1 text-sm" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-xs text-mute">Вага, кг
              <input inputMode="decimal" defaultValue={profile.weightKg} onBlur={(e) => setProfile({ weightKg: num(e.target.value) })} className="mt-1 text-sm" />
            </label>
            <label className="block text-xs text-mute">Білок г/кг
              <input inputMode="decimal" defaultValue={profile.proteinPerKg} onBlur={(e) => setProfile({ proteinPerKg: num(e.target.value) })} className="mt-1 text-sm" />
            </label>
            <label className="block text-xs text-mute">Вода мл/кг
              <input inputMode="decimal" defaultValue={profile.waterPerKg} onBlur={(e) => setProfile({ waterPerKg: num(e.target.value) })} className="mt-1 text-sm" />
            </label>
          </div>
          <label className="block text-xs text-mute">Калорії на день (0 — не рахувати)
            <input inputMode="numeric" defaultValue={kcalGoal(profile)} onBlur={(e) => setProfile({ kcalGoal: Math.round(num(e.target.value)) })} className="mt-1 text-sm" />
          </label>
          <div className="text-xs text-mute">
            Ціль: білок <b className="text-ink">{proteinGoal(profile)} г</b> · вода <b className="text-ink">{waterGoal(profile)} мл</b>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [editing, setEditing] = useState(false);
  const [sync, setSync] = useState<SyncStatus>("offline");
  const applyDailyTick = useGame((s) => s.applyDailyTick);

  useEffect(() => {
    setMounted(true);
    applyDailyTick();
    startSync(setSync);
    const onVis = () => document.visibilityState === "visible" && applyDailyTick();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [applyDailyTick]);

  if (!mounted) return <main className="min-h-dvh" />;

  const syncDot = { offline: "#555", syncing: "#facc15", synced: "#4ade80", error: "#ef4444" }[sync];

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="mb-3 flex items-center justify-between text-xs text-mute">
        <span className="tracking-[0.3em]">REAL·LIFE·RPG</span>
        <span className="flex items-center gap-1.5" title={`sync: ${sync}`}>
          <span className="size-2 rounded-full" style={{ background: syncDot }} />
          {sync === "offline" ? "локально" : sync}
        </span>
      </header>

      {tab === "home" && (
        <div className="grid gap-3 md:grid-cols-2 landscape:grid-cols-2">
          <div className="space-y-3">
            <CharacterCard onEdit={() => setEditing(true)} />
          </div>
          <div className="space-y-3">
            <FuelCard />
            <FocusCard onOpenSkills={() => setTab("skills")} />
          </div>
        </div>
      )}
      {tab === "skills" && <SkillsScreen />}
      {tab === "training" && <TrainingScreen />}
      {tab === "activity" && <ActivityScreen />}
      {tab === "quests" && <QuestsScreen />}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-3 text-xs flex flex-col items-center gap-0.5 ${tab === t.id ? "text-ink" : "text-mute"}`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {editing && <ProfileSheet onClose={() => setEditing(false)} />}
    </main>
  );
}
