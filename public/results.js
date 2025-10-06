const searchSelect = document.querySelector('#searchFilter');
const refreshBtn = document.querySelector('#refreshBtn');
const table = document.querySelector('#results-table');
const tbody = table.querySelector('tbody');
const statusBox = document.querySelector('#results-status');
const emptyNotice = document.querySelector('#results-empty');
const guidanceBox = document.querySelector('#sendgrid-guidance');

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('uk-UA');
}

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
  statusBox.innerHTML = <div class=""></div>;
}

async function loadSearchOptions() {
  try {
    const response = await fetch('/api/search');
    if (!response.ok) throw new Error('Не вдалося отримати список пошуків');
    const searches = await response.json();
    const options = ['<option value="">Всі запуски</option>']
      .concat(
        searches.map(
          (item) => <option value=""> — </option>
        )
      );
    searchSelect.innerHTML = options.join('\n');
  } catch (error) {
    console.error(error);
  }
}

async function loadGuidance() {
  try {
    const response = await fetch('/api/settings');
    if (!response.ok) throw new Error('Помилка завантаження налаштувань');
    const settings = await response.json();
    const policy = settings.sendgridPolicy || {};
    const recommendations = settings.emailTemplates?.recommendations || '';
    guidanceBox.classList.remove('alert');
    guidanceBox.classList.add('notice');
    guidanceBox.innerHTML = 
      <p><strong>Максимум листів на день:</strong> </p>
      <p><strong>Інтервал між листами (сек):</strong> </p>
      <p><strong>Рекомендації:</strong> </p>
    ;
  } catch (error) {
    guidanceBox.classList.add('alert');
    guidanceBox.textContent = Помилка: ;
  }
}

async function loadResults() {
  const searchId = searchSelect.value;
  setStatus('Завантаження…', 'info');
  table.style.display = 'none';
  emptyNotice.style.display = 'none';
  try {
    const params = searchId ? ?searchId= : '';
    const response = await fetch(/api/results);
    if (!response.ok) throw new Error('Не вдалося отримати результати');
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      emptyNotice.style.display = 'block';
      setStatus('', 'info');
      return;
    }
    tbody.innerHTML = data
      .map((item) => {
        const statusBadge = <span class="badge"></span>;
        return <tr data-supplier-id="" data-search-id="">
          <td><a href="/api/search/" target="_blank"></a></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td><button class="delete-btn" data-id="">Видалити</button></td>
        </tr>;
      })
      .join('');
    table.style.display = 'table';
    setStatus(Знайдено записів: , 'success');
  } catch (error) {
    console.error(error);
    setStatus(Помилка: , 'error');
  }
}

tbody.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-btn');
  if (!button) return;
  const row = button.closest('tr');
  const supplierId = row?.dataset?.supplierId;
  if (!supplierId) return;
  const confirmed = window.confirm('Видалити постачальника з історії?');
  if (!confirmed) return;
  try {
    const response = await fetch(/api/results/, { method: 'DELETE' });
    if (!response.ok) throw new Error('Не вдалося видалити запис');
    await loadResults();
  } catch (error) {
    console.error(error);
    setStatus(Помилка: , 'error');
  }
});

refreshBtn.addEventListener('click', () => {
  loadResults();
});

searchSelect.addEventListener('change', () => {
  loadResults();
});

await loadSearchOptions();
await Promise.all([loadResults(), loadGuidance()]);