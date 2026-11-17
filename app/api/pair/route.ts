import { NextResponse } from "next/server";
import { adminClient, normalizeCode, randomCode } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const TTL_MIN = 10;

/**
 * POST { action: "create" } + Authorization: Bearer <access token>
 *   → { code, expiresAt } — одноразовий код для входу на іншому пристрої.
 * POST { action: "redeem", code }
 *   → { token_hash } — клієнт обмінює його на сесію через verifyOtp({ type: "magiclink" }).
 */
export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Сервер не налаштовано (SUPABASE_SERVICE_ROLE_KEY)" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; code?: string };

  if (body.action === "create") {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
    const { data, error } = await admin.auth.getUser(token);
    const user = data.user;
    if (error || !user) return NextResponse.json({ error: "Сесія недійсна — перезайди" }, { status: 401 });
    if (user.is_anonymous || !user.email) {
      return NextResponse.json({ error: "Спершу прив'яжи email до цього пристрою" }, { status: 400 });
    }

    await admin.from("pair_codes").delete().eq("user_id", user.id);
    await admin.from("pair_codes").delete().lt("expires_at", new Date().toISOString());
    const code = randomCode();
    const expiresAt = new Date(Date.now() + TTL_MIN * 60_000).toISOString();
    const ins = await admin.from("pair_codes").insert({ code, user_id: user.id, expires_at: expiresAt });
    if (ins.error) {
      console.error("[pair:create]", ins.error);
      return NextResponse.json({ error: "Не вдалося створити код" }, { status: 500 });
    }
    return NextResponse.json({ code, expiresAt });
  }

  if (body.action === "redeem") {
    const code = normalizeCode(body.code ?? "");
    if (code.length !== 8) return NextResponse.json({ error: "Код має 8 символів" }, { status: 400 });

    // Одноразовий: видаляємо одразу при читанні.
    const { data: row } = await admin.from("pair_codes").delete().eq("code", code).select("user_id, expires_at").maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Код невірний або застарів — створи новий" }, { status: 400 });
    }

    const { data: u } = await admin.auth.admin.getUserById(row.user_id);
    const email = u.user?.email;
    if (!email) return NextResponse.json({ error: "Акаунт не знайдено" }, { status: 404 });

    // generateLink не надсилає лист — лише повертає токен, який клієнт одразу обмінює на сесію.
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !link.properties?.hashed_token) {
      console.error("[pair:redeem]", error);
      return NextResponse.json({ error: "Не вдалося увійти" }, { status: 500 });
    }
    return NextResponse.json({ token_hash: link.properties.hashed_token });
  }

  return NextResponse.json({ error: "Невідома дія" }, { status: 400 });
}
