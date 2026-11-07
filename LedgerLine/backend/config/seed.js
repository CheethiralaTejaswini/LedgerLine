const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connectDB } = require('./db');
const User = require('../models/User');
const Account = require('../models/Account');
const AccountService = require('../services/accountService');
const TransactionService = require('../services/transactionService');
const generateIdempotencyKey = require('../utils/generateIdempotencyKey');

async function seedData() {
  try {
    await connectDB();
    console.log('[Seed] Connected to database. Seeding sample users and accounts...');

    // 1. Check or Create Admin
    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      admin = new User({
        username: 'admin',
        email: 'admin@ledgerline.com',
        fullName: 'System Administrator',
        role: 'ADMIN',
        status: 'ACTIVE'
      });
      await User.register(admin, 'Admin@12345');
      console.log('✓ Admin created: admin / Admin@12345');
    }

    // 2. Check or Create Auditor
    let auditor = await User.findOne({ username: 'auditor' });
    if (!auditor) {
      auditor = new User({
        username: 'auditor',
        email: 'auditor@ledgerline.com',
        fullName: 'Compliance Auditor',
        role: 'AUDITOR',
        status: 'ACTIVE'
      });
      await User.register(auditor, 'Auditor@12345');
      console.log('✓ Auditor created: auditor / Auditor@12345');
    }

    // 3. Check or Create User 1 (Alice)
    let user1 = await User.findOne({ username: 'alice' });
    if (!user1) {
      user1 = new User({
        username: 'alice',
        email: 'alice@example.com',
        fullName: 'Alice Johnson',
        role: 'ACCOUNT_HOLDER',
        status: 'ACTIVE'
      });
      await User.register(user1, 'Alice@12345');
      console.log('✓ Alice created: alice / Alice@12345');

      const acc1 = await AccountService.createAccount(user1._id, 'SAVINGS', 0);
      console.log(`✓ Alice Savings account created: ${acc1.accountNumber}`);

      // Seed initial deposit (₹ 50,000.00 = 5,000,000 paise)
      await TransactionService.deposit({
        accountId: acc1._id,
        amountPaise: 5000000,
        userId: user1._id,
        idempotencyKey: generateIdempotencyKey(),
        description: 'Opening deposit'
      });
      console.log(`✓ Deposited ₹ 50,000.00 into Alice account`);
    }

    // 4. Check or Create User 2 (Bob)
    let user2 = await User.findOne({ username: 'bob' });
    if (!user2) {
      user2 = new User({
        username: 'bob',
        email: 'bob@example.com',
        fullName: 'Bob Smith',
        role: 'ACCOUNT_HOLDER',
        status: 'ACTIVE'
      });
      await User.register(user2, 'Bob@12345');
      console.log('✓ Bob created: bob / Bob@12345');

      const acc2 = await AccountService.createAccount(user2._id, 'CURRENT', 0);
      console.log(`✓ Bob Current account created: ${acc2.accountNumber}`);

      // Seed initial deposit (₹ 25,000.00 = 2,500,000 paise)
      await TransactionService.deposit({
        accountId: acc2._id,
        amountPaise: 2500000,
        userId: user2._id,
        idempotencyKey: generateIdempotencyKey(),
        description: 'Opening deposit'
      });
      console.log(`✓ Deposited ₹ 25,000.00 into Bob account`);
    }

    console.log('[Seed] Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedData();
}

module.exports = seedData;

