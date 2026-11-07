/**
 * LedgerLine Financial Transaction Script
 * Ensures single-submission, idempotency lock, live balance preview, and gateway integration.
 */
document.addEventListener('DOMContentLoaded', () => {
  const txnForms = document.querySelectorAll('.transaction-form');

  txnForms.forEach(form => {
    const submitBtn = form.querySelector('button[type="submit"]');
    const amountInput = form.querySelector('input[name="amount"]');
    const balancePreview = document.getElementById('balance-preview');
    const currentBalanceAttr = form.getAttribute('data-balance');

    // Live Balance Preview Calculation
    if (amountInput && balancePreview && currentBalanceAttr) {
      const currentPaise = parseInt(currentBalanceAttr, 10) || 0;
      const isDebit = form.classList.contains('form-withdraw') || form.classList.contains('form-transfer');

      amountInput.addEventListener('input', () => {
        const val = parseFloat(amountInput.value);
        if (isNaN(val) || val <= 0) {
          balancePreview.innerHTML = '';
          return;
        }

        const inputPaise = Math.round(val * 100);
        let simulatedBalancePaise;

        if (isDebit) {
          simulatedBalancePaise = currentPaise - inputPaise;
          if (simulatedBalancePaise < 0) {
            balancePreview.innerHTML = `
              <div class="alert alert-danger py-2 mt-2 mb-0 small">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>
                Insufficient balance! Requested amount exceeds available balance.
              </div>
            `;
            if (submitBtn) submitBtn.disabled = true;
            return;
          } else {
            if (submitBtn) submitBtn.disabled = false;
          }
        } else {
          simulatedBalancePaise = currentPaise + inputPaise;
        }

        const formatted = (simulatedBalancePaise / 100).toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });

        balancePreview.innerHTML = `
          <div class="alert alert-info py-2 mt-2 mb-0 small">
            Estimated Balance After Transaction: <strong>₹ ${formatted}</strong>
          </div>
        `;
      });
    }

    // Dynamic Recipient Verification Lookup for Transfer Form
    const destAccInput = form.querySelector('input[name="destinationAccountNumber"]');
    if (destAccInput) {
      const recipientFeedback = document.createElement('div');
      recipientFeedback.id = 'recipient-feedback';
      recipientFeedback.className = 'mt-1 small';
      destAccInput.parentNode.appendChild(recipientFeedback);

      let debounceTimer = null;
      destAccInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const accNum = destAccInput.value.trim();

        if (accNum.length < 8) {
          recipientFeedback.innerHTML = '';
          return;
        }

        recipientFeedback.innerHTML = '<span class="text-muted"><span class="spinner-border spinner-border-sm me-1"></span>Verifying account...</span>';

        debounceTimer = setTimeout(async () => {
          try {
            const res = await fetch(`/accounts/lookup?accountNumber=${encodeURIComponent(accNum)}`);
            const data = await res.json();

            if (data.success) {
              recipientFeedback.innerHTML = `
                <span class="text-success fw-semibold">
                  <i class="bi bi-patch-check-fill text-success me-1"></i>
                  Verified Recipient: <strong>${data.recipientName}</strong> (${data.accountType})
                </span>
              `;
            } else {
              recipientFeedback.innerHTML = `
                <span class="text-danger">
                  <i class="bi bi-x-circle-fill text-danger me-1"></i>
                  ${data.message}
                </span>
              `;
            }
          } catch (err) {
            recipientFeedback.innerHTML = '';
          }
        }, 350);
      });
    }

    // Submit handler - prevent duplicate clicks & show spinner
    form.addEventListener('submit', (e) => {
      if (submitBtn) {
        submitBtn.disabled = true;
        const origText = submitBtn.innerHTML;
        submitBtn.innerHTML = `
          <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Processing Secure Transaction...
        `;
      }
    });
  });

  // Razorpay Gateway Integration
  const rzpBtn = document.getElementById('btn-razorpay-deposit');
  if (rzpBtn) {
    rzpBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const accountSelect = document.getElementById('accountId');
      const amountInput = document.getElementById('amount');
      const idempotencyKeyInput = document.getElementById('idempotencyKey');
      const csrfInput = document.querySelector('input[name="_csrf"]');

      if (!accountSelect || !amountInput || !amountInput.value) {
        alert('Please select an account and enter a valid deposit amount.');
        return;
      }

      const accountId = accountSelect.value;
      const amount = amountInput.value;
      const idempotencyKey = idempotencyKeyInput ? idempotencyKeyInput.value : window.generateUUID();
      const _csrf = csrfInput ? csrfInput.value : '';

      rzpBtn.disabled = true;
      rzpBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Initiating Gateway...';

      try {
        // Step 1: Create Order
        const res = await fetch('/payments/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': _csrf
          },
          body: JSON.stringify({ accountId, amount, idempotencyKey })
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || 'Failed to create payment order');
        }

        const { order } = data;

        // Step 2: Handle Mock vs Real Razorpay Checkout
        if (order.isMock || typeof Razorpay === 'undefined') {
          // Simulate instant test payment
          const verifyRes = await fetch('/payments/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': _csrf
            },
            body: JSON.stringify({
              razorpayOrderId: order.orderId,
              razorpayPaymentId: 'pay_test_' + Date.now(),
              razorpaySignature: 'mock_signature',
              idempotencyKey
            })
          });

          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            alert('Test Payment Successful! ' + verifyData.message);
            window.location.href = `/accounts/${accountId}`;
          } else {
            throw new Error(verifyData.message);
          }
        } else {
          // Real Razorpay Checkout Modal
          const options = {
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: 'LedgerLine Financial',
            description: 'Account Balance Deposit',
            order_id: order.orderId,
            handler: async function (response) {
              const verifyRes = await fetch('/payments/verify', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-csrf-token': _csrf
                },
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  idempotencyKey
                })
              });
              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                window.location.href = `/accounts/${accountId}`;
              } else {
                alert('Payment verification failed: ' + verifyData.message);
              }
            }
          };
          const rzp = new Razorpay(options);
          rzp.open();
        }
      } catch (err) {
        alert('Payment Error: ' + err.message);
      } finally {
        rzpBtn.disabled = false;
        rzpBtn.innerHTML = '<i class="bi bi-credit-card me-1"></i> Pay via Razorpay';
      }
    });
  }
});

