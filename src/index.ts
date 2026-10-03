import { app, isServerless, REFRESH_TTL, ensureDataReady } from './app';
import { pokeapiClient } from './services/pokeapiClient';
import { dataFetcher } from './services/dataFetcher';

const port = Number(process.env.PORT) || 3000;

if (isServerless()) {
  throw new Error('This launcher is for the always-on server only. Use the Netlify function entry (netlify/functions/api.ts) on serverless.');
}

let refreshTimer: NodeJS.Timeout | null = null;

function scheduleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const info = pokeapiClient.getDiskCacheInfo();
    if (info.ageMs != null && info.ageMs > REFRESH_TTL && dataFetcher.getStatus().phase === 'ready') {
      console.log('DataFetcher: cache older than TTL, auto-refreshing');
      dataFetcher.refreshData();
    }
  }, 30 * 60 * 1000);
}

app.listen(port, () => {
  console.log(`Pokedex API running at http://localhost:${port}`);
  console.log(`Starting background data fetch from PokéAPI...`);
  scheduleAutoRefresh();
  ensureDataReady().then(() => {
    // If the cached data is already stale, kick off a background refresh so new
    // data (recently released moves/abilities) flows in without manual action.
    const info = pokeapiClient.getDiskCacheInfo();
    if (info.ageMs != null && info.ageMs > REFRESH_TTL) {
      console.log('DataFetcher: cache older than TTL after init, refreshing');
      dataFetcher.refreshData();
    }
  }).catch(err => {
    console.error('DataFetcher init failed:', err.message);
  });
});