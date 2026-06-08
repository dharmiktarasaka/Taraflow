import Stripe from 'stripe';
import logger from '../utils/logger.util.js';

class StripeService {
  constructor() {
    this.stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  isActive() {
    return !!this.stripe;
  }

  /**
   * Create Checkout Session
   */
  async createCheckoutSession(userId, email, plan, successUrl, cancelUrl) {
    if (!this.stripe) {
      logger.info(`[StripeService] Mocking checkout session for User ${userId} and Plan ${plan}`);
      const mockSessionId = `mock_session_${Date.now()}`;
      return {
        id: mockSessionId,
        url: `${successUrl}?session_id=${mockSessionId}&mock=true&plan=${plan}`
      };
    }

    const planPriceIds = {
      starter: process.env.STRIPE_PRICE_STARTER,
      professional: process.env.STRIPE_PRICE_PROFESSIONAL,
      agency: process.env.STRIPE_PRICE_AGENCY
    };

    const priceId = planPriceIds[plan];
    if (!priceId) {
      throw new Error(`Invalid plan or missing Stripe Price ID for plan: ${plan}`);
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl,
      customer_email: email,
      metadata: {
        userId,
        plan
      }
    });

    return {
      id: session.id,
      url: session.url
    };
  }

  /**
   * Retrieve Checkout Session details
   */
  async retrieveSession(sessionId) {
    if (!this.stripe || sessionId.startsWith('mock_')) {
      return {
        metadata: {
          userId: 'mock',
          plan: 'professional'
        },
        customer: 'mock_customer_id',
        subscription: 'mock_sub_id'
      };
    }
    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

  /**
   * Verify Stripe Webhook Events
   */
  verifyWebhook(rawBody, signature) {
    if (!this.stripe || !this.webhookSecret) {
      return null;
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }
}

export const stripeServiceInstance = new StripeService();
export default stripeServiceInstance;
