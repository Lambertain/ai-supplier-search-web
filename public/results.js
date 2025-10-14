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
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #666;">Поки немає даних. Таблиця буде заповнена після першого пошуку.</td></tr>';
    table.style.display = 'table';
    empty.style.display = 'none';
    return;
  }

  tbody.innerHTML = '';
  table.style.display = 'table';
  empty.style.display = 'none';

  data.forEach(row => {
    const tr = document.createElement('tr');

    // Only add checkbox if supplier_id exists
    const checkboxHtml = row.supplier_id
      ? `<input type="checkbox" class="row-checkbox" data-supplier-id="${row.supplier_id}">`
      : '';

    tr.innerHTML = `
      <td>${checkboxHtml}</td>
      <td>${escapeHtml(row.search_id || '')}</td>
      <td>${formatDate(row.search_date)}</td>
      <td>${escapeHtml(row.query || '')}</td>
      <td>${row.total_suppliers || 0}</td>
      <td>${escapeHtml(row.company_name || '-')}</td>
      <td>${escapeHtml(row.email || '-')}</td>
      <td>${row.website ? `<a href="${escapeHtml(row.website)}" target="_blank" rel="noopener">🔗 Сайт</a>` : '-'}</td>
      <td>${escapeHtml(row.estimated_price_range || '-')}</td>
      <td>${escapeHtml(row.minimum_order_quantity || '-')}</td>
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
      if (!cb.dataset.supplierId) return; // Skip if no supplier_id
      cb.checked = e.target.checked;
      if (e.target.checked) {
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

    const maxPerDay = policy.maxPerDay || 500;
    const intervalSeconds = policy.intervalSeconds || 30;

    guidanceBox.innerHTML = `
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="font-weight: 600;">Ліміт на день:</span>
          <span style="background: #e3f2fd; padding: 4px 12px; border-radius: 4px; font-weight: 500;">${maxPerDay} листів</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="font-weight: 600;">Інтервал відправки:</span>
          <span style="background: #e8f5e9; padding: 4px 12px; border-radius: 4px; font-weight: 500;">${intervalSeconds} секунд</span>
        </div>
        ${recommendations ? `
        <div style="margin-top: 8px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
          <p style="font-weight: 600; margin-bottom: 8px;">Додаткові рекомендації:</p>
          <p style="line-height: 1.5;">${recommendations}</p>
        </div>` : ''}
      </div>
    `;
  } catch (error) {
    guidanceBox.classList.add('alert');
    guidanceBox.textContent = `Помилка завантаження: ${error.message}`;
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

// Tab switching logic
function initTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;

      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      // Load data for the selected tab
      if (targetTab === 'send-history') {
        loadSendHistory();
      }
    });
  });
}

// Load send history data
async function loadSendHistory() {
  try {
    setSendStatus('Завантаження історії відправки...', 'info');

    const response = await fetch('/api/results/send-history');
    if (!response.ok) {
      throw new Error('Failed to load send history');
    }

    const data = await response.json();
    renderSendHistoryTable(data);

    setSendStatus('', 'info');
  } catch (error) {
    console.error('Error loading send history:', error);
    setSendStatus('Помилка завантаження даних', 'error');
    document.getElementById('send-empty').style.display = 'block';
    document.getElementById('send-table').style.display = 'none';
  }
}

// Render send history table
function renderSendHistoryTable(data) {
  const tbody = document.getElementById('send-tbody');
  const table = document.getElementById('send-table');
  const empty = document.getElementById('send-empty');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #666;">Листи ще не відправлялись.</td></tr>';
    table.style.display = 'table';
    empty.style.display = 'none';
    return;
  }

  tbody.innerHTML = '';
  table.style.display = 'table';
  empty.style.display = 'none';

  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(row.created_at)}</td>
      <td>${escapeHtml(row.company_name || '-')}</td>
      <td>${escapeHtml(row.email || '-')}</td>
      <td>${renderStatusBadge(row.status)}</td>
      <td>${row.sent_at ? formatDate(row.sent_at) : '-'}</td>
      <td>${row.reply_received_at ? formatDate(row.reply_received_at) : '-'}</td>
      <td>${renderReplyPreview(row.reply_text)}</td>
      <td>${renderLanguageFlag(row.email_language, row.country)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Update button states for send emails
function updateBulkDeleteButton() {
  const deleteBtn = document.getElementById('bulk-delete-btn');
  const deleteCount = document.getElementById('selected-count');
  const sendBtn = document.getElementById('send-emails-btn');
  const sendCount = document.getElementById('send-count');

  if (selectedSuppliers.size > 0) {
    deleteBtn.style.display = 'inline-block';
    sendBtn.style.display = 'inline-block';
    deleteCount.textContent = selectedSuppliers.size;
    sendCount.textContent = selectedSuppliers.size;
  } else {
    deleteBtn.style.display = 'none';
    sendBtn.style.display = 'none';
  }
}

// Set status for send history tab
function setSendStatus(message, type = 'info') {
  const statusBox = document.getElementById('send-status');
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

// Send emails to selected suppliers
document.getElementById('send-emails-btn')?.addEventListener('click', () => {
  document.getElementById('send-modal-count').textContent = selectedSuppliers.size;
  document.getElementById('send-modal').style.display = 'flex';
});

document.getElementById('confirm-send-btn')?.addEventListener('click', async () => {
  const supplierIds = Array.from(selectedSuppliers);

  try {
    setStatus('Відправка листів...', 'info');

    const response = await fetch('/api/results/send-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_ids: supplierIds })
    });

    if (response.ok) {
      const result = await response.json();
      selectedSuppliers.clear();
      document.getElementById('send-modal').style.display = 'none';
      document.getElementById('select-all').checked = false;
      updateBulkDeleteButton();

      setStatus(`Листи успішно поставлені в чергу для відправки (${result.queued} шт.)`, 'success');

      // Switch to send history tab and reload
      document.querySelector('[data-tab="send-history"]').click();
    } else {
      const error = await response.json();
      setStatus('Помилка відправки: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Send error:', error);
    setStatus('Помилка відправки листів', 'error');
  }
});

document.getElementById('cancel-send-btn')?.addEventListener('click', () => {
  document.getElementById('send-modal').style.display = 'none';
});

// Refresh send history button
document.getElementById('refreshSendHistoryBtn')?.addEventListener('click', () => {
  loadSendHistory();
});

document.addEventListener('DOMContentLoaded', () => {
  initTabSwitching();
  loadSearchHistory();
  loadGuidance();
});
