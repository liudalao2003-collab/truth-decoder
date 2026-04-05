import { NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * Stripe Checkout 会话（订阅）。未配置密钥时返回 503，避免静默失败。
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        error: 'Billing not configured',
        code: 'STRIPE_DISABLED',
      },
      { status: 503 }
    );
  }

  let body: { priceId?: string; successUrl?: string; cancelUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const priceId = body.priceId ?? process.env.STRIPE_PRICE_ID_PRO;
  if (!priceId) {
    return NextResponse.json(
      { success: false, error: 'Missing priceId or STRIPE_PRICE_ID_PRO' },
      { status: 400 }
    );
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.successUrl ?? `${base}/?billing=success`,
      cancel_url: body.cancelUrl ?? `${base}/?billing=cancel`,
    });

    return NextResponse.json({
      success: true,
      data: { url: session.url, id: session.id },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Stripe checkout failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
