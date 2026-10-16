# Pubblicazione online senza terminale

## Stato

La nuova app è pronta per un primo ambiente online statico. La copia locale
resta utilizzabile aprendo `index.html`.

Per pubblicare la versione collaborativa servono due risorse separate:

1. un nuovo progetto Supabase;
2. un hosting statico per i file HTML, JavaScript e CSS.

L'applicazione originale e il suo progetto Supabase non devono essere usati.

## 1. Creare il nuovo database

Dal browser:

1. apri il sito Supabase;
2. accedi al tuo account;
3. crea un nuovo progetto con un nome diverso dall'app originale;
4. apri **SQL Editor**;
5. copia il contenuto di
   `supabase/migrations/20261016_travel_next_link_mvp.sql`;
6. eseguilo nel nuovo progetto.

Non servono dati dell'applicazione originale e non devi eseguire lo script nel
vecchio progetto.

## 2. Configurazione pubblica

Per il browser serviranno soltanto:

- Project URL;
- chiave `anon`/`public`.

Non inserire mai nel frontend la chiave `service_role`.

La sincronizzazione online verrà attivata solo dopo aver inserito questi valori
nella configurazione della nuova app.

## 3. Pubblicare i file senza terminale

Per il primo test tra amici si può usare un servizio con caricamento tramite
browser, ad esempio [Netlify Drop](https://app.netlify.com/drop):

1. apri la pagina di caricamento;
2. trascina soltanto la cartella `nuova-app-viaggi-free-first`;
3. attendi la pubblicazione;
4. apri l'URL generato da smartphone o desktop.

Il piano gratuito e i limiti del servizio devono essere verificati al momento
della pubblicazione. Un dominio personalizzato è facoltativo. Non trascinare
la cartella che contiene anche l'applicazione originale.

## 4. Nazioni, cambi e città

Quando la pagina è pubblicata via HTTPS, il modulo **Nuovo viaggio** può
recuperare:

- l'elenco aggiornato delle nazioni e le relative anagrafiche da REST Countries;
- il cambio EUR dalla fonte Frankfurter/ECB;
- i suggerimenti di città da OpenStreetMap Nominatim.

Questi servizi sono gratuiti per il primo test, ma hanno limiti d'uso e
condizioni da rispettare. La ricerca città è volutamente rallentata e non deve
essere usata come servizio ad alto traffico senza un proxy/cache dedicato.

## 5. Sicurezza dell'MVP link

Il link del viaggio è un token casuale. Chi lo possiede può accedere alle
funzioni previste dal link. Il database salva solo l'hash del token.

Questa soluzione è adatta a un primo test tra amici, ma non sostituisce un
account autenticato. Account, revoca link, ruoli amministrativi e audit saranno
aggiunti prima di un uso più ampio.

## 6. Passo che richiede il proprietario dell'account

Non posso creare il progetto Supabase nel tuo account né inventare URL o chiavi.
Dopo la creazione del nuovo progetto, servono il suo Project URL e la chiave
anon/public per completare il collegamento. La service role key non deve essere
condivisa.

