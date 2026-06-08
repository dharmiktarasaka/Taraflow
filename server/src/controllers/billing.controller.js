import stripeService from '../services/stripe.service.js';
import razorpayService from '../services/razorpay.service.js';
import User from '../models/user.model.js';
import Invoice from '../models/invoice.model.js';
import { BadRequestError } from '../utils/errors.util.js';
import logger from '../utils/logger.util.js';

class BillingController {
  /**
   * Initialize a new checkout session (Stripe or Razorpay)
   */
  async checkoutSession(req, res, next) {
    try {
      const { plan, gateway } = req.body;
      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user) {
        throw new BadRequestError('User not found');
      }

      const validPlans = ['starter', 'professional', 'agency'];
      if (!validPlans.includes(plan)) {
        throw new BadRequestError('Invalid plan selected');
      }

      const successUrl = `${req.headers.origin}/billing`;
      const cancelUrl = `${req.headers.origin}/billing`;

      if (gateway === 'stripe') {
        const session = await stripeService.createCheckoutSession(
          userId,
          user.email,
          plan,
          successUrl,
          cancelUrl
        );
        return res.status(200).json({
          success: true,
          gateway: 'stripe',
          sessionId: session.id,
          checkoutUrl: session.url
        });
      } else if (gateway === 'razorpay') {
        const subscription = await razorpayService.createSubscription(userId, plan);
        return res.status(200).json({
          success: true,
          gateway: 'razorpay',
          subscriptionId: subscription.id,
          planId: subscription.planId,
          keyId: subscription.keyId,
          amount: plan === 'starter' ? 2900 : plan === 'professional' ? 7900 : 24900, // in paise
          currency: 'INR',
          name: 'Taraflow AI',
          description: `${plan.toUpperCase()} Subscription Plan`,
          email: user.email,
          mock: subscription.mock || false
        });
      } else {
        throw new BadRequestError('Invalid payment gateway selected');
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify Razorpay Local cryptographic payment signature
   */
  async verifyRazorpayPayment(req, res, next) {
    try {
      const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan } = req.body;
      const userId = req.user.id;

      const isValid = razorpayService.verifySignature(
        razorpay_payment_id,
        razorpay_subscription_id,
        razorpay_signature
      );

      if (!isValid) {
        throw new BadRequestError('Invalid Razorpay signature. Verification failed.');
      }

      // Update user subscription state
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

      await User.findByIdAndUpdate(userId, {
        $set: {
          subscription: {
            plan,
            status: 'active',
            gateway: 'razorpay',
            subscriptionId: razorpay_subscription_id,
            currentPeriodEnd
          }
        }
      });

      // Log Paid Invoice
      const amount = plan === 'starter' ? 29 : plan === 'professional' ? 79 : 249;
      await Invoice.create({
        invoiceId: `INV-RZP-${Date.now()}`,
        userId,
        amount,
        currency: 'inr',
        status: 'paid',
        gateway: 'razorpay'
      });

      res.status(200).json({
        success: true,
        message: 'Subscription active!'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify mock checkout for sandbox demo flows
   */
  async verifyMockCheckout(req, res, next) {
    try {
      const { sessionId, plan } = req.body;
      const userId = req.user.id;

      if (!sessionId.startsWith('mock_')) {
        throw new BadRequestError('Invalid mock session token');
      }

      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

      await User.findByIdAndUpdate(userId, {
        $set: {
          subscription: {
            plan,
            status: 'active',
            gateway: 'stripe',
            subscriptionId: sessionId,
            currentPeriodEnd
          }
        }
      });

      // Log mock invoice
      const amount = plan === 'starter' ? 29 : plan === 'professional' ? 79 : 249;
      await Invoice.create({
        invoiceId: `INV-MCK-${Date.now().toString().substring(6)}`,
        userId,
        amount,
        currency: 'usd',
        status: 'paid',
        gateway: 'stripe'
      });

      res.status(200).json({
        success: true,
        message: 'Mock subscription updated successfully!'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve invoice payment histories
   */
  async getInvoices(req, res, next) {
    try {
      const userId = req.user.id;
      const invoices = await Invoice.find({ userId }).sort({ date: -1 });
      res.status(200).json(invoices);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Stripe webhooks receiver
   */
  async stripeWebhook(req, res, next) {
    let event = req.body;

    // Verify webhook signature if secret key is present
    if (stripeService.isActive() && req.headers['stripe-signature']) {
      try {
        const sig = req.headers['stripe-signature'];
        event = stripeService.verifyWebhook(req.rawBody, sig);
      } catch (err) {
        logger.error(`[BillingController] Stripe Webhook verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    }

    try {
      switch (event.type) {
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const status = subscription.status; // e.g. active, trialing, past_due, canceled
          const subId = subscription.id;
          const planPriceId = subscription.items.data[0]?.price.id;

          // Map Stripe price IDs back to plans
          let planName = 'starter';
          if (planPriceId === process.env.STRIPE_PRICE_PROFESSIONAL) planName = 'professional';
          if (planPriceId === process.env.STRIPE_PRICE_AGENCY) planName = 'agency';

          const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

          await User.findOneAndUpdate(
            { 'subscription.subscriptionId': subId },
            {
              $set: {
                'subscription.status': status,
                'subscription.plan': planName,
                'subscription.currentPeriodEnd': currentPeriodEnd
              }
            }
          );
          logger.info(`[BillingController] Updated sub status for Stripe ID ${subId} to ${status}`);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const subId = subscription.id;

          await User.findOneAndUpdate(
            { 'subscription.subscriptionId': subId },
            {
              $set: {
                'subscription.status': 'canceled',
                'subscription.plan': 'free'
              }
            }
          );
          logger.info(`[BillingController] Subscription ${subId} canceled via Stripe webhook.`);
          break;
        }

        case 'invoice.payment_succeeded': {
          const stripeInvoice = event.data.object;
          const subId = stripeInvoice.subscription;
          const amount = stripeInvoice.amount_paid / 100;
          const currency = stripeInvoice.currency;
          const receipt = stripeInvoice.receipt_url || stripeInvoice.hosted_invoice_url;

          const user = await User.findOne({ 'subscription.subscriptionId': subId });
          if (user) {
            await Invoice.create({
              invoiceId: `INV-STR-${stripeInvoice.id.substring(3, 11)}`,
              userId: user._id,
              amount,
              currency,
              status: 'paid',
              gateway: 'stripe',
              receiptUrl: receipt
            });
            logger.info(`[BillingController] Logged paid Stripe invoice for User ${user._id}`);
          }
          break;
        }

        default:
          logger.info(`[BillingController] Unhandled Stripe event: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Razorpay webhooks receiver
   */
  async razorpayWebhook(req, res, next) {
    const signature = req.headers['x-razorpay-signature'];
    const event = req.body;

    const isValid = razorpayService.verifyWebhook(event, signature);
    if (!isValid) {
      logger.error('[BillingController] Razorpay Webhook signature verification failed');
      return res.status(400).send('Invalid signature');
    }

    try {
      const payload = event.payload;
      const eventName = event.event;

      switch (eventName) {
        case 'subscription.charged': {
          const sub = payload.subscription.entity;
          const subId = sub.id;
          const payment = payload.payment.entity;
          const amount = payment.amount / 100;

          // Find user by subscription ID
          const user = await User.findOne({ 'subscription.subscriptionId': subId });
          if (user) {
            const currentPeriodEnd = new Date(sub.current_end * 1000);
            await User.updateOne(
              { _id: user._id },
              {
                $set: {
                  'subscription.status': 'active',
                  'subscription.currentPeriodEnd': currentPeriodEnd
                }
              }
            );

            await Invoice.create({
              invoiceId: `INV-RZP-${payment.id}`,
              userId: user._id,
              amount,
              currency: 'inr',
              status: 'paid',
              gateway: 'razorpay'
            });
            logger.info(`[BillingController] Logged Razorpay invoice payment for User ${user._id}`);
          }
          break;
        }

        case 'subscription.cancelled': {
          const sub = payload.subscription.entity;
          const subId = sub.id;
          await User.findOneAndUpdate(
            { 'subscription.subscriptionId': subId },
            {
              $set: {
                'subscription.status': 'canceled',
                'subscription.plan': 'free'
              }
            }
          );
          logger.info(`[BillingController] Razorpay subscription ${subId} cancelled via webhook.`);
          break;
        }
        
        default:
          logger.info(`[BillingController] Unhandled Razorpay event: ${eventName}`);
      }

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  }
}

export const billingControllerInstance = new BillingController();
export default billingControllerInstance;
