import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const { payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    await req.json().catch(() => ({}));
  if (!payment_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: "payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature required" }, 400);
  }

  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keySecret) return json({ error: "payments not configured" }, 500);

  const expected = await hmacSha256Hex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
  if (expected !== razorpay_signature) return json({ error: "bad signature" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("session_payments")
    .update({
      status: "PAID",
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      paid_at: new Date().toISOString(),
    })
    .eq("id", payment_id)
    .eq("order_id", razorpay_order_id);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
