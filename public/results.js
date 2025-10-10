let selectedSuppliers = new Set();

async function loadSearchHistory() {
  try {
    setStatus('Завантаження історії...', 'info');

    const response = await fetch('/api/results/history');
    if (!response.ok) {
      throw new Error('Failed to load history');
    }

    const data = await response.json();
    renderHistoryTable(data);

    setStatus('', 'info');
  } catch (error) {
    console.error('Error loading history:', error);
    setStatus('Помилка завантаження даних', 'error');
    document.getElementById('results-empty').style.display = 'block';
    document.getElementById('history-table').style.display = 'none';
  }
}

function renderHistoryTable(data) {
  const tbody = document.getElementById('history-tbody');
  const table = document.getElementById('history-table');
  const empty = document.getElementById('results-empty');

  if (!data || data.length === 0) {
    tbody.innerHTML = '';
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  tbody.innerHTML = '';
  table.style.display = 'table';
  empty.style.display = 'none';

  data.forEach(row => {
    if (!row.supplier_id) {
      return;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="row-checkbox" data-supplier-id="${row.supplier_id || ''}"></td>
      <td>${escapeHtml(row.search_id || '')}</td>
      <td>${formatDate(row.search_date)}</td>
      <td>${escapeHtml(row.query || '')}</td>
      <td>${row.total_suppliers || 0}</td>
      <td>${escapeHtml(row.company_name || '-')}</td>
      <td>${escapeHtml(row.email || '-')}</td>
      <td>${renderStatusBadge(row.email_status)}</td>
      <td>${row.sent_at ? formatDate(row.sent_at) : '-'}</td>
      <td>${row.reply_received_at ? formatDate(row.reply_received_at) : '-'}</td>
      <td>${renderReplyPreview(row.reply_text)}</td>
      <td>${renderLanguageFlag(row.email_language, row.country)}</td>
    `;
    tbody.appendChild(tr);
  });

  attachCheckboxListeners();
}

function renderStatusBadge(status) {
  const statusLower = (status || 'queued').toLowerCase();

  const badges = {
    'queued': '<span class="badge badge-info">📧 Queued</span>',
    'sent': '<span class="badge badge-success">✅ Sent</span>',
    'failed': '<span class="badge badge-danger">❌ Failed</span>',
    'replied': '<span class="badge badge-purple">💬 Replied</span>'
  };

  return badges[statusLower] || badges['queued'];
}

function renderLanguageFlag(lang, country) {
  if (!lang && !country) return '-';

  const flags = {
    'zh': '🇨🇳 中文',
    'zh-TW': '🇹🇼 中文',
    'en': '🇺🇸 English',
    'de': '🇩🇪 Deutsch',
    'hi': '🇮🇳 हिंदी',
    'uk': '🇺🇦 Українська',
    'fr': '🇫🇷 Français',
    'es': '🇪🇸 Español',
    'it': '🇮🇹 Italiano',
    'ja': '🇯🇵 日本語',
    'ko': '🇰🇷 한국어',
    'pt': '🇵🇹 Português',
    'ru': '🇷🇺 Русский',
    'ar': '🇸🇦 العربية',
    'vi': '🇻🇳 Tiếng Việt',
    'th': '🇹🇭 ไทย',
    'id': '🇮🇩 Bahasa',
    'ms': '🇲🇾 Melayu'
  };

  if (lang && flags[lang]) {
    return `<span class="language-flag">${flags[lang]}</span>`;
  }

  const countryFlags = {
    'China': '🇨🇳',
    'India': '🇮🇳',
    'Germany': '🇩🇪',
    'USA': '🇺🇸',
    'France': '🇫🇷',
    'Spain': '🇪🇸',
    'Italy': '🇮🇹',
    'Japan': '🇯🇵',
    'South Korea': '🇰🇷',
    'Ukraine': '🇺🇦'
  };

  const flag = countryFlags[country] || '🌐';
  return `<span class="language-flag">${flag} ${lang || country || ''}</span>`;
}

function renderReplyPreview(text) {
  if (!text) return '-';

  const maxLength = 100;
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return `<div class="reply-preview">${escapeHtml(trimmed)}</div>`;
  }

  const preview = escapeHtml(trimmed.substring(0, maxLength));
  const full = escapeHtml(trimmed);

  return `
    <div class="reply-preview">
      <span class="reply-snippet">${preview}...</span>
      <button class="btn-show-full" data-full-text="${full}">Показати повністю</button>
    </div>
  `;
}

function attachCheckboxListeners() {
  const selectAll = document.getElementById('select-all');
  if (selectAll) {
    selectAll.replaceWith(selectAll.cloneNode(true));
  }

  document.getElementById('select-all').addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      if (e.target.checked && cb.dataset.supplierId) {
        selectedSuppliers.add(cb.dataset.supplierId);
      } else {
        selectedSuppliers.delete(cb.dataset.supplierId);
      }
    });
    updateBulkDeleteButton();
  });

  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked && e.target.dataset.supplierId) {
        selectedSuppliers.add(e.target.dataset.supplierId);
      } else {
        selectedSuppliers.delete(e.target.dataset.supplierId);
      }
      updateBulkDeleteButton();
    });
  });

  document.querySelectorAll('.btn-show-full').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const fullText = e.target.dataset.fullText;
      if (fullText) {
        alert(fullText);
      }
    });
  });
}

function updateBulkDeleteButton() {
  const btn = document.getElementById('bulk-delete-btn');
  const count = document.getElementById('selected-count');

  if (selectedSuppliers.size > 0) {
    btn.style.display = 'inline-block';
    count.textContent = selectedSuppliers.size;
  } else {
    btn.style.display = 'none';
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setStatus(message, type = 'info') {
  const statusBox = document.getElementById('results-status');
  if (!message) {
    statusBox.innerHTML = '';
    return;
  }
  const classes = {
    info: 'notice',
    error: 'alert',
    success: 'success'
  };
  statusBox.innerHTML = `<div class="${classes[type] || 'notice'}">${message}</div>`;
}

async function loadGuidance() {
  const guidanceBox = document.getElementById('sendgrid-guidance');
  try {
    const response = await fetch('/api/settings');
    if (!response.ok) throw new Error('Помилка завантаження налаштувань');
    const settings = await response.json();
    const policy = settings.sendgridPolicy || {};
    const recommendations = settings.emailTemplates?.recommendations || '';
    guidanceBox.classList.remove('alert');
    guidanceBox.classList.add('notice');
    guidanceBox.innerHTML = `
      <p><strong>Максимум листів на день:</strong> ${policy.maxPerDay || 500}</p>
      <p><strong>Інтервал між листами (сек):</strong> ${policy.intervalSeconds || 30}</p>
      <p><strong>Рекомендації:</strong> ${recommendations || 'Немає рекомендацій'}</p>
    `;
  } catch (error) {
    guidanceBox.classList.add('alert');
    guidanceBox.textContent = `Помилка: ${error.message}`;
  }
}

document.getElementById('bulk-delete-btn').addEventListener('click', () => {
  document.getElementById('delete-count').textContent = selectedSuppliers.size;
  document.getElementById('delete-modal').style.display = 'flex';
});

document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
  const supplierIds = Array.from(selectedSuppliers);

  try {
    const response = await fetch('/api/results/suppliers/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_ids: supplierIds })
    });

    if (response.ok) {
      const result = await response.json();
      selectedSuppliers.clear();
      document.getElementById('delete-modal').style.display = 'none';
      await loadSearchHistory();
      alert(`Успішно видалено ${result.deleted} постачальників!`);
    } else {
      const error = await response.json();
      alert('Помилка видалення: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Помилка видалення');
  }
});

document.getElementById('cancel-delete-btn').addEventListener('click', () => {
  document.getElementById('delete-modal').style.display = 'none';
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  selectedSuppliers.clear();
  document.getElementById('select-all').checked = false;
  updateBulkDeleteButton();
  loadSearchHistory();
});

document.addEventListener('DOMContentLoaded', () => {
  loadSearchHistory();
  loadGuidance();
});
