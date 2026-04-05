import { NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * Stripe Webhook：验签后记录事件（可扩展为写库开通 Pro）。
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !whSecret) {
    return new NextResponse('Billing not configured', { status: 503 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return new NextResponse('Missing stripe-signature', { status: 400 });
  }

  const stripe = new Stripe(secret);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Webhook signature failed';
    return new NextResponse(msg, { status: 400 });
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('🟢 [billing_webhook] type:', event.type);
  }

  return NextResponse.json({ received: true, type: event.type });
}

export const runtime = 'nodejs';
