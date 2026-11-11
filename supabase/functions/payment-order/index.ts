import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return json({ error: "missing auth" }, 401);

  const { payment_id } = await req.json().catch(() => ({}));
  if (!payment_id) return json({ error: "payment_id required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return json({ error: "invalid token" }, 401);

  const { data: row } = await supabase
    .from("session_payments")
    .select("id, amount, status, user_id, label")
    .eq("id", payment_id)
    .maybeSingle();
  if (!row) return json({ error: "payment not found" }, 404);
  if (row.user_id !== userData.user.id) return json({ error: "forbidden" }, 403);
  if (row.status === "PAID") return json({ error: "already paid" }, 409);

  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    return json({ error: "payments not configured: add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET edge-function secrets" }, 500);
  }

  const orderResp = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
    },
    body: JSON.stringify({
      amount: Math.round(Number(row.amount) * 100),
      currency: "INR",
      receipt: `sp_${row.id}`,
    }),
  });
  const order = await orderResp.json();
  if (!orderResp.ok) {
    return json({ error: order?.error?.description || "razorpay order failed" }, 502);
  }

  await supabase.from("session_payments").update({ order_id: order.id }).eq("id", row.id);

  return json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: keyId,
    label: row.label || "CoStudy payment",
  });
});
