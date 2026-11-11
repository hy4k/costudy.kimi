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

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!webhookSecret) return json({ error: "webhook not configured" }, 500);

  const rawBody = await req.text();
  const signature = req.headers.get("X-Razorpay-Signature") || "";
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  if (signature !== expected) return json({ error: "bad signature" }, 400);

  const event = JSON.parse(rawBody);
  if (event.event !== "payment.captured") return json({ ok: true, ignored: event.event });

  const payment = event.payload?.payment?.entity;
  const orderId = payment?.order_id;
  if (!orderId) return json({ ok: true, ignored: "no order id" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("session_payments")
    .update({
      status: "PAID",
      payment_id: payment.id,
      order_id: orderId,
      paid_at: new Date().toISOString(),
    })
    .eq("order_id", orderId);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
