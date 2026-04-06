import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseServiceRoleOrThrow } from '@/lib/supabase';
import { upsertProfileFromStripeSubscription } from '@/lib/stripe-profile-sync';

export const runtime = 'nodejs';

/**
 * 付款回跳后由前端调用：用 Checkout Session 再写一次 profiles（Webhook 延迟/失败时的兜底）。
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { success: false, code: 'STRIPE_DISABLED' },
      { status: 503 }
    );
  }

  let admin;
  try {
    admin = getSupabaseServiceRoleOrThrow();
  } catch {
    return NextResponse.json(
      { success: false, code: 'SERVICE_ROLE_REQUIRED' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json(
      { success: false, code: 'MISSING_SESSION_ID' },
      { status: 400 }
    );
  }

  const stripe = new Stripe(secret);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'retrieve failed';
    return NextResponse.json(
      { success: false, code: 'STRIPE_RETRIEVE_FAILED', error: msg },
      { status: 400 }
    );
  }

  if (session.mode !== 'subscription') {
    return NextResponse.json(
      { success: false, code: 'NOT_SUBSCRIPTION' },
      { status: 400 }
    );
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json(
      { success: false, code: 'NOT_PAID' },
      { status: 400 }
    );
  }

  const refId =
    session.client_reference_id ?? session.metadata?.supabase_user_id;
  if (!refId || refId !== user.id) {
    return NextResponse.json(
      { success: false, code: 'SESSION_MISMATCH' },
      { status: 403 }
    );
  }

  const subRef = session.subscription;
  const subId =
    typeof subRef === 'string'
      ? subRef
      : subRef && typeof subRef === 'object' && 'id' in subRef
        ? (subRef as Stripe.Subscription).id
        : undefined;

  if (!subId) {
    return NextResponse.json(
      { success: false, code: 'NO_SUBSCRIPTION' },
      { status: 400 }
    );
  }

  const customerRaw = session.customer;
  const customerId =
    typeof customerRaw === 'string'
      ? customerRaw
      : customerRaw && typeof customerRaw === 'object' && 'id' in customerRaw
        ? customerRaw.id
        : undefined;

  if (!customerId) {
    return NextResponse.json(
      { success: false, code: 'NO_CUSTOMER' },
      { status: 400 }
    );
  }

  const subscription = await stripe.subscriptions.retrieve(subId);

  try {
    await upsertProfileFromStripeSubscription(admin, {
      userId: user.id,
      customerId,
      subscription,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'upsert failed';
    return NextResponse.json(
      { success: false, code: 'UPSERT_FAILED', error: msg },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: { applied: true } });
}
