const STORAGE_KEY = 'travel-business-case-prototype-state-v1';
const LEGACY_STORAGE_KEY = 'voyagea-mvp-state-v1';

const CURRENCIES = {
  EUR: { name: 'Euro', symbol: '€', rate: 1 },
  NOK: { name: 'Corona norvegese', symbol: 'kr', rate: 11.65 },
  USD: { name: 'Dollaro USA', symbol: '$', rate: 1.09 },
  GBP: { name: 'Sterlina', symbol: '£', rate: 0.86 },
  CHF: { name: 'Franco svizzero', symbol: 'Fr', rate: 0.94 }
};

const CATEGORIES = {
  flight: { label: 'Voli e trasporti', icon: '✈' },
  accommodation: { label: 'Casa / alloggio', icon: '⌂' },
  car: { label: 'Auto e carburante', icon: '🚗' },
  food: { label: 'Cibo e spesa', icon: '🍴' },
  activities: { label: 'Divertimenti', icon: '✦' },
  insurance: { label: 'Assicurazione', icon: '＋' },
  transfers: { label: 'Trasferimenti', icon: '↔' },
  other: { label: 'Altro', icon: '⋯' }
};

const AIRPORTS = {
  TRN: 'Torino', MXP: 'Milano Malpensa', LIN: 'Milano Linate', BGY: 'Bergamo', VRN: 'Verona', BLQ: 'Bologna', VCE: 'Venezia'
};

const DESTINATIONS = {
  TBS: { label: 'Tbilisi · Georgia', base: 320, confidence: 0.68, airlines: [['Ryanair', 'lowcost'], ['Georgian Airways', 'regional'], ['Turkish Airlines', 'flag']] },
  OSL: { label: 'Oslo · Norvegia', base: 248, confidence: 0.82, airlines: [['Ryanair', 'lowcost'], ['Norwegian', 'regional'], ['SAS', 'flag']] },
  HEL: { label: 'Helsinki · Finlandia', base: 275, confidence: 0.74, airlines: [['Ryanair', 'lowcost'], ['Norwegian', 'regional'], ['Finnair', 'flag']] },
  LIS: { label: 'Lisbona · Portogallo', base: 190, confidence: 0.79, airlines: [['Ryanair', 'lowcost'], ['easyJet', 'lowcost'], ['TAP Air Portugal', 'flag']] },
  PAR: { label: 'Parigi · Francia', base: 155, confidence: 0.86, airlines: [['easyJet', 'lowcost'], ['Vueling', 'regional'], ['Air France', 'flag']] }
};

const COUNTRY_DIRECTORY_URL = 'https://restcountries.com/v3.1/all?fields=name,translations,cca2,cca3,currencies,capital,flags,flag,timezones';
const EXCHANGE_RATE_URL = 'https://api.frankfurter.app/latest?from=EUR&to=';
const CITY_SEARCH_URL = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=it';

// Fallback minimo per permettere di aprire il modulo anche prima del primo
// caricamento online. I dati vengono comunque verificati/aggiornati dalla fonte.
const FALLBACK_COUNTRIES = [
  { name: 'Croazia', code: 'HR', currency: 'EUR', currencyName: 'Euro', symbol: '€', capital: 'Zagabria', timezone: 'Europe/Zagreb', flag: '🇭🇷' },
  { name: 'Francia', code: 'FR', currency: 'EUR', currencyName: 'Euro', symbol: '€', capital: 'Parigi', timezone: 'Europe/Paris', flag: '🇫🇷' },
  { name: 'Georgia', code: 'GE', currency: 'GEL', currencyName: 'Lari georgiano', symbol: '₾', capital: 'Tbilisi', timezone: 'Asia/Tbilisi', flag: '🇬🇪' },
  { name: 'Norvegia', code: 'NO', currency: 'NOK', currencyName: 'Corona norvegese', symbol: 'kr', capital: 'Oslo', timezone: 'Europe/Oslo', flag: '🇳🇴' },
  { name: 'Portogallo', code: 'PT', currency: 'EUR', currencyName: 'Euro', symbol: '€', capital: 'Lisbona', timezone: 'Europe/Lisbon', flag: '🇵🇹' },
  { name: 'Finlandia', code: 'FI', currency: 'EUR', currencyName: 'Euro', symbol: '€', capital: 'Helsinki', timezone: 'Europe/Helsinki', flag: '🇫🇮' }
];

let runtimeState = null;
let countryDirectory = [...FALLBACK_COUNTRIES];
let countryDirectoryPromise = null;
let citySearchTimer = null;

function currencyCatalog() {
  return { ...CURRENCIES, ...(runtimeState?.customCurrencies || {}) };
}

const state = runtimeState = loadState();
let activeFlightFilter = 'all';
let cloudSaving = false;

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isoDate(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function datePlus(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function dateDiff(from, to) {
  return Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function normalizeSearchText(value = '') {
  return String(value).trim().toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeCountryRecord(raw) {
  if (!raw) return null;
  if (raw.currency) return { ...raw, rate: Number(raw.rate) || undefined };
  const currencyEntry = Object.entries(raw.currencies || {})[0];
  const currencyCode = currencyEntry?.[0] || '';
  const currencyMeta = currencyEntry?.[1] || {};
  return {
    name: raw.name?.common || '',
    officialName: raw.name?.official || '',
    italianName: raw.translations?.ita?.common || '',
    code: raw.cca2 || '',
    code3: raw.cca3 || '',
    currency: currencyCode,
    currencyName: currencyMeta.name || currencyCode,
    symbol: currencyMeta.symbol || currencyCode,
    capital: raw.capital?.[0] || '',
    timezone: raw.timezones?.[0] || '',
    flag: raw.flag || raw.flags?.emoji || '',
    rate: undefined
  };
}

function mergeCountryDirectory(incoming) {
  const byKey = new Map();
  [...FALLBACK_COUNTRIES, ...incoming].forEach((item) => {
    const country = normalizeCountryRecord(item);
    if (country?.code) byKey.set(country.code, country);
  });
  countryDirectory = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

async function loadCountryDirectory() {
  if (countryDirectoryPromise) return countryDirectoryPromise;
  countryDirectoryPromise = fetch(COUNTRY_DIRECTORY_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`directory paesi: HTTP ${response.status}`);
      return response.json();
    })
    .then((items) => {
      mergeCountryDirectory(items);
      updateTripCountryOptions();
      return countryDirectory;
    })
    .catch((error) => {
      console.warn('Directory paesi non disponibile', error);
      return countryDirectory;
    });
  return countryDirectoryPromise;
}

function findCountry(value) {
  const query = normalizeSearchText(value);
  if (!query) return null;
  return countryDirectory.find((country) => [country.name, country.officialName, country.italianName, country.code, country.code3]
    .some((candidate) => normalizeSearchText(candidate) === query)) || null;
}

function countryOptionsMarkup() {
  return countryDirectory.map((country) => `<option value="${esc(country.italianName || country.name)}">${esc(country.flag || '🌍')} ${esc(country.name)} · ${esc(country.code)}</option>`).join('');
}

function updateTripCountryOptions() {
  const options = document.getElementById('newTripCountryOptions');
  if (options) options.innerHTML = countryOptionsMarkup();
}

function updateTripCountryHint(country = null, message = '') {
  const hint = document.getElementById('newTripCountryHint');
  const city = document.getElementById('newTripCity');
  if (!hint) return;
  if (country) {
    hint.textContent = `${country.flag || '🌍'} ${country.currency || 'valuta non disponibile'} · capitale ${country.capital || 'non indicata'} · fuso ${country.timezone || 'non indicato'}`;
    hint.className = 'row-meta country-hint success';
    if (city) city.disabled = false;
  } else {
    hint.textContent = message || 'Seleziona una nazione riconosciuta per attivare la ricerca delle città.';
    hint.className = 'row-meta country-hint';
    if (city) city.disabled = true;
  }
}

async function enrichCountryExchangeRate(country) {
  if (!country?.currency || country.currency === 'EUR') return { ...country, rate: 1, rateSource: 'EUR' };
  if (state.customCurrencies?.[country.currency]?.rate) {
    return { ...country, rate: state.customCurrencies[country.currency].rate, rateSource: 'configurazione locale' };
  }
  const response = await fetch(`${EXCHANGE_RATE_URL}${encodeURIComponent(country.currency)}`);
  if (!response.ok) throw new Error(`cambio EUR/${country.currency}: HTTP ${response.status}`);
  const data = await response.json();
  const rate = Number(data.rates?.[country.currency]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('cambio non disponibile');
  return { ...country, rate, rateSource: 'Frankfurter/ECB' };
}

function scheduleCitySearch() {
  window.clearTimeout(citySearchTimer);
  const country = findCountry(document.getElementById('newTripCountry')?.value || '');
  const cityInput = document.getElementById('newTripCity');
  const cityOptions = document.getElementById('newTripCityOptions');
  if (!country || !cityInput || !cityOptions) {
    updateTripCountryHint(null);
    if (cityOptions) cityOptions.innerHTML = '';
    return;
  }
  updateTripCountryHint(country);
  const query = cityInput.value.trim();
  if (query.length < 2) {
    cityOptions.innerHTML = '';
    return;
  }
  citySearchTimer = window.setTimeout(async () => {
    try {
      const params = new URLSearchParams({ q: query, countrycodes: country.code.toLowerCase() });
      const response = await fetch(`${CITY_SEARCH_URL}&${params.toString()}`);
      if (!response.ok) throw new Error(`città: HTTP ${response.status}`);
      const places = await response.json();
      cityOptions.innerHTML = places.map((place) => `<option value="${esc(place.address?.city || place.address?.town || place.address?.municipality || place.name || place.display_name)}">${esc(place.display_name)}</option>`).join('');
    } catch (error) {
      console.warn('Ricerca città non disponibile', error);
      cityOptions.innerHTML = '';
    }
  }, 700);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function formatMoney(eur, currency = state.displayCurrency || 'EUR') {
  const catalog = currencyCatalog();
  const meta = catalog[currency] || catalog.EUR;
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: currency === 'NOK' ? 0 : 2 }).format((Number(eur) || 0) * meta.rate);
}

function currencyAmountToEUR(amount, currency) {
  return (Number(amount) || 0) / (currencyCatalog()[currency]?.rate || 1);
}

function getTrip() {
  return state.trips.find((trip) => trip.id === state.activeTripId) || state.trips[0];
}

function getScenario(trip = getTrip()) {
  return trip.scenarios.find((scenario) => scenario.id === trip.activeScenarioId) || trip.scenarios[0];
}

function makeLine(category, label, amount, notes = '', allocation = 'total') {
  return { id: uid('line'), category, label, amount, currency: 'EUR', allocation, source: 'manual', notes, linkedForecastId: null };
}

function makeScenario(name, lines, notes = '') {
  return { id: uid('scenario'), name, notes, budgetLines: lines, flightSearch: null, flightOffers: [], flightForecast: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function seedState() {
  const georgiaParticipants = [
    { id: 'p-davide', name: 'Davide Rossi', email: 'davide@example.com' },
    { id: 'p-elena', name: 'Elena Bianchi', email: 'elena@example.com' }
  ];
  const norwayParticipants = [
    { id: 'p-davide-n', name: 'Davide Rossi', email: 'davide@example.com' },
    { id: 'p-sara', name: 'Sara Luca', email: 'sara@example.com' },
    { id: 'p-luca', name: 'Luca Moretti', email: 'luca@example.com' },
    { id: 'p-marco', name: 'Marco Rossi', email: 'marco@example.com' },
    { id: 'p-giulia', name: 'Giulia Neri', email: 'giulia@example.com' }
  ];
  const georgiaSmart = makeScenario('Smart', [
    makeLine('flight', 'Voli', 270, 'BGY → TBS · 1 scalo'),
    makeLine('accommodation', 'Casa a Tbilisi', 520, 'Appartamento periferico · 7 notti'),
    makeLine('car', 'Auto a noleggio', 180, '5 giorni · classe compatta'),
    makeLine('activities', 'Divertimenti', 160, 'Tour e musei'),
    makeLine('other', 'Assicurazione e altro', 130)
  ], 'Scenario orientato al risparmio.');
  const georgiaComfort = makeScenario('Comfort', [
    makeLine('flight', 'Voli', 320, 'MXP → TBS · diretto preferito'),
    makeLine('accommodation', 'Casa a Tbilisi', 720, 'Appartamento centrale · 7 notti'),
    makeLine('car', 'Auto a noleggio', 210, '5 giorni · classe compatta'),
    makeLine('activities', 'Divertimenti', 180, 'Tour, musei e attività'),
    makeLine('other', 'Assicurazione e trasferimenti', 50)
  ], 'Scenario attivo del viaggio.');
  const norwayGroup = makeScenario('Norvegia comfort', [
    makeLine('flight', 'Voli', 248, 'BGY/MXP → OSL · diretto'),
    makeLine('accommodation', 'Case e alloggi', 1680, '13 notti · 5 persone'),
    makeLine('car', 'Auto e carburante', 920, 'Noleggio e carburante'),
    makeLine('food', 'Cibo e spesa', 900, 'Stima gruppo'),
    makeLine('activities', 'Fiordi e attività', 740, 'Tour e ingressi'),
    makeLine('other', 'Assicurazione e altro', 220)
  ]);

  return {
    version: 1,
    displayCurrency: 'EUR',
    customCurrencies: {},
    customCountries: [],
    activeTripId: 'trip-georgia',
    activeView: 'overview',
    trips: [
      {
        id: 'trip-georgia', name: 'Georgia 2027', destination: 'Georgia', destinationCode: 'TBS', startDate: '2027-09-01', endDate: '2027-09-08', baseCurrency: 'EUR',
        participants: georgiaParticipants, members: [{ name: 'Davide Rossi', email: 'davide@example.com', role: 'owner', status: 'active' }, { name: 'Elena Bianchi', email: 'elena@example.com', role: 'editor', status: 'invited' }],
        scenarios: [georgiaSmart, georgiaComfort], activeScenarioId: georgiaComfort.id, actuals: { expenses: [], payments: [] }
      },
      {
        id: 'trip-norway', name: 'Norvegia 2027', destination: 'Norvegia', destinationCode: 'OSL', startDate: '2027-07-01', endDate: '2027-07-14', baseCurrency: 'EUR',
        participants: norwayParticipants, members: [{ name: 'Davide Rossi', email: 'davide@example.com', role: 'owner', status: 'active' }, { name: 'Sara Luca', email: 'sara@example.com', role: 'editor', status: 'active' }, { name: 'Luca Moretti', email: 'luca@example.com', role: 'viewer', status: 'invited' }],
        scenarios: [norwayGroup], activeScenarioId: norwayGroup.id, actuals: { expenses: [
          { id: uid('expense'), description: 'Acconto casa Bergen', category: 'accommodation', amount: 420, currency: 'EUR', amountEUR: 420, date: '2027-02-14', paidBy: 'p-davide-n', sharedBy: ['p-davide-n', 'p-sara', 'p-luca', 'p-marco', 'p-giulia'], notes: 'Caparra', splitEqually: true },
          { id: uid('expense'), description: 'Cena sul porto', category: 'food', amount: 950, currency: 'NOK', amountEUR: currencyAmountToEUR(950, 'NOK'), date: '2027-07-04', paidBy: 'p-sara', sharedBy: ['p-davide-n', 'p-sara', 'p-luca', 'p-marco', 'p-giulia'], notes: '', splitEqually: true }
        ], payments: [] }
      }
    ]
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
    if (saved?.trips?.length) {
      saved.customCurrencies ||= {};
      saved.customCountries ||= [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      return saved;
    }
  } catch (error) { console.warn('Impossibile leggere dati locali', error); }
  return seedState();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const cloud = window.TravelNextCloud;
  const token = cloud?.shareToken;
  const trip = getTrip();
  if (cloud?.configured && token && trip && !cloudSaving) {
    cloudSaving = true;
    cloud.saveTrip(trip, token).catch((error) => console.warn('Sincronizzazione cloud non riuscita', error)).finally(() => { cloudSaving = false; });
  }
}

function toast(message, type = 'success') {
  const root = document.getElementById('toastRoot');
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function getTripTotals(trip = getTrip(), scenario = getScenario(trip)) {
  const totals = {};
  scenario?.budgetLines?.forEach((line) => {
    const eur = lineTotalEUR(line, trip);
    totals[line.category] = (totals[line.category] || 0) + eur;
  });
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return { totals, total, perPerson: total / Math.max(trip.participants.length, 1) };
}

function lineTotalEUR(line, trip = getTrip()) {
  const base = currencyAmountToEUR(line.amount, line.currency);
  if (line.allocation === 'perPerson') return base * Math.max(trip.participants.length, 1);
  if (line.allocation === 'perNight') return base * Math.max(dateDiff(trip.startDate, trip.endDate), 1);
  return base;
}

function actualTotal(trip = getTrip()) {
  return trip.actuals.expenses.reduce((sum, expense) => sum + Number(expense.amountEUR || 0), 0);
}

function progressSteps(trip) {
  const scenario = getScenario(trip);
  const hasForecast = Boolean(scenario?.flightForecast);
  const hasActuals = trip.actuals.expenses.length > 0;
  return ['Idea', 'Preventivi', 'Voli', 'Prenotazioni', 'Consuntivo', 'Saldi'].map((label, index) => ({ label, done: index === 0 || (index === 1 && scenario) || (index === 2 && hasForecast) || (index === 3 && hasForecast) || (index === 4 && hasActuals), current: index === 1 && !hasForecast || index === 2 && hasForecast && !hasActuals }));
}

function progressMarkup(trip) {
  return `<div class="progress">${progressSteps(trip).map((step) => `<div class="progress-step ${step.done ? 'done' : ''} ${step.current ? 'current' : ''}">${step.label}</div>`).join('')}</div>`;
}

function renderShell() {
  const trip = getTrip();
  const nav = [
    ['overview', '⌂', 'Panoramica'], ['scenarios', '▱', 'Preventivi'], ['flights', '✈', 'Suggerimenti voli'], ['actuals', '€', 'Consuntivo'], ['participants', '♙', 'Partecipanti'], ['members', '＋', 'Condivisione'], ['currencies', '◌', 'Valute']
  ];
  document.getElementById('app').innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><img class="brand-mark" src="icon.svg" alt=""><span>Intelligent Voyager</span></div>
        <div><div class="side-label">I miei viaggi</div><select id="tripPicker" class="trip-picker">${state.trips.map((item) => `<option value="${esc(item.id)}" ${item.id === trip.id ? 'selected' : ''}>${esc(item.name)} · ${item.participants.length} pers.</option>`).join('')}</select><div class="inline-actions" style="margin-top:8px;display:grid;gap:6px"><button class="btn btn-sm" style="width:100%;background:#253650;border-color:rgba(255,255,255,.14);color:#fff" data-action="new-trip">＋ Nuovo viaggio</button><button class="btn btn-sm btn-danger" style="width:100%" data-action="delete-trip">Elimina viaggio</button></div></div>
        <div><div class="side-label">Accesso al viaggio</div><div class="sidebar-members">${trip.members.slice(0, 4).map((member, index) => `<span class="mini-avatar" title="${esc(member.name)}" style="${index % 2 ? 'background:#d9f5ee;color:#087d68' : ''}">${initials(member.name)}</span>`).join('')}<span class="member-count">${trip.members.length} membri</span></div></div>
        <nav class="side-nav" aria-label="Navigazione viaggio">${nav.map(([view, icon, label]) => `<button class="nav-item ${state.activeView === view ? 'active' : ''}" data-action="navigate" data-view="${view}">${icon} &nbsp; ${label}</button>`).join('')}</nav>
        <div class="side-user"><span class="mini-avatar" style="margin:0">DR</span><span>Davide · owner</span></div>
      </aside>
      <main class="main">
        <input id="importJsonFile" type="file" accept="application/json,.json" hidden>
        ${renderMainHeader(trip)}
        ${renderView(trip)}
      </main>
    </div>`;
}

function renderMainHeader(trip) {
  const scenario = getScenario(trip);
  return `<header class="topbar"><div><div class="eyebrow">Viaggio attivo</div><h1>${esc(trip.name)}</h1><div class="subtitle">${esc(trip.destination)} · ${formatDate(trip.startDate)} — ${formatDate(trip.endDate)} · ${trip.participants.length} partecipanti · scenario <strong>${esc(scenario?.name || '—')}</strong></div></div><div class="top-actions"><button class="btn" data-action="share">↗ Condividi</button><button class="btn" data-action="import-data">↥ Importa JSON</button><button class="btn btn-primary" data-action="new-scenario">＋ Nuovo scenario</button></div></header>`;
}

function renderView(trip) {
  const views = { overview: renderOverview, scenarios: renderScenarios, flights: renderFlights, actuals: renderActuals, participants: renderParticipants, members: renderMembers, currencies: renderCurrencies };
  return `<section class="view active">${(views[state.activeView] || renderOverview)(trip)}</section>`;
}

function renderOverview(trip) {
  const scenario = getScenario(trip);
  const budget = getTripTotals(trip, scenario);
  const actual = actualTotal(trip);
  const next = scenario?.flightForecast ? (actual ? 'Aggiorna il consuntivo' : 'Inserisci le prime spese') : 'Aggiorna la previsione voli';
  return `${progressMarkup(trip)}
    <div class="grid grid-4">
      <div class="card soft"><span class="card-label">Budget scenario</span><span class="card-value">${formatMoney(budget.total)}</span><span class="card-context">${formatMoney(budget.perPerson)} per persona · ${esc(scenario.name)}</span></div>
      <div class="card"><span class="card-label">Consuntivo</span><span class="card-value">${formatMoney(actual)}</span><span class="card-context">${trip.actuals.expenses.length} spese registrate</span></div>
      <div class="card"><span class="card-label">Partecipanti</span><span class="card-value">${trip.participants.length}</span><span class="card-context">${trip.members.length} membri abilitati</span></div>
      <div class="card"><span class="card-label">Prossimo passo</span><span class="card-value" style="font-size:18px">${next}</span><span class="card-context">guida operativa del viaggio</span></div>
    </div>
    <div class="columns" style="margin-top:16px">
      <div class="panel"><div class="panel-head"><h2>Budget dello scenario attivo</h2><span class="muted">${Math.round((actual / Math.max(budget.total, 1)) * 100)}% consuntivato</span></div>${renderBudgetRows(budget.totals)}<div class="progress-bar"><span style="width:${Math.min(100, Math.round((actual / Math.max(budget.total, 1)) * 100))}%"></span></div><div class="inline-actions"><button class="btn btn-sm" data-action="navigate" data-view="scenarios">Apri preventivo</button><button class="btn btn-sm" data-action="navigate" data-view="actuals">Apri consuntivo</button></div></div>
      <div class="panel"><div class="panel-head"><h2>Guida al viaggio</h2><span class="muted">aggiornata ora</span></div><div class="reco"><strong>${next}</strong>${scenario?.flightForecast ? 'Il viaggio è pronto per essere aggiornato con le spese reali. Modifica liberamente importi, pagatori e partecipanti.' : 'Apri Flight Studio per ottenere una stima, una finestra di acquisto e il confronto delle offerte.'}</div><hr class="divider"><div class="member-row"><div class="row-main"><span class="row-title">Accesso condiviso</span><span class="row-meta">${trip.members.map((member) => esc(member.name)).join(' · ')}</span></div><button class="btn btn-sm" data-action="navigate" data-view="members">Gestisci</button></div></div>
    </div>`;
}

function renderBudgetRows(totals) {
  const rows = Object.entries(totals).filter(([, value]) => value > 0);
  if (!rows.length) return `<div class="empty">Nessuna voce di budget inserita.</div>`;
  return rows.map(([category, value]) => `<div class="budget-row"><div class="row-main"><span class="row-title">${CATEGORIES[category]?.icon || '＋'} ${CATEGORIES[category]?.label || category}</span><span class="row-meta">Stima nello scenario attivo</span></div><div class="row-value">${formatMoney(value)}</div></div>`).join('');
}

function renderScenarios(trip) {
  const selected = getScenario(trip);
  const totals = getTripTotals(trip, selected);
  return `${progressMarkup(trip)}<div class="section-title"><div><h2>Preventivi del viaggio</h2><span class="muted">Confronta scenari completi e scegli la baseline del consuntivo</span></div><button class="btn btn-primary" data-action="new-scenario">＋ Nuovo scenario</button></div><div class="scenario-grid">${trip.scenarios.map((scenario) => { const total = getTripTotals(trip, scenario).total; return `<article class="scenario-card ${scenario.id === trip.activeScenarioId ? 'selected' : ''}"><span class="badge ${scenario.id === trip.activeScenarioId ? 'blue' : ''}">${scenario.id === trip.activeScenarioId ? 'Scenario attivo' : 'Alternativa'}</span><h3 style="margin-top:12px">${esc(scenario.name)}</h3><p class="muted">${esc(scenario.notes || 'Scenario personalizzabile')}</p><div class="scenario-total">${formatMoney(total)} <small>totale</small></div><div class="muted">${formatMoney(total / Math.max(trip.participants.length, 1))} per persona · ${scenario.budgetLines.length} voci</div><div class="scenario-actions"><button class="btn btn-sm btn-primary" data-action="select-scenario" data-id="${scenario.id}">${scenario.id === trip.activeScenarioId ? 'Attivo' : 'Usa scenario'}</button><button class="btn btn-sm" data-action="duplicate-scenario" data-id="${scenario.id}">Duplica</button><button class="btn btn-sm" data-action="edit-scenario" data-id="${scenario.id}">Modifica</button></div></article>`; }).join('')}</div><div class="columns" style="margin-top:16px"><div class="panel"><div class="panel-head"><h2>Voci del preventivo · ${esc(selected.name)}</h2><button class="btn btn-sm btn-primary" data-action="add-budget-line">＋ Aggiungi voce</button></div>${selected.budgetLines.length ? selected.budgetLines.map((line) => `<div class="budget-row"><div class="row-main"><span class="row-title">${CATEGORIES[line.category]?.icon || '＋'} ${esc(line.label)}</span><span class="row-meta">${CATEGORIES[line.category]?.label || line.category} · ${esc(line.notes || 'Nessuna nota')} · ${line.allocation === 'perPerson' ? 'per persona' : line.allocation === 'perNight' ? 'per notte' : 'totale'}</span></div><div class="inline-actions"><div class="row-value">${formatMoney(lineTotalEUR(line, trip))}<small>${line.allocation === 'perPerson' ? 'totale per persone' : line.allocation === 'perNight' ? 'totale per notti' : line.currency}</small></div><button class="btn btn-sm btn-danger" data-action="delete-budget-line" data-id="${line.id}">×</button></div></div>`).join('') : '<div class="empty">Aggiungi la prima voce al preventivo.</div>'}<div class="sb-total" style="display:flex;justify-content:space-between;align-items:end;padding-top:15px;margin-top:5px;border-top:1px solid var(--line)"><div><span class="muted">Totale scenario</span><div class="card-value" style="font-size:25px">${formatMoney(totals.total)}</div></div><div class="row-value">${formatMoney(totals.perPerson)}<small>per persona</small></div></div></div><div class="panel"><div class="panel-head"><h2>Collegamenti rapidi</h2><span class="muted">scenario attivo</span></div><div class="reco"><strong>Voli collegati</strong>${selected.flightForecast ? `Prezzo tipico ${formatMoney(selected.flightForecast.typical)} · finestra ${formatDate(selected.flightForecast.buyWindow.from)} — ${formatDate(selected.flightForecast.buyWindow.to)}.` : 'Nessuna previsione salvata. Apri Flight Studio per collegare ricerca e budget.'}</div><div class="inline-actions" style="margin-top:12px"><button class="btn btn-primary" data-action="navigate" data-view="flights">Apri Flight Studio</button><button class="btn" data-action="navigate" data-view="actuals">Apri consuntivo</button></div></div></div>`;
}

function renderFlights(trip) {
  const scenario = getScenario(trip);
  const search = scenario.flightSearch || { originAirports: ['TRN', 'MXP', 'LIN', 'BGY'], destination: trip.destinationCode || 'OSL', departureDate: trip.startDate, returnDate: trip.endDate, passengers: trip.participants.length, directOnly: false };
  const forecast = scenario.flightForecast;
  const offers = scenario.flightOffers || [];
  const filtered = offers.filter((offer) => activeFlightFilter === 'all' || offer.type === activeFlightFilter);
  const destination = DESTINATIONS[search.destination] || { label: `${search.destination}${trip.country ? ` · ${trip.country}` : ''}` };
  const destinationOptions = { ...DESTINATIONS };
  if (!destinationOptions[search.destination]) destinationOptions[search.destination] = destination;
  const noStructuredData = !DESTINATIONS[search.destination];
  return `${progressMarkup(trip)}<div class="section-title"><div><h2>Flight Studio</h2><span class="muted">Ricerca gratuita dimostrativa e previsione collegata a ${esc(scenario.name)}</span></div><button class="btn" data-action="open-flight-help">Come funziona?</button></div><form class="flight-hero" data-form="flight-search"><div class="eyebrow" style="color:#9faaff">Ricerca offerte + previsione</div><h2 style="font-size:22px;margin-top:7px">Confronta le partenze e capisci quando comprare</h2><div class="muted">I risultati sono demo/manuali in questo MVP; i link esterni sono pronti per la verifica reale.</div><div class="flight-controls"><div class="field"><label for="flightDestination">Destinazione</label><select class="select" id="flightDestination" name="destination">${Object.entries(destinationOptions).map(([code, item]) => `<option value="${esc(code)}" ${code === search.destination ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select></div><div class="field"><label for="flightDepartureDate">Partenza</label><input class="input" id="flightDepartureDate" name="departureDate" type="date" value="${search.departureDate || ''}" required></div><div class="field"><label for="flightReturnDate">Ritorno</label><input class="input" id="flightReturnDate" name="returnDate" type="date" value="${search.returnDate || ''}"></div><div class="field"><label for="flightPassengers">Persone</label><input class="input" id="flightPassengers" name="passengers" type="number" min="1" max="20" value="${search.passengers || trip.participants.length}"></div></div>${noStructuredData ? '<div class="reco" style="margin-top:12px"><strong>Dati voli strutturati non ancora disponibili per questa città.</strong>Puoi usare i collegamenti ai venditori oppure inserire offerte manuali; l’app non calcola prezzi inventati.</div>' : ''}<div class="airport-chips" aria-label="Aeroporti di partenza">${Object.entries(AIRPORTS).slice(0, 4).map(([code, label]) => `<button type="button" class="chip ${search.originAirports.includes(code) ? 'active' : ''}" data-action="toggle-origin" data-origin="${code}" aria-pressed="${search.originAirports.includes(code)}">${code} · ${label}</button>`).join('')}</div><div class="inline-actions" style="margin-top:13px"><label style="color:#b7c6dc;font-size:11px"><input type="checkbox" name="directOnly" ${search.directOnly ? 'checked' : ''}> Solo voli diretti</label><button class="btn btn-primary" type="submit" style="margin-left:auto">Aggiorna ricerca e previsione</button></div></form>${forecast ? renderForecastKpis(forecast, search, destination) : '<div class="reco" style="margin-bottom:14px"><strong>Ancora nessuna previsione</strong>Inserisci i parametri e aggiorna la ricerca per calcolare fascia di prezzo, affidabilità e finestra d’acquisto.</div>'}<div class="flight-layout"><div class="panel"><div class="panel-head"><h2>Offerte dentro l’app</h2><span class="muted">${offers.length ? `${offers.length} offerte demo` : 'nessun risultato'}</span></div><div class="filter-bar">${[['all','Tutte'],['lowcost','Low cost'],['regional','Regionali'],['flag','Di bandiera']].map(([key,label]) => `<button class="filter-btn ${activeFlightFilter === key ? 'active' : ''}" data-action="flight-filter" data-filter="${key}">${label}</button>`).join('')}</div>${filtered.length ? filtered.map((offer) => `<div class="offer-row"><div class="row-main"><span class="row-title">${esc(offer.airline)} · ${offer.origin} → ${search.destination}</span><span class="row-meta">${offer.direct ? 'diretto' : '1 scalo'} · ${offer.duration} · ${offer.baggage} · <span class="badge ${offer.type === 'lowcost' ? '' : offer.type === 'flag' ? 'blue' : 'orange'}">${offer.type === 'lowcost' ? 'low cost' : offer.type === 'flag' ? 'bandiera' : 'regionale'}</span></span></div><div class="inline-actions"><div class="row-value">${formatMoney(offer.price)}<small>${offer.price === Math.min(...offers.map((item) => item.price)) ? 'miglior prezzo' : 'per persona'}</small></div><button class="btn btn-sm" data-action="save-offer" data-id="${offer.id}">Salva</button><a class="btn btn-sm" href="${esc(buildAirlineLink(offer, search))}" target="_blank" rel="noreferrer">Apri</a></div></div>`).join('') : '<div class="empty">Nessuna offerta per questo filtro. Prova “Tutte”.</div>'}<div class="external-links"><a target="_blank" rel="noreferrer" href="${esc(buildGoogleLink(search))}">Google Flights ↗</a><a target="_blank" rel="noreferrer" href="${esc(buildSkyscannerLink(search))}">Skyscanner ↗</a><a target="_blank" rel="noreferrer" href="${esc(buildKayakLink(search))}">Kayak ↗</a></div></div><div>${forecast ? renderForecastPanel(forecast, search) : '<div class="panel"><div class="empty">La finestra di acquisto apparirà qui dopo la ricerca.</div></div>'}</div></div>`;
}

function renderForecastKpis(forecast, search, destination) {
  return `<div class="kpi-strip"><div class="kpi"><span>Minimo probabile</span><strong>${formatMoney(forecast.low)}</strong><em>per persona</em></div><div class="kpi highlight"><span>Prezzo tipico</span><strong>${formatMoney(forecast.typical)}</strong><em>${Math.round(forecast.confidence * 100)}% affidabilità</em></div><div class="kpi"><span>Massimo probabile</span><strong>${formatMoney(forecast.high)}</strong><em>fascia storica</em></div><div class="kpi"><span>Attuale migliore</span><strong>${formatMoney(forecast.current)}</strong><em>${search.passengers} persone · ${destination.label.split(' · ')[0]}</em></div></div>`;
}

function renderForecastPanel(forecast) {
  const days = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  const calendar = days.map((day, index) => `<div class="calendar-day ${index >= 1 && index <= 5 ? 'good' : ''} ${index === 3 ? 'best' : ''}"><strong>${forecast.windowDays[index] || 12 + index}</strong>${day}</div>`).join('');
  return `<div class="panel"><div class="panel-head"><h2>Quando comprare</h2><span class="muted">modello baseline v1</span></div><div class="reco"><strong>${forecast.recommendation === 'buy' ? 'Compra ora' : forecast.recommendation === 'wait' ? 'Aspetta e monitora' : 'Monitora'}</strong>${esc(forecast.reason)}</div><div class="forecast-calendar">${calendar}</div><div class="legend"><span><i class="dot"></i>giorno migliore</span><span><i class="dot green"></i>finestra buona</span><span><i class="dot gray"></i>monitorare</span></div><hr class="divider"><div class="row-meta">Finestra consigliata: <strong>${formatDate(forecast.buyWindow.from)} — ${formatDate(forecast.buyWindow.to)}</strong></div><div class="row-meta">Avvisa sotto: <strong>${formatMoney(forecast.alertThreshold)}</strong></div><button class="btn btn-primary" style="width:100%;margin-top:13px" data-action="save-forecast">Salva previsione nello scenario</button></div>`;
}

function renderActuals(trip) {
  const scenario = getScenario(trip);
  const budget = getTripTotals(trip, scenario).total;
  const total = actualTotal(trip);
  const settlement = calculateSettlements(trip);
  return `${progressMarkup(trip)}<div class="section-title"><div><h2>Consuntivo operativo</h2><span class="muted">Modifica le spese durante il viaggio; il preventivo resta la baseline di confronto</span></div><div class="inline-actions"><button class="btn" data-action="add-payment">＋ Registra pagamento</button><button class="btn btn-primary" data-action="add-expense">＋ Aggiungi spesa</button></div></div><div class="grid grid-4"><div class="card soft"><span class="card-label">Speso finora</span><span class="card-value">${formatMoney(total)}</span><span class="card-context">su ${formatMoney(budget)} preventivati</span></div><div class="card"><span class="card-label">Differenza</span><span class="card-value ${budget - total < 0 ? 'money-negative' : 'money-positive'}">${formatMoney(Math.abs(budget - total))}</span><span class="card-context">${budget - total >= 0 ? 'ancora disponibile' : 'oltre budget'}</span></div><div class="card"><span class="card-label">Spese</span><span class="card-value">${trip.actuals.expenses.length}</span><span class="card-context">modificabili e convertite in EUR</span></div><div class="card"><span class="card-label">Da saldare</span><span class="card-value">${settlement.transfers.length}</span><span class="card-context">trasferimenti suggeriti</span></div></div><div class="columns" style="margin-top:16px"><div class="panel"><div class="panel-head"><h2>Spese registrate</h2><span class="muted">valuta di visualizzazione: ${state.displayCurrency}</span></div>${trip.actuals.expenses.length ? `<div class="table-wrap"><table><thead><tr><th>Spesa</th><th>Pagato da</th><th>Condivisa tra</th><th>Importo</th><th></th></tr></thead><tbody>${trip.actuals.expenses.map((expense) => { const payer = trip.participants.find((person) => person.id === expense.paidBy); return `<tr><td><strong>${esc(expense.description)}</strong><small class="row-meta">${CATEGORIES[expense.category]?.label || expense.category} · ${formatDate(expense.date)}${expense.notes ? ` · ${esc(expense.notes)}` : ''}</small></td><td>${esc(payer?.name || '—')}</td><td>${expense.sharedBy.length} persone</td><td><strong>${formatMoney(expense.amountEUR)}</strong><small class="row-meta">${Number(expense.amount).toFixed(2)} ${expense.currency}</small></td><td><div class="table-actions"><button class="btn btn-sm" data-action="edit-expense" data-id="${expense.id}">Modifica</button><button class="btn btn-sm btn-danger" data-action="delete-expense" data-id="${expense.id}">×</button></div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Nessuna spesa ancora. Durante il viaggio puoi aggiungerle, modificarle o cancellarle.</div>'}</div><div>${renderSettlementPanel(trip, settlement)}</div></div>`;
}

function calculateSettlements(trip) {
  const balances = Object.fromEntries(trip.participants.map((person) => [person.id, 0]));
  trip.actuals.expenses.forEach((expense) => {
    const shared = expense.sharedBy?.length ? expense.sharedBy : [expense.paidBy];
    const share = Number(expense.amountEUR || 0) / shared.length;
    balances[expense.paidBy] = (balances[expense.paidBy] || 0) + Number(expense.amountEUR || 0);
    shared.forEach((personId) => { balances[personId] = (balances[personId] || 0) - share; });
  });
  trip.actuals.payments.filter((payment) => payment.confirmed !== false).forEach((payment) => {
    const eur = Number(payment.amountEUR || currencyAmountToEUR(payment.amount, payment.currency || 'EUR'));
    balances[payment.from] = (balances[payment.from] || 0) + eur;
    balances[payment.to] = (balances[payment.to] || 0) - eur;
  });
  const creditors = Object.entries(balances).filter(([, value]) => value > 0.01).map(([id, value]) => ({ id, value })).sort((a, b) => b.value - a.value);
  const debtors = Object.entries(balances).filter(([, value]) => value < -0.01).map(([id, value]) => ({ id, value: -value })).sort((a, b) => b.value - a.value);
  const transfers = [];
  let i = 0; let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].value, creditors[j].value);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].value -= amount; creditors[j].value -= amount;
    if (debtors[i].value < 0.01) i += 1;
    if (creditors[j].value < 0.01) j += 1;
  }
  return { balances, transfers };
}

function renderSettlementPanel(trip, settlement) {
  const personName = (id) => trip.participants.find((person) => person.id === id)?.name || id;
  return `<div class="panel"><div class="panel-head"><h2>Dare / avere</h2><span class="muted">ricalcolato in tempo reale</span></div>${trip.participants.map((person) => { const balance = settlement.balances[person.id] || 0; return `<div class="member-row"><div class="row-main"><span class="row-title">${esc(person.name)}</span><span class="row-meta">${balance > .01 ? 'deve ricevere' : balance < -.01 ? 'deve pagare' : 'in pari'}</span></div><div class="row-value ${balance >= 0 ? 'money-positive' : 'money-negative'}">${formatMoney(Math.abs(balance))}</div></div>`; }).join('')}<hr class="divider"><h3>Trasferimenti suggeriti</h3>${settlement.transfers.length ? settlement.transfers.map((transfer) => `<div class="payment-row"><div class="row-main"><span class="row-title">${esc(personName(transfer.from))} → ${esc(personName(transfer.to))}</span><span class="row-meta">Trasferimento ottimizzato</span></div><div class="row-value">${formatMoney(transfer.amount)}</div></div>`).join('') : '<div class="empty" style="margin-top:10px">Nessun saldo da regolare.</div>'}</div>`;
}

function renderParticipants(trip) {
  return `<div class="section-title"><div><h2>Partecipanti</h2><span class="muted">Le persone che incidono sui calcoli del viaggio</span></div><button class="btn btn-primary" data-action="add-participant">＋ Aggiungi partecipante</button></div><div class="panel"><div class="grid grid-3">${trip.participants.map((person) => `<div class="card"><div class="member-row" style="padding-top:0"><div class="row-main"><span class="row-title">${esc(person.name)}</span><span class="row-meta">${esc(person.email || 'Nessuna email')}</span></div><span class="mini-avatar" style="margin:0">${initials(person.name)}</span></div><hr class="divider"><span class="badge">Partecipante attivo</span></div>`).join('')}</div></div>`;
}

function renderMembers(trip) {
  return `<div class="section-title"><div><h2>Condivisione del viaggio</h2><span class="muted">MVP locale: gli inviti vengono salvati solo in questo browser</span></div><button class="btn btn-primary" data-action="invite-member">＋ Invita persona</button></div><div class="columns"><div class="panel"><div class="panel-head"><h2>Membri autorizzati</h2><span class="muted">${trip.members.length}</span></div>${trip.members.map((member, index) => `<div class="member-row"><div class="row-main"><span class="row-title">${esc(member.name)}</span><span class="row-meta">${esc(member.email)} · ${member.status === 'invited' ? 'invito locale' : 'accesso attivo'}</span></div><div class="inline-actions"><span class="badge ${member.role === 'owner' ? 'blue' : member.role === 'viewer' ? 'orange' : ''}">${member.role}</span>${index ? `<button class="btn btn-sm btn-danger" data-action="remove-member" data-index="${index}">Revoca</button>` : ''}</div></div>`).join('')}</div><div class="panel"><div class="panel-head"><h2>Regole di accesso</h2><span class="badge blue">Privato</span></div><div class="row-meta" style="font-size:12px;line-height:1.6">Owner: gestione completa.<br>Editor: modifica preventivi, voli, spese e commenti.<br>Viewer: sola lettura.<br><br>Un partecipante può incidere sul costo anche senza essere membro dell'app.</div></div></div>`;
}

function renderCurrencies() {
  const catalog = currencyCatalog();
  const countries = state.customCountries || [];
  return `<div class="section-title"><div><h2>Paesi e valute</h2><span class="muted">Configurazioni riutilizzabili nei viaggi</span></div><div class="inline-actions"><div class="field" style="min-width:150px"><label for="displayCurrency">Visualizza importi in</label><select class="select" id="displayCurrency" data-action="display-currency">${Object.entries(catalog).map(([code, meta]) => `<option value="${code}" ${state.displayCurrency === code ? 'selected' : ''}>${code} · ${meta.name}</option>`).join('')}</select></div><button class="btn btn-primary" data-action="add-country">＋ Nuovo paese/valuta</button></div></div><div class="panel"><div class="reco"><strong>Valuta base: EUR</strong>Le spese conservano sempre importo originale, valuta, cambio e conversione EUR. Le configurazioni create qui sono manuali nel prototipo; in seguito potranno essere completate automaticamente da fonti esterne.</div><div class="grid grid-3" style="margin-top:16px">${Object.entries(catalog).map(([code, meta]) => `<div class="card"><span class="card-label">${code}</span><span class="card-value" style="font-size:21px">1 EUR = ${meta.rate} ${meta.symbol}</span><span class="card-context">${meta.name} · ${meta.source || 'fonte demo'}</span></div>`).join('')}</div></div><div class="panel" style="margin-top:16px"><div class="panel-head"><h2>Paesi configurati</h2><span class="muted">${countries.length}</span></div>${countries.length ? countries.map((country) => `<div class="member-row"><div class="row-main"><span class="row-title">${esc(country.name)} · ${esc(country.currency)}</span><span class="row-meta">${esc(country.capital || 'Capitale non indicata')} · ${esc(country.timezone || 'Fuso orario non indicato')} · ${esc(country.flag || '🌍')}</span></div><span class="badge">Configurazione locale</span></div>`).join('') : '<div class="empty">Nessun nuovo paese configurato. Puoi aggiungerlo con il pulsante sopra.</div>'}</div>`;
}

function initials(name = '') { return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

function parseFlightForm(form, trip) {
  const scenario = getScenario(trip);
  const current = scenario.flightSearch || {};
  return { originAirports: current.originAirports?.length ? current.originAirports : ['TRN', 'MXP', 'LIN', 'BGY'], destination: form.querySelector('[name="destination"]').value, departureDate: form.querySelector('[name="departureDate"]').value, returnDate: form.querySelector('[name="returnDate"]').value, passengers: Number(form.querySelector('[name="passengers"]').value) || trip.participants.length, directOnly: form.querySelector('[name="directOnly"]').checked };
}

function searchFlights(search) {
  const destination = DESTINATIONS[search.destination];
  if (!destination) return { offers: [], forecast: null };
  const origins = search.originAirports?.length ? search.originAirports : ['MXP'];
  const originFactor = origins.reduce((sum, origin) => sum + ({ TRN: 1.06, MXP: .98, LIN: 1.03, BGY: .88 }[origin] || 1), 0) / origins.length;
  const days = search.departureDate ? dateDiff(isoDate(), search.departureDate) : 120;
  const leadFactor = days < 45 ? 1.22 : days < 90 ? 1.08 : .96;
  const offers = destination.airlines.flatMap(([airline, type], airlineIndex) => origins.slice(0, 3).map((origin, originIndex) => {
    const direct = airlineIndex !== 2 || origin !== 'TRN';
    const directFactor = search.directOnly && !direct ? 1.34 : 1;
    const noise = ((airlineIndex + 2) * 17 + originIndex * 13 + destination.base) % 31 - 15;
    const price = Math.max(59, Math.round(destination.base * ({ lowcost: .82, regional: 1.02, flag: 1.28 }[type] || 1) * ({ TRN: 1.06, MXP: .98, LIN: 1.03, BGY: .88 }[origin] || 1) * leadFactor * directFactor + noise));
    return { id: uid('offer'), airline, type, origin, price, direct, duration: direct ? `${2 + (originIndex % 2)}h ${20 + airlineIndex * 10}m` : '4h 50m', baggage: type === 'lowcost' ? 'bagaglio base' : 'bagaglio incluso', source: 'Demo provider' };
  }));
  const prices = offers.map((offer) => offer.price).sort((a, b) => a - b);
  const historical = [destination.base * .76, destination.base * .84, destination.base * .92, destination.base, destination.base * 1.05, destination.base * 1.15, destination.base * 1.26].map((value, index) => Math.round(value * originFactor * leadFactor + (index % 2 ? 9 : -6)));
  const all = [...historical, ...prices].sort((a, b) => a - b);
  const current = prices[0] || Math.round(destination.base * originFactor);
  const low = Math.round(quantile(all, .2));
  const typical = Math.round(quantile(all, .5));
  const high = Math.round(quantile(all, .8));
  const confidence = Math.min(.92, Math.max(.48, destination.confidence + (offers.length > 5 ? .04 : 0) - (days > 250 ? .08 : 0)));
  const startOffset = days > 150 ? -110 : -70;
  const endOffset = days > 150 ? -90 : -45;
  const from = datePlus(search.departureDate || datePlus(isoDate(), 120), startOffset);
  const to = datePlus(search.departureDate || datePlus(isoDate(), 120), endOffset);
  const recommendation = current <= low * 1.02 || days < 28 ? 'buy' : current >= typical * 1.18 && days > 75 ? 'wait' : 'monitor';
  const reason = recommendation === 'buy' ? `Il prezzo attuale di ${formatMoney(current)} è vicino al minimo osservato e la partenza è abbastanza vicina.` : recommendation === 'wait' ? `Il prezzo attuale è sopra la fascia tipica. Con ${days} giorni alla partenza c'è ancora spazio per monitorare.` : `Il prezzo attuale è nella fascia normale. La finestra più promettente è tra ${formatDate(from)} e ${formatDate(to)}.`;
  return { offers, forecast: { current, low, typical, high, confidence, recommendation, reason, buyWindow: { from, to }, alertThreshold: Math.round(low * .98), windowDays: [12, 13, 14, 15, 16, 17, 18], calculatedAt: new Date().toISOString() } };
}

function quantile(values, q) {
  if (!values.length) return 0;
  const position = (values.length - 1) * q;
  const lower = Math.floor(position); const upper = Math.ceil(position);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (position - lower);
}

function buildGoogleLink(search) { return `https://www.google.com/travel/flights?q=${encodeURIComponent(`flights from ${search.originAirports[0]} to ${search.destination}`)}&curr=EUR`; }
function buildSkyscannerLink(search) { return `https://www.skyscanner.it/transport/flights/${search.originAirports[0]}/${search.destination}/${(search.departureDate || '').replaceAll('-', '')}/${(search.returnDate || '').replaceAll('-', '')}/`; }
function buildKayakLink(search) { return `https://www.kayak.it/flights/${search.originAirports[0]}-${search.destination}/${(search.departureDate || '').replaceAll('-', '')}/${(search.returnDate || '').replaceAll('-', '')}`; }
function buildAirlineLink(offer, search) { return buildGoogleLink({ ...search, originAirports: [offer.origin] }); }

function openModal(title, body) {
  document.getElementById('modalRoot').innerHTML = `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="modal-close" data-action="close-modal" aria-label="Chiudi">×</button></div>${body}</div></div>`;
}

function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }

function openScenarioModal(id = null) {
  const trip = getTrip(); const scenario = id ? trip.scenarios.find((item) => item.id === id) : null;
  openModal(scenario ? 'Modifica scenario' : 'Nuovo scenario', `<form data-form="scenario"><input type="hidden" name="id" value="${scenario?.id || ''}"><div class="form-grid"><div class="field full"><label>Nome</label><input class="input" name="name" required value="${esc(scenario?.name || '')}" placeholder="es. Comfort con volo diretto"></div><div class="field full"><label>Note</label><textarea class="textarea" name="notes" placeholder="Cosa distingue questo scenario?">${esc(scenario?.notes || '')}</textarea></div></div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Annulla</button><button class="btn btn-primary" type="submit">Salva scenario</button></div></form>`);
}

function openBudgetLineModal() {
  openModal('Aggiungi voce al preventivo', `<form data-form="budget-line"><div class="form-grid"><div class="field"><label>Categoria</label><select class="select" name="category">${Object.entries(CATEGORIES).map(([code, item]) => `<option value="${code}">${item.icon} ${item.label}</option>`).join('')}</select></div><div class="field"><label>Importo</label><input class="input" name="amount" type="number" min="0" step="0.01" required placeholder="0,00"></div><div class="field"><label>Descrizione</label><input class="input" name="label" required placeholder="es. Casa a Tbilisi"></div><div class="field"><label>Valuta</label><select class="select" name="currency">${Object.keys(currencyCatalog()).map((code) => `<option value="${code}">${code}</option>`).join('')}</select></div><div class="field"><label>Calcolo</label><select class="select" name="allocation"><option value="total">Totale</option><option value="perPerson">Per persona</option><option value="perNight">Per notte</option></select></div><div class="field"><label>Note</label><input class="input" name="notes" placeholder="facoltative"></div></div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Annulla</button><button class="btn btn-primary" type="submit">Aggiungi voce</button></div></form>`);
}

function openExpenseModal(id = null) {
  const trip = getTrip(); const expense = id ? trip.actuals.expenses.find((item) => item.id === id) : null;
  const selected = expense?.sharedBy || trip.participants.map((person) => person.id);
  openModal(expense ? 'Modifica spesa' : 'Nuova spesa', `<form data-form="expense"><input type="hidden" name="id" value="${expense?.id || ''}"><div class="form-grid"><div class="field full"><label>Descrizione</label><input class="input" name="description" required value="${esc(expense?.description || '')}" placeholder="es. Cena a Bergen"></div><div class="field"><label>Categoria</label><select class="select" name="category">${Object.entries(CATEGORIES).map(([code, item]) => `<option value="${code}" ${expense?.category === code ? 'selected' : ''}>${item.icon} ${item.label}</option>`).join('')}</select></div><div class="field"><label>Data</label><input class="input" type="date" name="date" required value="${expense?.date || isoDate()}"></div><div class="field"><label>Importo</label><input class="input" type="number" min="0" step="0.01" name="amount" required value="${expense?.amount ?? ''}"></div><div class="field"><label>Valuta</label><select class="select" name="currency">${Object.keys(currencyCatalog()).map((code) => `<option value="${code}" ${expense?.currency === code ? 'selected' : ''}>${code}</option>`).join('')}</select></div><div class="field full"><label>Pagato da</label><select class="select" name="paidBy">${trip.participants.map((person) => `<option value="${person.id}" ${expense?.paidBy === person.id ? 'selected' : ''}>${esc(person.name)}</option>`).join('')}</select></div><div class="field full"><label>Condivisa tra</label><div class="check-grid">${trip.participants.map((person) => `<label class="check"><input type="checkbox" name="sharedBy" value="${person.id}" ${selected.includes(person.id) ? 'checked' : ''}>${esc(person.name)}</label>`).join('')}</div></div><div class="field full"><label>Note</label><textarea class="textarea" name="notes" placeholder="facoltative">${esc(expense?.notes || '')}</textarea></div></div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Annulla</button><button class="btn btn-primary" type="submit">Salva spesa</button></div></form>`);
}

function openParticipantModal() {
  openModal('Aggiungi partecipante', `<form data-form="participant"><div class="form-grid"><div class="field"><label>Nome</label><input class="input" name="name" required placeholder="Nome Cognome"></div><div class="field"><label>Email</label><input class="input" name="email" type="email" placeholder="facoltativa"></div></div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Annulla</button><button class="btn btn-primary" type="submit">Aggiungi</button></div></form>`);
}

function openMemberModal() {
  openModal('Aggiungi persona al viaggio', `<form data-form="member"><div class="form-grid"><div class="field full"><label>Nome e cognome</label><input class="input" name="name" required placeholder="Nome Cognome"></div><div class="field"><label>Email</label><input class="input" name="email" type="email" placeholder="facoltativa"></div><div class="field"><label>Accesso provvisorio</label><select class="select" name="role"><option value="editor">Editor</option><option value="viewer">Viewer · sola lettura</option></select></div></div><div class="reco" style="margin-top:14px"><strong>MVP locale</strong>Nome ed email sono salvati solo in questo browser. L'email è facoltativa; l'invito reale via link sarà collegato al backend futuro.</div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Annulla</button><button class="btn btn-primary" type="submit">Salva persona</button></div></form>`);
}

function openCountryModal() {
  openModal('Nuovo paese e valuta', `<form data-form="country"><div class="form-grid"><div class="field full"><label>Nome paese</label><input class="input" name="name" required placeholder="es. Giappone"></div><div class="field"><label>Codice valuta</label><input class="input" name="currency" required maxlength="3" pattern="[A-Za-z]{3}" placeholder="JPY"></div><div class="field"><label>Nome valuta</label><input class="input" name="currencyName" required placeholder="Yen giapponese"></div><div class="field"><label>Simbolo</label><input class="input" name="symbol" required maxlength="4" placeholder="¥"></div><div class="field"><label>1 EUR equivale a</label><input class="input" name="rate" type="number" min="0.000001" step="0.000001" required placeholder="160"></div><div class="field"><label>Capitale</label><input class="input" name="capital" placeholder="Tokyo"></div><div class="field"><label>Fuso orario</label><input class="input" name="timezone" placeholder="Asia/Tokyo"></div><div class="field"><label>Bandiera</label><input class="input" name="flag" maxlength="4" placeholder="🇯🇵"></div></div><div class="reco" style="margin-top:14px"><strong>Configurazione manuale</strong>Nel prototipo inserisci il cambio manualmente. Nella versione online il sistema potrà recuperare automaticamente valuta, cambio e informazioni del paese.</div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Annulla</button><button class="btn btn-primary" type="submit">Salva paese</button></div></form>`);
}

function openTripModal() {
  openModal('Crea un nuovo viaggio', `<form data-form="trip"><div class="form-grid"><div class="field full"><label>Nome del viaggio</label><input class="input" name="name" required placeholder="es. Croazia 2028"></div><div class="field full"><label for="newTripCountry">Nazione</label><input class="input" id="newTripCountry" name="country" list="newTripCountryOptions" autocomplete="off" required placeholder="es. Croazia"><datalist id="newTripCountryOptions">${countryOptionsMarkup()}</datalist><span id="newTripCountryHint" class="row-meta country-hint">Seleziona una nazione riconosciuta per attivare la ricerca delle città.</span></div><div class="field full"><label for="newTripCity">Città / destinazione</label><input class="input" id="newTripCity" name="city" list="newTripCityOptions" autocomplete="off" required disabled placeholder="Prima seleziona la nazione"><datalist id="newTripCityOptions"></datalist><span class="row-meta">I suggerimenti vengono cercati online mentre digiti.</span></div><div id="newTripRateWrap" class="field full" hidden><label for="newTripManualRate">Cambio manuale</label><input class="input" id="newTripManualRate" name="manualRate" type="number" min="0.000001" step="0.000001" placeholder="1 EUR = ... valuta locale"><span class="row-meta">Compare solo se la fonte automatica del cambio non è disponibile.</span></div><div class="field"><label>Partecipanti iniziali</label><input class="input" name="participants" type="number" min="1" max="20" value="2"></div><div class="field"><label>Data partenza</label><input class="input" name="startDate" type="date" required value="${datePlus(isoDate(), 90)}"></div><div class="field"><label>Data ritorno</label><input class="input" name="endDate" type="date" required value="${datePlus(isoDate(), 98)}"></div></div><div class="reco" style="margin-top:14px"><strong>Anagrafica automatica</strong>La nazione selezionata aggiungerà o aggiornerà valuta, cambio EUR, capitale, fuso orario e bandiera nella sezione Paesi e valute.</div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Annulla</button><button class="btn btn-primary" type="submit">Crea viaggio</button></div></form>`);
  loadCountryDirectory();
}

function openPaymentModal() {
  const trip = getTrip();
  openModal('Registra pagamento', `<form data-form="payment"><div class="form-grid"><div class="field"><label>Da</label><select class="select" name="from">${trip.participants.map((person) => `<option value="${person.id}">${esc(person.name)}</option>`).join('')}</select></div><div class="field"><label>A</label><select class="select" name="to">${trip.participants.map((person) => `<option value="${person.id}">${esc(person.name)}</option>`).join('')}</select></div><div class="field"><label>Importo</label><input class="input" name="amount" type="number" min="0" step="0.01" required></div><div class="field"><label>Valuta</label><select class="select" name="currency">${Object.keys(currencyCatalog()).map((code) => `<option value="${code}">${code}</option>`).join('')}</select></div><div class="field full"><label>Data</label><input class="input" name="date" type="date" value="${isoDate()}"></div></div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Annulla</button><button class="btn btn-primary" type="submit">Registra pagamento</button></div></form>`);
}

function showFlightHelp() { openModal('Come funziona la previsione', `<p class="muted" style="font-size:13px;line-height:1.6">Questo MVP usa offerte dimostrative e una baseline statistica. Il prezzo tipico deriva dalla mediana di osservazioni simili; la finestra di acquisto usa i giorni alla partenza e una finestra di lead time. Quando collegheremo un provider, le offerte reali alimenteranno automaticamente lo storico.</p><div class="reco"><strong>Importante</strong>La raccomandazione è un supporto decisionale, non una garanzia sul prezzo futuro.</div><div class="form-actions"><button class="btn btn-primary" data-action="close-modal">Ho capito</button></div>`); }

function showShareLink(url) {
  openModal('Condividi viaggio', `<p class="muted" style="font-size:13px;line-height:1.6">Condividi questo link con i Traveller. Il link contiene il token del viaggio: chi lo possiede può accedere alle funzioni previste dal prototipo online.</p><div class="field"><label>Link condivisibile</label><input class="input" value="${esc(url)}" readonly></div><div class="form-actions"><button class="btn" data-action="copy-share-link" data-url="${esc(url)}">Copia link</button><button class="btn btn-primary" data-action="close-modal">Chiudi</button></div>`);
}

async function createOrShowShareLink(trip) {
  const cloud = window.TravelNextCloud;
  if (!cloud?.configured) {
    state.activeView = 'members';
    persist();
    render();
    toast('Configura prima il nuovo progetto Supabase per creare un link online', 'error');
    return;
  }
  try {
    let token = cloud.shareToken;
    if (!token) {
      const result = await cloud.createTrip(trip);
      token = result.token;
      const url = `${window.location.href.split('?')[0].split('#')[0]}?trip=${encodeURIComponent(token)}`;
      window.history.replaceState({}, '', url);
      showShareLink(url);
      return;
    }
    showShareLink(`${window.location.href.split('?')[0].split('#')[0]}?trip=${encodeURIComponent(token)}`);
  } catch (error) {
    toast(`Impossibile creare il link: ${error.message}`, 'error');
  }
}

async function loadCloudTripFromLink() {
  const cloud = window.TravelNextCloud;
  if (!cloud?.configured || !cloud.shareToken) return;
  try {
    const remoteTrip = await cloud.loadTrip();
    if (!remoteTrip) return;
    state.trips = [remoteTrip];
    state.activeTripId = remoteTrip.id;
    state.activeView = 'overview';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    toast('Viaggio online caricato');
  } catch (error) {
    toast(`Impossibile caricare il viaggio online: ${error.message}`, 'error');
  }
}

function importNormalizedFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (payload.format !== 'travel-business-case-anonymized-v1' || !payload.trip) throw new Error('Formato non riconosciuto');
      const importedTrip = payload.trip;
      importedTrip.id = uid('imported-trip');
      importedTrip.name = `${importedTrip.name || 'Viaggio importato'} · dati anonimizzati`;
      state.trips.push(importedTrip);
      state.activeTripId = importedTrip.id;
      state.activeView = 'overview';
      persist();
      render();
      toast('Dati anonimizzati importati come nuovo viaggio');
    } catch (error) {
      toast(`Importazione non riuscita: ${error.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

function handleAction(element) {
  const action = element.dataset.action;
  const trip = getTrip();
  if (action === 'navigate') { state.activeView = element.dataset.view; persist(); render(); return; }
  if (action === 'close-modal') { closeModal(); return; }
  if (action === 'share') { createOrShowShareLink(trip); return; }
  if (action === 'copy-share-link') { navigator.clipboard?.writeText(element.dataset.url).then(() => toast('Link copiato')).catch(() => toast('Seleziona e copia il link manualmente', 'error')); return; }
  if (action === 'invite-member') { state.activeView = 'members'; persist(); render(); openMemberModal(); return; }
  if (action === 'add-country') { state.activeView = 'currencies'; persist(); render(); openCountryModal(); return; }
  if (action === 'new-trip') { openTripModal(); return; }
  if (action === 'delete-trip') {
    // La cancellazione online richiederà una RPC amministrativa dedicata.
    // Evitiamo quindi di cancellare localmente una copia aperta tramite link
    // condiviso, lasciando intatto il viaggio nel database.
    if (window.TravelNextCloud?.shareToken) {
      toast('La cancellazione dei viaggi online sarà disponibile con il ruolo Amministratore', 'error');
      return;
    }
    if (state.trips.length <= 1) {
      toast('Deve rimanere almeno un viaggio nel prototipo', 'error');
      return;
    }
    const tripToDelete = getTrip();
    if (!tripToDelete || !confirm(`Eliminare definitivamente “${tripToDelete.name}” da questo browser?`)) return;
    state.trips = state.trips.filter((item) => item.id !== tripToDelete.id);
    state.activeTripId = state.trips[0].id;
    state.activeView = 'overview';
    persist();
    render();
    toast('Viaggio eliminato da questo browser');
    return;
  }
  if (action === 'new-scenario') { openScenarioModal(); return; }
  if (action === 'edit-scenario') { openScenarioModal(element.dataset.id); return; }
  if (action === 'select-scenario') { trip.activeScenarioId = element.dataset.id; state.activeView = 'scenarios'; persist(); render(); toast('Scenario attivo aggiornato'); return; }
  if (action === 'duplicate-scenario') { const source = trip.scenarios.find((item) => item.id === element.dataset.id); if (!source) return; const copy = JSON.parse(JSON.stringify(source)); copy.id = uid('scenario'); copy.name = `${copy.name} (Copia)`; copy.budgetLines = copy.budgetLines.map((line) => ({ ...line, id: uid('line') })); trip.scenarios.push(copy); persist(); render(); toast('Scenario duplicato'); return; }
  if (action === 'add-budget-line') { openBudgetLineModal(); return; }
  if (action === 'delete-budget-line') { const scenario = getScenario(trip); scenario.budgetLines = scenario.budgetLines.filter((line) => line.id !== element.dataset.id); persist(); render(); toast('Voce rimossa'); return; }
  if (action === 'toggle-origin') { const scenario = getScenario(trip); scenario.flightSearch ||= { originAirports: [], destination: trip.destinationCode, departureDate: trip.startDate, returnDate: trip.endDate, passengers: trip.participants.length, directOnly: false }; const origins = scenario.flightSearch.originAirports; const origin = element.dataset.origin; scenario.flightSearch.originAirports = origins.includes(origin) ? origins.filter((item) => item !== origin) : [...origins, origin]; persist(); render(); return; }
  if (action === 'flight-filter') { activeFlightFilter = element.dataset.filter; render(); return; }
  if (action === 'open-flight-help') { showFlightHelp(); return; }
  if (action === 'import-data') { document.getElementById('importJsonFile')?.click(); return; }
  if (action === 'save-forecast') { const scenario = getScenario(trip); if (!scenario.flightForecast) return; scenario.budgetLines = scenario.budgetLines.filter((line) => line.category !== 'flight'); scenario.budgetLines.unshift(makeLine('flight', 'Voli', scenario.flightForecast.typical, 'Previsione collegata · prezzo tipico')); scenario.budgetLines[0].linkedForecastId = scenario.flightForecast.id || uid('forecast'); persist(); render(); toast('Previsione salvata nel preventivo'); return; }
  if (action === 'save-offer') { toast('Offerta salvata nello scenario'); return; }
  if (action === 'add-expense') { openExpenseModal(); return; }
  if (action === 'edit-expense') { openExpenseModal(element.dataset.id); return; }
  if (action === 'delete-expense') { if (!confirm('Vuoi eliminare questa spesa?')) return; trip.actuals.expenses = trip.actuals.expenses.filter((expense) => expense.id !== element.dataset.id); persist(); render(); toast('Spesa eliminata'); return; }
  if (action === 'add-payment') { openPaymentModal(); return; }
  if (action === 'add-participant') { openParticipantModal(); return; }
  if (action === 'remove-member') { trip.members.splice(Number(element.dataset.index), 1); persist(); render(); toast('Accesso revocato'); return; }
}

async function handleForm(form) {
  const trip = getTrip();
  if (form.dataset.form === 'trip') {
    const data = new FormData(form);
    const country = findCountry(data.get('country'));
    const city = String(data.get('city') || '').trim();
    if (!country) { toast('Seleziona una nazione riconosciuta dall’elenco', 'error'); return; }
    if (!city) { toast('Inserisci una città o destinazione', 'error'); return; }
    let enrichedCountry;
    try {
      enrichedCountry = await enrichCountryExchangeRate(country);
    } catch (error) {
      const manualRate = Number(data.get('manualRate'));
      if (!Number.isFinite(manualRate) || manualRate <= 0) {
        const manualRateField = document.getElementById('newTripRateWrap');
        if (manualRateField) manualRateField.hidden = false;
        toast(`Cambio automatico non disponibile. Inserisci il cambio manuale e riprova.`, 'error');
        return;
      }
      enrichedCountry = { ...country, rate: manualRate, rateSource: 'inserito manualmente' };
    }
    const legacyDestination = Object.entries(DESTINATIONS).find(([, item]) => normalizeSearchText(item.label.split(' · ')[0]) === normalizeSearchText(city));
    const destinationCode = legacyDestination?.[0] || city;
    const destinationData = legacyDestination?.[1] || null;
    const count = Math.max(1, Number(data.get('participants')) || 2);
    const participants = Array.from({ length: count }, (_, index) => ({ id: uid('participant'), name: index === 0 ? 'Io' : `Partecipante ${index + 1}`, email: '' }));
    const initialLines = destinationData ? [makeLine('flight', 'Voli', destinationData.base, 'Stima iniziale')] : [];
    const scenario = makeScenario('Scenario iniziale', initialLines, destinationData ? 'Scenario creato automaticamente.' : 'Inserisci offerte voli reali o collegamenti al venditore.');
    const countryName = country.italianName || country.name;
    const newTrip = { id: uid('trip'), name: data.get('name'), destination: city, country: countryName, countryCode: country.code, destinationCode, startDate: data.get('startDate'), endDate: data.get('endDate'), baseCurrency: 'EUR', participants, members: [{ name: 'Io', email: '', role: 'owner', status: 'active' }], scenarios: [scenario], activeScenarioId: scenario.id, actuals: { expenses: [], payments: [] } };
    state.customCurrencies ||= {};
    if (enrichedCountry.currency) state.customCurrencies[enrichedCountry.currency] = { name: enrichedCountry.currencyName, symbol: enrichedCountry.symbol, rate: enrichedCountry.rate, source: enrichedCountry.rateSource };
    state.customCountries = (state.customCountries || []).filter((item) => item.currency !== enrichedCountry.currency && item.name !== countryName);
    state.customCountries.push({ id: uid('country'), name: countryName, currency: enrichedCountry.currency, capital: enrichedCountry.capital || '', timezone: enrichedCountry.timezone || '', flag: enrichedCountry.flag || '🌍' });
    state.trips.push(newTrip); state.activeTripId = newTrip.id; state.activeView = 'overview'; persist(); closeModal(); render(); toast(`Viaggio creato · anagrafica ${countryName} aggiornata`); return;
  }
  if (form.dataset.form === 'scenario') {
    const data = new FormData(form); const id = data.get('id');
    if (id) { const scenario = trip.scenarios.find((item) => item.id === id); scenario.name = data.get('name'); scenario.notes = data.get('notes'); scenario.updatedAt = new Date().toISOString(); toast('Scenario aggiornato'); }
    else { const scenario = makeScenario(data.get('name'), [], data.get('notes')); trip.scenarios.push(scenario); trip.activeScenarioId = scenario.id; toast('Scenario creato'); }
    persist(); closeModal(); render(); return;
  }
  if (form.dataset.form === 'budget-line') {
    const data = new FormData(form); const scenario = getScenario(trip); scenario.budgetLines.push({ id: uid('line'), category: data.get('category'), label: data.get('label'), amount: Number(data.get('amount')), currency: data.get('currency'), allocation: data.get('allocation'), source: 'manual', notes: data.get('notes'), linkedForecastId: null }); persist(); closeModal(); render(); toast('Voce aggiunta al preventivo'); return;
  }
  if (form.dataset.form === 'flight-search') {
    const scenario = getScenario(trip); const search = parseFlightForm(form, trip); if (!search.originAirports?.length) { toast('Seleziona almeno un aeroporto di partenza', 'error'); return; } const result = searchFlights(search); scenario.flightSearch = search; scenario.flightOffers = result.offers; scenario.flightForecast = result.forecast ? { ...result.forecast, id: scenario.flightForecast?.id || uid('forecast') } : null; scenario.updatedAt = new Date().toISOString(); persist(); render(); toast(result.forecast ? 'Ricerca e previsione aggiornate' : 'Ricerca salvata: dati strutturati non disponibili per questa città'); return;
  }
  if (form.dataset.form === 'expense') {
    const data = new FormData(form); const sharedBy = data.getAll('sharedBy'); if (!sharedBy.length) { toast('Seleziona almeno un partecipante', 'error'); return; } const expense = { id: data.get('id') || uid('expense'), description: data.get('description'), category: data.get('category'), amount: Number(data.get('amount')), currency: data.get('currency'), amountEUR: currencyAmountToEUR(data.get('amount'), data.get('currency')), date: data.get('date'), paidBy: data.get('paidBy'), sharedBy, notes: data.get('notes'), splitEqually: true }; const index = trip.actuals.expenses.findIndex((item) => item.id === expense.id); if (index >= 0) trip.actuals.expenses[index] = expense; else trip.actuals.expenses.unshift(expense); persist(); closeModal(); render(); toast(index >= 0 ? 'Spesa aggiornata' : 'Spesa registrata'); return;
  }
  if (form.dataset.form === 'participant') {
    const data = new FormData(form); trip.participants.push({ id: uid('participant'), name: data.get('name'), email: data.get('email') }); persist(); closeModal(); render(); toast('Partecipante aggiunto'); return;
  }
  if (form.dataset.form === 'member') {
    const data = new FormData(form); trip.members.push({ name: data.get('name'), email: data.get('email') || '', role: data.get('role'), status: 'invited' }); persist(); closeModal(); render(); toast('Persona aggiunta al viaggio'); return;
  }
  if (form.dataset.form === 'country') {
    const data = new FormData(form);
    const code = String(data.get('currency') || '').trim().toUpperCase();
    const rate = Number(data.get('rate'));
    if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(rate) || rate <= 0) { toast('Inserisci un codice valuta di 3 lettere e un cambio valido', 'error'); return; }
    if (currencyCatalog()[code] && !state.customCurrencies[code]) { toast(`${code} è già presente nella rubrica valute`, 'error'); return; }
    state.customCurrencies[code] = { name: data.get('currencyName'), symbol: data.get('symbol'), rate, source: 'inserita manualmente' };
    state.customCountries = (state.customCountries || []).filter((country) => country.currency !== code && country.name.toLowerCase() !== String(data.get('name')).trim().toLowerCase());
    state.customCountries.push({ id: uid('country'), name: data.get('name'), currency: code, capital: data.get('capital') || '', timezone: data.get('timezone') || '', flag: data.get('flag') || '🌍' });
    state.displayCurrency = code;
    persist(); closeModal(); render(); toast('Paese e valuta salvati'); return;
  }
  if (form.dataset.form === 'payment') {
    const data = new FormData(form); if (data.get('from') === data.get('to')) { toast('Da e A devono essere persone diverse', 'error'); return; } trip.actuals.payments.push({ id: uid('payment'), from: data.get('from'), to: data.get('to'), amount: Number(data.get('amount')), currency: data.get('currency'), amountEUR: currencyAmountToEUR(data.get('amount'), data.get('currency')), date: data.get('date'), confirmed: true }); persist(); closeModal(); render(); toast('Pagamento registrato'); return;
  }
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  // Il backdrop chiude la finestra solo quando viene cliccato direttamente.
  // I controlli dentro il modal (input, select, pulsanti) non devono
  // propagare quel comportamento al backdrop.
  if (action?.dataset.action === 'close-modal'
      && action.classList.contains('modal-backdrop')
      && event.target !== action) return;
  if (action) handleAction(action);
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  handleForm(form);
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'newTripCountry' || event.target.id === 'newTripCity') scheduleCitySearch();
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'tripPicker') { state.activeTripId = event.target.value; state.activeView = 'overview'; activeFlightFilter = 'all'; persist(); render(); }
  if (event.target.id === 'displayCurrency') { state.displayCurrency = event.target.value; persist(); render(); }
  if (event.target.id === 'newTripCountry' || event.target.id === 'newTripCity') scheduleCitySearch();
  if (event.target.id === 'importJsonFile' && event.target.files?.[0]) importNormalizedFile(event.target.files[0]);
});

function render() {
  renderShell();
}

function init() {
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  loadCloudTripFromLink();
}

init();
