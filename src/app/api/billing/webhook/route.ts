import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServiceRoleOrThrow } from '@/lib/supabase';
import {
  clearSubscriptionOnProfile,
  resolveUserIdFromSubscription,
  upsertProfileFromStripeSubscription,
} from '@/lib/stripe-profile-sync';

/**
 * Stripe Webhook：验签后同步 public.profiles（订阅状态）。
 * 必须使用 SUPABASE_SERVICE_ROLE_KEY；写库失败或订阅结账缺字段时返回非 2xx，避免「假成功」。
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !whSecret) {
    return new NextResponse('Billing not configured', { status: 503 });
  }

  let admin;
  try {
    admin = getSupabaseServiceRoleOrThrow();
  } catch {
    return NextResponse.json(
      {
        code: 'SERVICE_ROLE_REQUIRED',
        error: 'SUPABASE_SERVICE_ROLE_KEY is required for webhook writes',
      },
      { status: 503 }
    );
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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') {
          return NextResponse.json({
            received: true,
            applied: false,
            type: event.type,
            reason: 'not_subscription_mode',
          });
        }
        const userId =
          session.client_reference_id ??
          session.metadata?.supabase_user_id ??
          undefined;
        const subRef = session.subscription;
        const subId =
          typeof subRef === 'string' ? subRef : subRef?.id ?? undefined;
        if (!userId || !subId) {
          return NextResponse.json(
            {
              code: 'CHECKOUT_MISSING_IDS',
              error: 'Missing client_reference_id or subscription id',
            },
            { status: 500 }
          );
        }
        const customerRaw = session.customer;
        const customerId =
          typeof customerRaw === 'string'
            ? customerRaw
            : customerRaw?.id ?? undefined;
        if (!customerId) {
          return NextResponse.json(
            {
              code: 'CHECKOUT_MISSING_CUSTOMER',
              error: 'Missing Stripe customer on checkout session',
            },
            { status: 500 }
          );
        }
        const subscription = await stripe.subscriptions.retrieve(subId);
        await upsertProfileFromStripeSubscription(admin, {
          userId,
          customerId,
          subscription,
        });
        return NextResponse.json({
          received: true,
          applied: true,
          type: event.type,
        });
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserIdFromSubscription(
          admin,
          subscription
        );
        if (!userId) {
          if (event.type === 'customer.subscription.created') {
            return NextResponse.json(
              {
                code: 'SUBSCRIPTION_USER_UNRESOLVED',
                error:
                  'Could not resolve supabase user from subscription metadata',
              },
              { status: 500 }
            );
          }
          return NextResponse.json({
            received: true,
            applied: false,
            type: event.type,
            reason: 'user_unresolved',
          });
        }
        const customerRaw = subscription.customer;
        const customerId =
          typeof customerRaw === 'string'
            ? customerRaw
            : customerRaw?.id ?? '';
        if (!customerId) {
          return NextResponse.json(
            {
              code: 'SUBSCRIPTION_MISSING_CUSTOMER',
              error: 'Missing customer on subscription',
            },
            { status: 500 }
          );
        }
        await upsertProfileFromStripeSubscription(admin, {
          userId,
          customerId,
          subscription,
        });
        return NextResponse.json({
          received: true,
          applied: true,
          type: event.type,
        });
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserIdFromSubscription(
          admin,
          subscription
        );
        if (userId) {
          await clearSubscriptionOnProfile(admin, userId);
        }
        return NextResponse.json({
          received: true,
          applied: !!userId,
          type: event.type,
        });
      }
      default:
        return NextResponse.json({
          received: true,
          applied: false,
          type: event.type,
        });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Webhook handler error';
    if (process.env.NODE_ENV === 'development') {
      console.log('🔴 [billing_webhook] handler error:', msg);
    }
    return NextResponse.json({ error: msg, code: 'WEBHOOK_HANDLER_ERROR' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
