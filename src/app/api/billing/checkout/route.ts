import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

/**
 * Stripe Checkout 会话（订阅）。须已登录；metadata 绑定 Supabase 用户供 Webhook 同步。
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
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

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    const profile = profileRow as { stripe_customer_id: string | null } | null;
    const existingCustomerId = profile?.stripe_customer_id ?? undefined;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        body.successUrl ??
        `${base}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        body.cancelUrl ?? `${base}/?billing=cancel&session_id={CHECKOUT_SESSION_ID}`,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : user.email
          ? { customer_email: user.email }
          : {}),
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
