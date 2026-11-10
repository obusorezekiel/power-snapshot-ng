// main.js — smoke test for Power Snapshot NG
//
// Calls the running service's /api/health and /api/energy routes and prints
// a readable summary. Works against local Docker or your ECS Express URL.
//
// Usage:
//   node main.js                                   # defaults to http://localhost:8080
//   node main.js https://<service>.ecs.<region>.on.aws
//   BASE_URL=http://localhost:3000 node main.js
//
// Requires Node.js 18+ (uses the built-in fetch API — no extra dependencies).

const BASE_URL = (process.argv[2] || process.env.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
const TIMEOUT_MS = 30000;

async function getJson(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${path} returned HTTP ${res.status}${body?.error ? ` — ${body.error}` : ''}`);
  }
  return body;
}

async function checkHealth() {
  const health = await getJson('/api/health');
  if (health?.status !== 'ok') {
    throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
  }
  console.log('✔ Health check passed');
}

async function showEnergy() {
  const energy = await getJson('/api/energy');
  const { highlight, stats, source } = energy;

  console.log(`\n${energy.country} electricity snapshot (${source})`);
  console.log(`Headline: ${highlight.label} — ${highlight.value} ${highlight.unit} (${highlight.year})\n`);

  console.table(
    stats.map((s) => ({
      Indicator: s.label,
      Value: s.value ?? 'n/a',
      Unit: s.unit,
      Year: s.year ?? 'n/a',
    }))
  );
}

async function main() {
  console.log(`Testing ${BASE_URL} ...`);
  try {
    await checkHealth();
    await showEnergy();
    console.log('\nAll checks passed.');
  } catch (err) {
    console.error(`\n✘ Smoke test failed: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
