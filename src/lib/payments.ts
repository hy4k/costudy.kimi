import { supabase } from '@/lib/supabase';

// Razorpay checkout for session_payments rows. The key ID is public; the secret
// lives only in the payment-order / payment-verify edge functions.
export const RAZORPAY_KEY_ID =
  (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined) || '';

const loadSdk = (): Promise<boolean> =>
  new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

type PaymentRow = { id: string; amount: number | string; label?: string | null };

/**
 * Starts a Razorpay checkout for a PENDING session_payments row.
 * Returns 'paid' | 'dismissed' | 'error:...'.
 */
export async function payNow(row: PaymentRow, payerName: string, payerEmail?: string | null): Promise<string> {
  const loaded = await loadSdk();
  if (!loaded) return 'error:Could not load the payment window — check your connection.';

  const { data, error } = await supabase.functions.invoke('payment-order', {
    body: { payment_id: row.id },
  });
  if (error || !data || data.error) {
    return `error:${data?.error || error?.message || 'Could not start the payment.'}`;
  }

  const RP = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;

  return new Promise<string>((resolve) => {
    const rzp = new RP({
      key: data.key_id || RAZORPAY_KEY_ID,
      order_id: data.order_id,
      amount: data.amount,
      currency: data.currency || 'INR',
      name: 'CoStudy.in',
      description: row.label || data.label || 'Mentor session payment',
      prefill: { name: payerName, email: payerEmail || undefined },
      theme: { color: '#ea4467' },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        const { error: verifyErr } = await supabase.functions.invoke('payment-verify', {
          body: {
            payment_id: row.id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          },
        });
        resolve(verifyErr ? 'error:Payment made but confirmation failed — it will confirm via webhook.' : 'paid');
      },
      modal: { ondismiss: () => resolve('dismissed') },
    });
    rzp.open();
  });
}
