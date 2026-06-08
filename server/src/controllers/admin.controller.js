import User from '../models/user.model.js';
import Invoice from '../models/invoice.model.js';
import AIUsage from '../models/aiUsage.model.js';
import AuditLog from '../models/auditLog.model.js';
import Post from '../models/post.model.js';
import SocialAccount from '../models/socialAccount.model.js';
import { BadRequestError, NotFoundError } from '../utils/errors.util.js';
import logger from '../utils/logger.util.js';

class AdminController {
  /**
   * Get Platform Overview KPIs & Charts
   */
  async getDashboardStats(req, res, next) {
    try {
      // 1. Total Registered Users
      const totalUsers = await User.countDocuments();

      // 2. Total Paid Revenue (Aggregate Invoice collections)
      const revenueAggregate = await Invoice.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalRevenue = revenueAggregate[0]?.total || 0;

      // 3. Current MRR (Monthly Recurring Revenue)
      const activePaidUsers = await User.find({
        'subscription.status': 'active',
        'subscription.plan': { $in: ['starter', 'professional', 'agency'] }
      });
      
      let mrr = 0;
      activePaidUsers.forEach((u) => {
        const plan = u.subscription.plan;
        if (plan === 'starter') mrr += 29;
        if (plan === 'professional') mrr += 79;
        if (plan === 'agency') mrr += 249;
      });

      // 4. Counts by subscription tiers
      const freeCount = await User.countDocuments({
        $or: [
          { 'subscription.plan': 'free' },
          { 'subscription.plan': { $exists: false } },
          { 'subscription.status': { $ne: 'active' } }
        ]
      });
      const starterCount = await User.countDocuments({
        'subscription.plan': 'starter',
        'subscription.status': 'active'
      });
      const professionalCount = await User.countDocuments({
        'subscription.plan': 'professional',
        'subscription.status': 'active'
      });
      const agencyCount = await User.countDocuments({
        'subscription.plan': 'agency',
        'subscription.status': 'active'
      });

      // 5. Total Social connections, Posts generated
      const totalSocialAccounts = await SocialAccount.countDocuments();
      const totalPosts = await Post.countDocuments();
      const totalTokensUsedAggregate = await AIUsage.aggregate([
        { $group: { _id: null, total: { $sum: '$totalTokens' } } }
      ]);
      const totalTokensUsed = totalTokensUsedAggregate[0]?.total || 0;

      // 6. Recent paid invoices (list of 10)
      const recentInvoices = await Invoice.find()
        .sort({ date: -1 })
        .limit(10)
        .populate('userId', 'firstName lastName email');

      // 7. Revenue Timeline (last 30 days of paid invoices)
      const revenueHistory = await Invoice.aggregate([
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            amount: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 30 }
      ]);
      const revenueTimeline = revenueHistory.map((item) => ({
        date: item._id,
        amount: item.amount
      }));

      // Plan distributions for Pie chart
      const subscriptionDistribution = [
        { name: 'Free', value: freeCount },
        { name: 'Starter', value: starterCount },
        { name: 'Professional', value: professionalCount },
        { name: 'Agency', value: agencyCount }
      ];

      res.status(200).json({
        success: true,
        data: {
          kpis: {
            totalUsers,
            totalRevenue,
            mrr,
            totalSocialAccounts,
            totalPosts,
            totalTokensUsed
          },
          subscriptionDistribution,
          revenueTimeline,
          recentInvoices
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List Platform Users (filtered & paginated)
   */
  async getUsersList(req, res, next) {
    try {
      const { page = 1, limit = 10, search = '', plan = '', status = '' } = req.query;
      const query = {};

      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } }
        ];
      }

      if (plan) {
        query['subscription.plan'] = plan;
      }

      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'blocked') {
        query.isActive = false;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const users = await User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await User.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update User Role (User <-> Super Admin)
   */
  async updateUserRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['USER', 'SUPER_ADMIN'].includes(role)) {
        throw new BadRequestError('Invalid role role specified');
      }

      const user = await User.findById(id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const oldRole = user.role;
      user.role = role;
      await user.save();

      // Log action in audit logs
      await AuditLog.create({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'UPDATE_USER_ROLE',
        targetUserId: user._id,
        details: `Changed role of user ${user.email} from ${oldRole} to ${role}`,
        ipAddress: req.ip || '127.0.0.1'
      });

      res.status(200).json({
        success: true,
        message: 'User role updated successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update User Status (Block / Unblock)
   */
  async updateUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        throw new BadRequestError('isActive status must be a boolean');
      }

      const user = await User.findById(id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      user.isActive = isActive;
      await user.save();

      // Log action in audit logs
      await AuditLog.create({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'UPDATE_USER_STATUS',
        targetUserId: user._id,
        details: `${isActive ? 'Activated' : 'Blocked'} account for user: ${user.email}`,
        ipAddress: req.ip || '127.0.0.1'
      });

      res.status(200).json({
        success: true,
        message: `User account successfully ${isActive ? 'activated' : 'blocked'}`,
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manually override subscription parameters
   */
  async manualOverrideSubscription(req, res, next) {
    try {
      const { id } = req.params;
      const { plan, status, currentPeriodEnd } = req.body;

      if (!['free', 'starter', 'professional', 'agency'].includes(plan)) {
        throw new BadRequestError('Invalid plan specified');
      }
      if (!['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'none'].includes(status)) {
        throw new BadRequestError('Invalid status specified');
      }

      const user = await User.findById(id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const oldSub = { ...user.subscription.toObject() };
      
      user.subscription.plan = plan;
      user.subscription.status = status;
      if (currentPeriodEnd) {
        user.subscription.currentPeriodEnd = new Date(currentPeriodEnd);
      }
      if (plan === 'free') {
        user.subscription.gateway = 'none';
        user.subscription.subscriptionId = undefined;
      } else {
        if (user.subscription.gateway === 'none') {
          user.subscription.gateway = 'stripe'; // fallback gateway descriptor
        }
        if (!user.subscription.subscriptionId) {
          user.subscription.subscriptionId = `manual_override_${Date.now()}`;
        }
      }

      await user.save();

      // Create Audit Log entry
      await AuditLog.create({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'MANUAL_SUBSCRIPTION_UPDATE',
        targetUserId: user._id,
        details: `Overrode subscription details of ${user.email}. Plan: ${oldSub.plan || 'none'} -> ${plan}, Status: ${oldSub.status || 'none'} -> ${status}`,
        ipAddress: req.ip || '127.0.0.1'
      });

      // Log invoice for overrides to Starter/Pro/Agency if upgraded
      if (plan !== 'free' && oldSub.plan !== plan) {
        const amount = plan === 'starter' ? 29 : plan === 'professional' ? 79 : 249;
        await Invoice.create({
          invoiceId: `INV-MAN-${Date.now().toString().substring(7)}`,
          userId: user._id,
          amount,
          currency: 'usd',
          status: 'paid',
          gateway: user.subscription.gateway || 'stripe'
        });
      }

      res.status(200).json({
        success: true,
        message: 'User subscription overrode successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch System-wide AI Usage Metrics
   */
  async getAIUsageStats(req, res, next) {
    try {
      // 1. Total Token Aggregate
      const totalsAggregate = await AIUsage.aggregate([
        {
          $group: {
            _id: null,
            totalPromptTokens: { $sum: '$promptTokens' },
            totalCompletionTokens: { $sum: '$completionTokens' },
            totalTokens: { $sum: '$totalTokens' },
            totalRequests: { $sum: 1 }
          }
        }
      ]);

      const totals = totalsAggregate[0] || {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalRequests: 0
      };

      // 2. Token Timeline Usage (Group daily)
      const timelineHistory = await AIUsage.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            promptTokens: { $sum: '$promptTokens' },
            completionTokens: { $sum: '$completionTokens' },
            totalTokens: { $sum: '$totalTokens' },
            requests: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 30 }
      ]);
      const timeline = timelineHistory.map((item) => ({
        date: item._id,
        promptTokens: item.promptTokens,
        completionTokens: item.completionTokens,
        totalTokens: item.totalTokens,
        requests: item.requests
      }));

      // 3. Breakdown by request types
      const breakdownAggregate = await AIUsage.aggregate([
        {
          $group: {
            _id: '$type',
            totalTokens: { $sum: '$totalTokens' },
            requests: { $sum: 1 }
          }
        },
        { $sort: { totalTokens: -1 } }
      ]);
      const breakdown = breakdownAggregate.map((item) => ({
        type: item._id,
        tokens: item.totalTokens,
        requests: item.requests
      }));

      // 4. Top users by Token consumption
      const topUsersAggregate = await AIUsage.aggregate([
        {
          $group: {
            _id: '$userId',
            tokens: { $sum: '$totalTokens' },
            requests: { $sum: 1 }
          }
        },
        { $sort: { tokens: -1 } },
        { $limit: 10 }
      ]);
      
      const topUsers = await User.populate(topUsersAggregate, {
        path: '_id',
        select: 'firstName lastName email'
      });

      res.status(200).json({
        success: true,
        data: {
          totals,
          timeline,
          breakdown,
          topUsers: topUsers.map((u) => ({
            userId: u._id?._id || 'unknown',
            name: u._id ? `${u._id.firstName} ${u._id.lastName}` : 'System Developer',
            email: u._id ? u._id.email : 'developer@taraflow.ai',
            tokens: u.tokens,
            requests: u.requests
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch Chronological System Audit Logs
   */
  async getAuditLogs(req, res, next) {
    try {
      const logs = await AuditLog.find()
        .sort({ timestamp: -1 })
        .limit(100)
        .populate('adminId', 'firstName lastName email')
        .populate('targetUserId', 'firstName lastName email');

      res.status(200).json({
        success: true,
        data: logs
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminControllerInstance = new AdminController();
export default adminControllerInstance;
