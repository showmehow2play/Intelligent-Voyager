# Intelligent Voyager

## Specifica tecnica MVP — versione 0.1

Stato: base per l'implementazione, non ancora collegata a servizi di produzione.

Questa applicazione è indipendente dall'applicazione originale. La cartella
`applicazione già esistente/` è solo materiale di riferimento e non deve essere
importata, modificata o collegata al nuovo database.

## 1. Obiettivo tecnico

Realizzare una PWA web mobile-first che permetta a un gruppo di amici di:

- creare e condividere un viaggio tramite link;
- collaborare su un unico preventivo con proposte e simulazioni;
- registrare spese future ed effettive;
- collegare automaticamente, con conferma, preventivo e consuntivo;
- registrare pagamenti confermati o in sospeso;
- calcolare saldo attuale, saldo previsto e crediti;
- usare una ricerca voli verificabile, con inserimento manuale come fallback;
- consultare attività, report ed esportazioni.

## 2. Stack e ambienti

### Frontend

- Next.js e TypeScript;
- interfaccia responsive mobile-first;
- PWA installabile facoltativamente;
- validazione dei moduli lato client e lato server;
- nessun dato di mercato hard-coded presentato come reale.

### Backend

- nuovo progetto Supabase, separato da qualunque progetto esistente;
- PostgreSQL per i dati relazionali;
- Edge Functions o API server-side per operazioni privilegiate;
- Row Level Security per limitare l'accesso al viaggio;
- adapter indipendenti per voli, cambio valuta e dati paese.

### Pubblicazione

- ambiente locale per sviluppo;
- ambiente staging con dati sintetici;
- ambiente production separato;
- hosting frontend compatibile con Next.js, inizialmente su piano gratuito se i
  limiti e le condizioni lo consentono;
- nessun deploy production in questa fase.

## 3. Identità e accesso

L'MVP non richiede account e password ai Traveller.

### Travel Maker e amministratore

Il primo accesso crea un'identità locale con:

- nome visualizzato;
- identificativo stabile;
- codice di recupero mostrato una sola volta e salvabile dall'utente;
- codice memorizzato solo come hash sul backend.

L'amministratore può recuperare o trasferire l'identità del Travel Maker dopo
una procedura esplicita. L'architettura deve poter sostituire in futuro questa
identità con account, email, passkey o magic link.

### Traveller tramite link

Ogni viaggio dispone di un token casuale distinto. Il token:

- non contiene nomi o dati personali;
- non è indicizzato dai motori di ricerca;
- consente la consultazione del viaggio;
- richiede la selezione di un Traveller prima di salvare una modifica;
- non scade nell'MVP, secondo decisione di prodotto.

Il link è un segreto condiviso, non una prova certa dell'identità della
persona. Il limite deve essere comunicato nell'interfaccia.

## 4. Modello di dominio

Gli identificativi sono sempre stabili e indipendenti dal nome visualizzato.

### Entità principali

- `app_admin`: amministratore unico;
- `local_identity`: identità locale del Travel Maker o del dispositivo;
- `traveller`: rubrica globale con nome, cognome, soprannome, email e telefono;
- `trip`: viaggio, stato, date, destinazione e token di accesso;
- `trip_traveller`: partecipazione di un Traveller al viaggio;
- `trip_role`: ruolo nel viaggio, principalmente Travel Maker o Traveller;
- `budget`: unico preventivo del viaggio;
- `proposal`: proposta di una categoria o di un'opzione;
- `proposal_group`: categoria con regola di selezione;
- `simulation`: configurazione personale salvata;
- `simulation_selection`: opzioni selezionate nella simulazione;
- `official_configuration`: configurazione ufficiale corrente e suoi snapshot;
- `expense`: spesa futura o effettiva;
- `expense_participant`: partecipanti a una singola spesa;
- `payment`: pagamento collegato a una spesa;
- `notification`: attività del viaggio, con stato di lettura per destinatario;
- `country_configuration`: paese riutilizzabile, valuta e dati descrittivi;
- `exchange_rate`: tasso con fonte, data e modalità automatica/manuale;
- `flight_search`: parametri di una ricerca reale;
- `flight_offer`: offerta restituita o inserita manualmente;
- `price_observation`: osservazione storica verificabile;
- `report_snapshot`: dati utilizzati per un report archiviato.

## 5. Regole di business implementative

### Viaggio

- Ogni viaggio ha un solo preventivo.
- Ogni viaggio può avere un solo consuntivo.
- Il Travel Maker può creare più viaggi.
- Il Travel Maker può aggiungere Traveller dalla rubrica o crearli al volo.
- Un Traveller con spese o pagamenti non può essere rimosso dal consuntivo.
- Un Traveller senza spese o pagamenti può essere rimosso dal viaggio.
- Le sue proposte e simulazioni non vengono cancellate automaticamente.
- L'amministratore può eliminare definitivamente il viaggio.

### Proposte e simulazioni

- Chi crea una proposta definisce la regola di selezione della categoria.
- Una categoria può consentire una selezione singola o multipla.
- Le selezioni multiple vengono sommate.
- Il totale viene diviso tra tutti i Traveller del viaggio.
- Una configurazione ufficiale può essere incompleta, ma deve essere segnalata.
- Le simulazioni personali si salvano esplicitamente.
- Le simulazioni condivise sono visibili a tutti i Traveller del viaggio.
- La configurazione ufficiale è l'unica usata nel confronto finale col consuntivo.

### Spese

- L'autore della spesa e il pagante sono campi distinti.
- I partecipanti della spesa possono essere un sottoinsieme dei Traveller.
- Una spesa futura entra nel saldo previsto, non nel saldo attuale.
- Una spesa effettiva può essere collegata automaticamente a una voce preventiva.
- Il collegamento automatico richiede conferma quando la sicurezza non è alta.
- La voce preventiva collegata diventa consuntiva e non è più modificabile nelle
  simulazioni.
- La stima originale resta disponibile per il confronto previsto/effettivo.
- L'importo, la valuta e il cambio possono essere corretti dall'autore, dal
  Travel Maker o dall'amministratore.
- L'interfaccia mostra il valore aggiornato con l'etichetta `corretta`.

### Pagamenti e saldi

- Una spesa può avere più pagamenti.
- Ogni pagamento indica pagatore, destinatario, importo, data e spesa.
- Un pagamento in sospeso non incide sul saldo definitivo.
- Un pagamento confermato rimane valido anche dopo una correzione della spesa.
- Un pagamento rifiutato rimane visibile.
- Una correzione ricalcola automaticamente dare, avere e crediti.
- I pagamenti superiori al costo della spesa generano un credito per chi ha
  pagato di più.

### Finalizzazione e ciclo di vita

- Il consuntivo non può essere finalizzato se esistono pagamenti in sospeso.
- Travel Maker e amministratore possono finalizzare il consuntivo.
- Dopo la finalizzazione il consuntivo è bloccato.
- Travel Maker e amministratore possono riaprire il consuntivo.
- Il viaggio può passare a `concluso` solo dopo la finalizzazione.
- L'archiviazione finalizza il consuntivo e rende il viaggio consultabile in
  sola lettura.
- L'amministratore può riaprire un viaggio archiviato.
- Dopo la riapertura il Travel Maker sceglie chi può modificare il viaggio.

## 6. Permessi MVP

| Operazione | Amministratore | Travel Maker | Traveller |
|---|---:|---:|---:|
| Vedere dashboard globale | Sì | No | No |
| Creare viaggio | Sì | Sì | No |
| Aggiungere Traveller | Sì | Sì | No |
| Creare proposta | Sì | Sì | Sì |
| Salvare simulazione | Sì | Sì | Sì |
| Modificare propria spesa | Sì | Sì | Sì |
| Modificare spesa altrui | Sì | Sì | No |
| Correggere valuta/importo | Sì | Sì | Solo propria spesa |
| Finalizzare consuntivo | Sì | Sì | No |
| Archiviare viaggio | No | Sì | No |
| Riaprire viaggio archiviato | Sì | No | No |
| Eliminare definitivamente viaggio | Sì | No | No |
| Export Excel | Sì | Sì | Sì |
| Export JSON | Sì | No | No |

## 7. Schermate mobile-first

### Ingresso

- pagina di benvenuto;
- crea identità Travel Maker;
- recupera identità tramite codice;
- apri un viaggio tramite link.

### Navigazione del viaggio

La barra mobile deve dare accesso diretto a:

- Panoramica;
- Preventivo;
- Simula;
- Spese;
- Saldi;
- Attività;
- Partecipanti.

### Azioni rapide

La schermata iniziale deve rendere immediati:

- `Aggiungi spesa`;
- `Crea proposta`;
- `Salva simulazione`;
- `Vedi saldo`;
- `Condividi viaggio`.

Il form spesa deve richiedere il minimo indispensabile e permettere di
completare successivamente i dettagli non obbligatori.

## 8. Voli free-first

Il primo adapter deve supportare solo provider autorizzati e configurabili.
Se non è disponibile un provider gratuito compatibile, il flusso manuale resta
completo e non viene simulata una ricerca reale.

Ogni offerta deve distinguere:

- prezzo osservato;
- valuta;
- data e ora della rilevazione;
- fonte;
- link al venditore;
- bagagli e condizioni, se disponibili;
- dati mancanti.

La raccomandazione diretta/scalo deve mostrare un avviso e non bloccare il
salvataggio. Il confronto del 30% viene calcolato solo quando i dati sono
comparabili; altrimenti è possibile inserire un confronto manuale.

Non vengono implementate previsioni sofisticate finché non esiste uno storico
sufficiente e confrontabile.

## 9. Valute e paesi

- EUR è la valuta di confronto.
- La spesa mantiene sempre valuta e importo originali.
- Il cambio contiene fonte e data.
- Il cambio manuale è ammesso anche come fallback.
- La configurazione paese viene salvata e riutilizzata.
- Nessun tasso statico di demo deve essere presentato come aggiornato.

## 10. Criteri di accettazione tecnici iniziali

1. L'applicazione può essere aperta tramite URL HTTPS da uno smartphone senza
   installazione obbligatoria.
2. Il database utilizzato dall'app non contiene riferimenti al progetto
   Supabase originale.
3. Un utente senza identità selezionata può consultare ma non salvare una
   proposta o una spesa.
4. Una spesa futura non modifica il saldo attuale.
5. Una spesa effettiva collegata a una voce preventiva non appare più come
   opzione modificabile nelle simulazioni.
6. Un pagamento in sospeso non viene incluso nel saldo definitivo.
7. Il consuntivo non può essere finalizzato con pagamenti in sospeso.
8. Il viaggio non può essere concluso prima della finalizzazione del consuntivo.
9. Il link di un viaggio archiviato apre una vista di sola lettura.
10. Un risultato volo senza dati sufficienti mostra un avviso e non produce una
    previsione certa.
11. I dati dei voli inseriti manualmente riportano chiaramente la fonte manuale.
12. Le esportazioni non contengono chiavi segrete o token di accesso.

## 11. Fuori scope MVP

- OCR delle ricevute;
- conservazione cloud delle ricevute;
- passeggeri bambini o neonati;
- peso e quantità dei bagagli sportivi;
- piano automatico ottimizzato dei rimborsi;
- previsione prezzi sofisticata;
- notifiche push obbligatorie;
- account/password per Traveller;
- eliminazione o revoca del link;
- app native negli store.

## 12. Piano di implementazione

1. Separare definitivamente il prototipo corrente dal codice definitivo.
2. Creare il nuovo progetto frontend con dati sintetici e schermate vuote
   verificabili.
3. Implementare il modello viaggio, Traveller e link.
4. Implementare preventivo, proposte e simulazioni.
5. Implementare spese, pagamenti, saldi e finalizzazione.
6. Implementare notifiche e ciclo di vita.
7. Implementare valute, paese ed export.
8. Aggiungere ricerca voli manuale e poi il primo provider compatibile.
9. Eseguire test mobile, permessi e dati sintetici in staging.
10. Valutare il deploy solo dopo verifica e approvazione dell'MVP.

