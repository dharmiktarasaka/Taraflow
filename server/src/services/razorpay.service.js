import Razorpay from 'razorpay';
import crypto from 'crypto';
import logger from '../utils/logger.util.js';

class RazorpayService {
  constructor() {
    this.razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
      ? new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET
        })
      : null;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  }

  isActive() {
    return !!this.razorpay;
  }

  /**
   * Create Razorpay Subscription
   */
  async createSubscription(userId, plan) {
    if (!this.razorpay) {
      logger.info(`[RazorpayService] Mocking subscription order for User ${userId} and Plan ${plan}`);
      return {
        id: `mock_sub_${Date.now()}`,
        planId: `mock_plan_${plan}`,
        keyId: 'mock_key_id',
        mock: true
      };
    }

    const planIds = {
      starter: process.env.RAZORPAY_PLAN_STARTER,
      professional: process.env.RAZORPAY_PLAN_PROFESSIONAL,
      agency: process.env.RAZORPAY_PLAN_AGENCY
    };

    const planId = planIds[plan];
    if (!planId) {
      throw new Error(`Invalid plan or missing Razorpay Plan ID for plan: ${plan}`);
    }

    const subscription = await this.razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId,
        plan
      }
    });

    return {
      id: subscription.id,
      planId: subscription.plan_id,
      keyId: process.env.RAZORPAY_KEY_ID
    };
  }

  /**
   * Verify Payment Signature locally
   */
  verifySignature(paymentId, subscriptionId, signature) {
    if (!this.razorpay) {
      return true;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = `${paymentId}|${subscriptionId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Verify Webhook Events
   */
  verifyWebhook(rawBody, signature) {
    if (!this.webhookSecret) return true;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(rawBody))
      .digest('hex');
    return expectedSignature === signature;
  }
}

export const razorpayServiceInstance = new RazorpayService();
export default razorpayServiceInstance;
