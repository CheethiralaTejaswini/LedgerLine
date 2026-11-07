const crypto = require('crypto');
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const TransactionService = require('./transactionService');
const { formatPaiseToINR } = require('../utils/currencyHelper');

class PaymentService {
  static getRazorpayInstance() {
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  /**
   * Create a Razorpay Order for a deposit.
   */
  static async createOrder({ accountId, userId, amountPaise, idempotencyKey }) {
    if (!amountPaise || amountPaise < 100) {
      throw new Error('Minimum deposit via payment gateway is ₹ 1.00 (100 paise).');
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isMock = !keyId || keyId.includes('placeholder') || keyId.includes('YourTestKeyId');

    let orderId;
    if (isMock) {
      orderId = `order_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    } else {
      const razorpay = this.getRazorpayInstance();
      const options = {
        amount: amountPaise,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`.slice(0, 40),
        notes: {
          accountId: accountId.toString(),
          userId: userId.toString(),
          idempotencyKey: idempotencyKey || ''
        }
      };
      const order = await razorpay.orders.create(options);
      orderId = order.id;
    }

    const paymentRecord = new Payment({
      razorpayOrderId: orderId,
      accountId,
      userId,
      amount: amountPaise,
      currency: 'INR',
      status: 'CREATED',
      idempotencyKey
    });

    await paymentRecord.save();

    return {
      orderId,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      isMock
    };
  }

  /**
   * Verifies Razorpay HMAC signature and credits user's account if valid.
   * Prevents duplicate payment credits.
   */
  static async verifyPayment({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    userId,
    idempotencyKey
  }) {
    const payment = await Payment.findOne({ razorpayOrderId });
    if (!payment) {
      throw new Error('Payment order record not found.');
    }

    // Prevent duplicate credits if already processed
    if (payment.status === 'CAPTURED') {
      return {
        success: true,
        message: 'Payment already verified and credited previously.',
        payment
      };
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isMock = !keySecret || keySecret.includes('placeholder') || keySecret.includes('YourTestKeySecret');

    if (!isMock) {
      const hmac = crypto.createHmac('sha256', keySecret);
      hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpaySignature) {
        payment.status = 'FAILED';
        await payment.save();
        throw new Error('Invalid payment signature. Potential tampering detected.');
      }
    }

    // Atomically transition payment status from CREATED to CAPTURED
    const updatedPayment = await Payment.findOneAndUpdate(
      { razorpayOrderId, status: 'CREATED' },
      {
        $set: {
          status: 'CAPTURED',
          razorpayPaymentId: razorpayPaymentId || `pay_mock_${Date.now()}`,
          razorpaySignature: razorpaySignature || 'mock_sig'
        }
      },
      { new: true }
    );

    if (!updatedPayment) {
      throw new Error('Payment already captured or in invalid state.');
    }

    // Credit account using TransactionService
    const depositResult = await TransactionService.deposit({
      accountId: payment.accountId,
      amountPaise: payment.amount,
      userId,
      idempotencyKey: idempotencyKey || `razorpay_${razorpayOrderId}`,
      description: `Razorpay Gateway Deposit (ID: ${razorpayPaymentId})`,
      metadata: {
        gateway: 'Razorpay',
        razorpayOrderId,
        razorpayPaymentId
      }
    });

    updatedPayment.transactionId = depositResult.transactionReference;
    await updatedPayment.save();

    return {
      success: true,
      message: `Payment of ${formatPaiseToINR(payment.amount)} verified and credited successfully!`,
      depositResult
    };
  }
}

module.exports = PaymentService;

