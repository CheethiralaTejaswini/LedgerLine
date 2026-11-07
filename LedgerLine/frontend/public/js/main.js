/**
 * LedgerLine Main Frontend Script
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(el => new bootstrap.Tooltip(el));

  // Auto dismiss flash alerts
  const alerts = document.querySelectorAll('.alert-dismissible');
  alerts.forEach(alert => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      if (bsAlert) {
        bsAlert.close();
      }
    }, 6000);
  });

  // Client-side UUID generator for fallback
  window.generateUUID = function() {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Auditor Dashboard Reconciliation Runner
  const auditBtn = document.getElementById('btn-run-audit');
  if (auditBtn) {
    auditBtn.addEventListener('click', async () => {
      auditBtn.disabled = true;
      const origHtml = auditBtn.innerHTML;
      auditBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Verifying Balances...';

      try {
        const res = await fetch('/auditor/reconciliation');
        const data = await res.json();
        if (data.success && data.report) {
          const r = data.report;
          if (r.systemReconciled) {
            alert(`AUDIT PASSED 100%:\n\nAll ${r.totalAccountsAudited} accounts perfectly reconciled with the immutable ledger.\nDiscrepancy: ₹ 0.00\nAudit Timestamp: ${r.auditTimestamp}`);
          } else {
            alert(`AUDIT WARNING: Discrepancy detected in one or more accounts. Check report.`);
          }
        } else {
          alert('Failed to execute reconciliation audit.');
        }
      } catch (e) {
        alert('Reconciliation Error: ' + e.message);
      } finally {
        auditBtn.disabled = false;
        auditBtn.innerHTML = origHtml;
      }
    });
  }
});

