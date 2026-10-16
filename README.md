# Intelligent Voyager — MVP free-first

Questa è una nuova applicazione indipendente dall'applicazione esistente.
Il contenuto corrente è un MVP free-first pronto per un primo hosting statico.
Non è ancora il prodotto definitivo per uso pubblico su larga scala.

La specifica tecnica di riferimento è
[`SPECIFICA_TECNICA_MVP.md`](SPECIFICA_TECNICA_MVP.md). Il prototipo corrente
contiene ancora alcune scelte provvisorie e non deve essere considerato il
modello definitivo del prodotto.

## Avvio senza terminale

Apri con doppio clic il file [`index.html`](index.html), oppure trascinalo in
un browser. Il prototipo funziona in modalità locale e salva i dati demo nel
`localStorage` del browser.

In questa modalità il service worker/PWA non viene attivato: è normale e non
impedisce di provare l'interfaccia. L'installazione PWA e la collaborazione via
Internet arriveranno nell'ambiente web pubblicato.

I dati locali vengono salvati nel `localStorage` del browser. Quando l'app è
pubblicata via HTTPS, il service worker/PWA viene registrato e la condivisione
tramite il nuovo progetto Supabase può essere usata dal pulsante **Condividi**.

## Cosa include attualmente

- più viaggi separati, ciascuno con i propri partecipanti e membri;
- scenari dimostrativi di preventivo;
- categorie di budget per voli, casa, auto, cibo, attività e altro;
- Flight Studio dimostrativo con dati sintetici dichiarati come demo;
- finestra consigliata per l'acquisto dei voli;
- consuntivo modificabile durante il viaggio;
- divisione delle spese tra partecipanti;
- calcolo dare/avere e trasferimenti suggeriti;
- valute EUR, NOK, USD, GBP e CHF;
- inviti locali dimostrativi, predisposti per il backend futuro.
- creazione di un viaggio con nazione e città;
- anagrafica automatica di valuta, cambio, capitale, fuso orario e bandiera;
- suggerimenti online delle città della nazione selezionata.

## Limiti intenzionali dell'MVP

- le offerte voli sono dimostrative: non vengono fatte richieste a siti esterni
  e non rappresentano prezzi reali;
- i link a Google Flights, Skyscanner e Kayak sono disponibili come fallback;
- la condivisione è locale e non crea ancora account reali;
- le quotazioni valutarie sono statiche di demo e non devono essere usate per
  decisioni economiche reali;

Per l'implementazione dell'MVP non usare questo prototipo come fonte dati e non
collegarlo al database dell'applicazione originale.

## Importazione di scenari anonimizzati

Apri [`IMPORTA_DATI.html`](IMPORTA_DATI.html), seleziona l'export JSON
dell'applicazione originale e scarica il file anonimizzato. I nomi vengono
sostituiti localmente con `Traveller 1`, `Traveller 2`, ecc.

Poi apri [`index.html`](index.html), premi **Importa JSON** e seleziona il file
generato. L'importazione crea un nuovo viaggio e non sovrascrive i viaggi già
presenti nel browser.

## Collegamento al nuovo database

Per preparare il collegamento senza terminale apri
[`CONFIGURA_ONLINE.html`](CONFIGURA_ONLINE.html). Prima devi avere creato il
nuovo progetto Supabase e applicato lo schema indicato in
[`PUBBLICAZIONE_ONLINE.md`](PUBBLICAZIONE_ONLINE.md).
