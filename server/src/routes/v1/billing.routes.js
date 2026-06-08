import { Router } from 'express';
import { billingControllerInstance } from '../../controllers/billing.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

// Public Webhook endpoints (no authentication required)
router.post('/webhooks/stripe', billingControllerInstance.stripeWebhook);
router.post('/webhooks/razorpay', billingControllerInstance.razorpayWebhook);

// Protected routes
router.use(requireAuth);
router.post('/checkout', billingControllerInstance.checkoutSession);
router.post('/verify-razorpay', billingControllerInstance.verifyRazorpayPayment);
router.post('/verify-mock-checkout', billingControllerInstance.verifyMockCheckout);
router.get('/invoices', billingControllerInstance.getInvoices);

export default router;
