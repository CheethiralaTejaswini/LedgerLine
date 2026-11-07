const Account = require('../models/Account');
const generateAccountNumber = require('../utils/generateAccountNumber');
const { formatPaiseToINR } = require('../utils/currencyHelper');

class AccountService {
  /**
   * Create a new bank account for a user.
   */
  static async createAccount(userId, accountType = 'SAVINGS', initialBalancePaise = 0) {
    // Generate unique account number
    let accountNumber;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 10) {
      accountNumber = generateAccountNumber();
      const existing = await Account.findOne({ accountNumber });
      if (!existing) {
        exists = false;
      }
      attempts++;
    }

    if (exists) {
      throw new Error('Failed to generate a unique account number. Please try again.');
    }

    const account = new Account({
      accountNumber,
      userId,
      accountType,
      balance: initialBalancePaise,
      currency: 'INR',
      status: 'ACTIVE'
    });

    await account.save();
    return account;
  }

  /**
   * Get all accounts owned by a specific user.
   */
  static async getUserAccounts(userId) {
    const accounts = await Account.find({ userId }).sort({ createdAt: -1 }).lean();
    return accounts.map(acc => ({
      ...acc,
      formattedBalance: formatPaiseToINR(acc.balance)
    }));
  }

  /**
   * Get an account by ID, verifying permissions.
   */
  static async getAccountById(accountId, user) {
    const account = await Account.findById(accountId).populate('userId', 'fullName email username phone').lean();
    if (!account) {
      throw new Error('Account not found');
    }

    if (user.role !== 'ADMIN' && user.role !== 'AUDITOR' && account.userId._id.toString() !== user._id.toString()) {
      const err = new Error('Access denied: You do not own this account');
      err.statusCode = 403;
      throw err;
    }

    return {
      ...account,
      formattedBalance: formatPaiseToINR(account.balance)
    };
  }

  /**
   * Get an account by its unique 12-digit number.
   */
  static async getAccountByNumber(accountNumber) {
    return await Account.findOne({ accountNumber }).populate('userId', 'fullName email username');
  }

  /**
   * Get all accounts system-wide for Admin and Auditor dashboards.
   */
  static async getAllAccounts({ page = 1, limit = 20, status, type, search } = {}) {
    const query = {};
    if (status) query.status = status;
    if (type) query.accountType = type;
    if (search) {
      query.accountNumber = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const [accounts, total] = await Promise.all([
      Account.find(query)
        .populate('userId', 'username fullName email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Account.countDocuments(query)
    ]);

    return {
      accounts: accounts.map(acc => ({
        ...acc,
        formattedBalance: formatPaiseToINR(acc.balance)
      })),
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Update account status (e.g., FROZEN, ACTIVE, CLOSED) - Admin only.
   */
  static async updateAccountStatus(accountId, newStatus) {
    const validStatuses = ['ACTIVE', 'FROZEN', 'CLOSED'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const account = await Account.findByIdAndUpdate(
      accountId,
      { $set: { status: newStatus } },
      { new: true }
    );

    if (!account) {
      throw new Error('Account not found');
    }

    return account;
  }

  /**
   * Calculate summary metrics for a user's accounts.
   */
  static async getUserSummary(userId) {
    const accounts = await Account.find({ userId, status: 'ACTIVE' });
    const totalBalancePaise = accounts.reduce((acc, curr) => acc + curr.balance, 0);

    return {
      totalAccounts: accounts.length,
      totalBalancePaise,
      formattedTotalBalance: formatPaiseToINR(totalBalancePaise)
    };
  }
}

module.exports = AccountService;

