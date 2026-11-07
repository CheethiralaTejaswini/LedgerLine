/**
 * LedgerLine Account Operations JavaScript
 */
document.addEventListener('DOMContentLoaded', () => {
  // Copy account number to clipboard
  const copyButtons = document.querySelectorAll('.btn-copy-account');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const accNum = btn.getAttribute('data-account');
      if (accNum) {
        navigator.clipboard.writeText(accNum).then(() => {
          const originalHtml = btn.innerHTML;
          btn.innerHTML = '<i class="bi bi-check2"></i> Copied!';
          btn.classList.add('btn-success');
          btn.classList.remove('btn-outline-secondary');
          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('btn-success');
            btn.classList.add('btn-outline-secondary');
          }, 2000);
        });
      }
    });
  });
});

