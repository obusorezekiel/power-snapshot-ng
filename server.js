const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;
const WORLD_BANK_BASE = 'https://api.worldbank.org/v2/country/NGA/indicator';

const INDICATORS = [
  {
    id: 'EG.ELC.ACCS.ZS',
    label: 'Access to electricity',
    unit: '% of population',
    highlight: true,
  },
  {
    id: 'EG.USE.ELEC.KH.PC',
    label: 'Electric power consumption',
    unit: 'kWh per capita',
  },
  {
    id: 'EG.ELC.RNEW.ZS',
    label: 'Renewable electricity output',
    unit: '% of total output',
  },
];

async function fetchLatestIndicator(indicatorId) {
  const { data } = await axios.get(`${WORLD_BANK_BASE}/${indicatorId}`, {
    params: { format: 'json', per_page: 20 },
    timeout: 30000,
  });

  const rows = data?.[1];
  if (!Array.isArray(rows)) {
    return null;
  }

  const latest = rows.find((row) => row.value != null);
  if (!latest) {
    return null;
  }

  return {
    year: Number(latest.date),
    value: latest.value,
  };
}

async function fetchNigeriaEnergy() {
  const results = [];

  for (const indicator of INDICATORS) {
    const latest = await fetchLatestIndicator(indicator.id);
    results.push({
      id: indicator.id,
      label: indicator.label,
      unit: indicator.unit,
      highlight: indicator.highlight ?? false,
      year: latest?.year ?? null,
      value: latest?.value ?? null,
    });
  }

  const populated = results.filter((item) => item.value != null);
  if (populated.length === 0) {
    throw new Error('World Bank returned no Nigeria energy data');
  }

  const highlight = results.find((item) => item.highlight && item.value != null) ?? populated[0];

  return {
    country: 'Nigeria',
    iso2: 'NG',
    region: 'Africa',
    source: 'World Bank Open Data',
    sourceUrl: 'https://data.worldbank.org/country/nigeria',
    note:
      'Published national indicators. Unlike the UK, Nigeria does not offer a free public live grid API — these are the latest official statistics available.',
    highlight: {
      label: highlight.label,
      value: Math.round(highlight.value * 10) / 10,
      unit: highlight.unit,
      year: highlight.year,
    },
    stats: results.map((item) => ({
      ...item,
      value: item.value == null ? null : Math.round(item.value * 10) / 10,
    })),
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/energy', async (_req, res) => {
  try {
    const payload = await fetchNigeriaEnergy();
    res.json(payload);
  } catch (err) {
    console.error('Energy API error:', err.message);
    res.status(502).json({ error: 'Could not fetch Nigeria energy data' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Power Snapshot NG running on port ${PORT}`);
});
