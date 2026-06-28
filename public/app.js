const loading = document.getElementById('loading');
const stat = document.getElementById('stat');
const error = document.getElementById('error');
const value = document.getElementById('value');
const highlightLabel = document.getElementById('highlight-label');
const highlightUnit = document.getElementById('highlight-unit');
const meta = document.getElementById('meta');
const note = document.getElementById('note');
const flag = document.getElementById('flag');

function formatStatLine(item) {
  const year = item.year ? ` (${item.year})` : '';
  return `<p><span>${item.label}</span> <strong>${item.value} ${item.unit}${year}</strong></p>`;
}

async function loadEnergy() {
  try {
    const res = await fetch('/api/energy');
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load data');
    }

    highlightLabel.textContent = data.highlight.label;
    value.textContent = data.highlight.value ?? '—';
    highlightUnit.textContent = `${data.highlight.unit} · ${data.highlight.year}`;

    const secondary = data.stats.filter((item) => !item.highlight && item.value != null);
    meta.innerHTML = secondary.map(formatStatLine).join('');
    note.textContent = data.note;

    flag.classList.remove('hidden');
    loading.classList.add('hidden');
    error.classList.add('hidden');
    stat.classList.remove('hidden');
  } catch (err) {
    loading.classList.add('hidden');
    stat.classList.add('hidden');
    error.textContent = err.message;
    error.classList.remove('hidden');
  }
}

loadEnergy();
