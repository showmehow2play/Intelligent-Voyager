/*
 * Client cloud della nuova applicazione.
 * Usa esclusivamente le RPC travel_next_* del nuovo schema.
 */
window.TravelNextCloud = (() => {
  let client = null;

  function getConfig() {
    return window.TRAVEL_NEXT_SUPABASE_CONFIG || {};
  }

  function isConfigured() {
    const config = getConfig();
    return Boolean(window.supabase && config.url && config.anonKey && !config.url.includes('YOUR_') && !config.anonKey.includes('YOUR_'));
  }

  function ensureClient() {
    if (!isConfigured()) throw new Error('Nuovo progetto Supabase non configurato');
    if (!client) {
      const config = getConfig();
      client = window.supabase.createClient(config.url, config.anonKey);
    }
    return client;
  }

  function createShareToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function getShareToken() {
    const queryToken = new URLSearchParams(window.location.search).get('trip');
    if (queryToken) return queryToken;
    const hash = window.location.hash.replace(/^#/, '');
    return new URLSearchParams(hash).get('trip') || '';
  }

  async function rpc(name, args) {
    const result = await ensureClient().rpc(name, args);
    if (result.error) throw result.error;
    return result.data;
  }

  async function createTrip(trip, token = createShareToken()) {
    const result = await rpc('travel_next_create_trip', {
      p_token: token,
      p_name: trip.name || 'Nuovo viaggio',
      p_destination: trip.destination || '',
      p_status: trip.status || 'bozza',
      p_payload: trip
    });
    return { token, trip: result?.payload || trip, metadata: result };
  }

  async function loadTrip(token = getShareToken()) {
    if (!token) throw new Error('Link viaggio non presente');
    const result = await rpc('travel_next_get_trip', { p_token: token });
    return result?.payload || null;
  }

  async function saveTrip(trip, token = getShareToken()) {
    if (!token) throw new Error('Link viaggio non presente');
    const result = await rpc('travel_next_save_trip', {
      p_token: token,
      p_name: trip.name || 'Viaggio',
      p_destination: trip.destination || '',
      p_status: trip.status || 'bozza',
      p_payload: trip
    });
    return result?.payload || trip;
  }

  return {
    get configured() { return isConfigured(); },
    get shareToken() { return getShareToken(); },
    createShareToken,
    createTrip,
    loadTrip,
    saveTrip
  };
})();
