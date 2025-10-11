const form = document.querySelector('#search-form');
const statusBox = document.querySelector('#search-status');
const latestSection = document.querySelector('#latest-result');
const latestSummary = document.querySelector('#latest-summary');
const resultsTableBody = document.querySelector('#results-table tbody');
const minSuppliersInput = document.querySelector('#min_suppliers');
const maxSuppliersInput = document.querySelector('#max_suppliers');

function setStatus(message, type = 'info') {
  if (!message) {
    statusBox.innerHTML = '';
    return;
  }
  const classes = {
    info: 'notice',
    error: 'alert',
    success: 'success'
  };
  statusBox.innerHTML = `<div class="${classes[type] || classes.info}">${message}</div>`;
}

function renderLatest(result) {
  if (!result) {
    latestSection.style.display = 'none';
    resultsTableBody.innerHTML = '';
    return;
  }

  const sentCount = result.emailResults?.filter((item) => item.status === 'sent').length ?? 0;
  latestSummary.innerHTML = `
    <p><strong>ID пошуку:</strong> ${result.searchId}</p>
    <p><strong>Валідовані постачальники:</strong> ${result.metrics?.suppliersValidated ?? result.suppliers?.length ?? '—'}</p>
    <p><strong>Надіслані листи:</strong> ${sentCount}</p>
  `;

  resultsTableBody.innerHTML = (result.emailResults || [])
    .map((item) => {
      const statusClass =
        item.status === 'sent' ? 'status-sent' : item.status === 'failed' ? 'status-failed' : 'status-pending';
      const statusLabel =
        item.status === 'sent' ? 'Надіслано' : item.status === 'failed' ? 'Помилка' : 'Очікує';
      return `
        <tr>
          <td>${item.supplierId}</td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
          <td>${item.subject || '—'}</td>
          <td>${item.sendgridMessageId || item.error || '—'}</td>
        </tr>
      `;
    })
    .join('');

  latestSection.style.display = 'block';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const rawData = Object.fromEntries(formData.entries());

  // Convert snake_case to camelCase for API
  const payload = {
    productDescription: rawData.product_description,
    quantity: rawData.quantity,
    targetPrice: rawData.target_price,
    additionalRequirements: rawData.additional_requirements,
    preferredRegion: rawData.preferred_region || 'china' // Default to China
  };

  const minSuppliers = Number(minSuppliersInput.value);
  const maxSuppliers = Number(maxSuppliersInput.value);
  if (Number.isFinite(minSuppliers) && minSuppliers > 0) {
    payload.minSuppliers = minSuppliers;
  }
  if (Number.isFinite(maxSuppliers) && maxSuppliers > 0) {
    payload.maxSuppliers = maxSuppliers;
  }

  setStatus('Запуск пошуку… це може зайняти кілька хвилин.', 'info');
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      const message = result?.message || 'Пошук завершився з помилкою';
      const details = Array.isArray(result?.details) ? `\n${result.details.join('\n')}` : '';
      throw new Error(`${message}${details}`);
    }
    setStatus(`Пошук ${result.searchId} завершено. Оброблено постачальників: ${result.emailResults?.length || 0}.`, 'success');
    renderLatest(result);
  } catch (error) {
    console.error(error);
    setStatus(`Помилка: ${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
  }
});
