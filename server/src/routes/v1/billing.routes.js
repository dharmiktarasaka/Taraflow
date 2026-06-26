import { Router } from 'express';
import { billingControllerInstance } from '../../controllers/billing.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireWorkspaceMember } from '../../middlewares/workspace.middleware.js';

const router = Router();

// Public Webhook endpoints (no authentication required)
router.post('/webhooks/stripe', billingControllerInstance.stripeWebhook);
router.post('/webhooks/razorpay', billingControllerInstance.razorpayWebhook);

// Protected routes
router.use(requireAuth);
router.post('/checkout', requireWorkspaceMember('Billing'), billingControllerInstance.checkoutSession);
router.post('/verify-stripe', requireWorkspaceMember('Billing'), billingControllerInstance.verifyStripePayment);
router.post('/verify-upi', requireWorkspaceMember('Billing'), billingControllerInstance.submitUPIPayment);
router.post('/verify-razorpay', requireWorkspaceMember('Billing'), billingControllerInstance.verifyRazorpayPayment);
router.post('/verify-mock-checkout', requireWorkspaceMember('Billing'), billingControllerInstance.verifyMockCheckout);
router.get('/invoices', requireWorkspaceMember('Billing'), billingControllerInstance.getInvoices);

export default router;
