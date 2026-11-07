const PaymentService = require('../services/paymentService');
const { toPaise } = require('../utils/currencyHelper');

class PaymentController {
  static async createOrder(req, res, next) {
    try {
      const { accountId, amount, idempotencyKey } = req.body;
      const amountPaise = toPaise(amount);

      const orderData = await PaymentService.createOrder({
        accountId,
        userId: req.user._id,
        amountPaise,
        idempotencyKey
      });

      return res.status(200).json({
        success: true,
        order: orderData
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async verifyPayment(req, res, next) {
    try {
      const {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        idempotencyKey
      } = req.body;

      const result = await PaymentService.verifyPayment({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        userId: req.user._id,
        idempotencyKey
      });

      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async webhook(req, res, next) {
    // Acknowledge webhook
    return res.status(200).json({ status: 'ok' });
  }
}

module.exports = PaymentController;

