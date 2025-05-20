# Contribuire a BellionManager

Grazie per il tuo interesse a contribuire a BellionManager! Questo documento fornisce linee guida per contribuire al progetto.

## Processo di Contribuzione

1. **Fork del repository**
   - Crea un fork del repository su GitHub

2. **Crea un branch**
   - Crea un branch per la tua modifica
   - Usa un nome descrittivo, ad esempio `feature/nome-feature` o `fix/nome-bugfix`

3. **Sviluppa il codice**
   - Mantieni il codice pulito e leggibile
   - Segui le convenzioni di stile già presenti nel progetto
   - Documenta le nuove funzionalità o modifiche importanti

4. **Test**
   - Assicurati che il tuo codice funzioni come previsto
   - Aggiungi test per le nuove funzionalità quando possibile
   - Esegui i test esistenti per assicurarti di non aver introdotto regressioni

5. **Crea una Pull Request**
   - Invia una Pull Request con una descrizione chiara della modifica
   - Collega la PR a eventuali issue correlate
   - Rispondi a qualsiasi feedback o richiesta di modifica

## Standard di Codice

- **JavaScript/TypeScript**
  - Usa TypeScript quando possibile
  - Segui lo stile di formattazione del progetto
  - Utilizza ES6+ per nuove funzionalità
  - Documenta le funzioni e i metodi con JSDoc

- **Organizzazione del Codice**
  - Rispetta la struttura modulare del progetto
  - Mantieni i componenti dedicati a un singolo scopo
  - Evita la duplicazione del codice

- **Commit**
  - Usa messaggi di commit descrittivi
  - Segui il formato: `tipo(scope): descrizione`
  - I tipi comuni includono: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Branch e Versioni

- Il branch `main` contiene sempre il codice stabile più recente
- I branch di sviluppo vengono creati a partire da `main`
- Le versioni seguono lo standard [Semantic Versioning](https://semver.org/)

## Segnalazione di Bug

Se trovi un bug, crea un issue su GitHub con:

- Una descrizione chiara del problema
- Passi per riprodurre il bug
- Informazioni sull'ambiente (versione del sistema operativo, Node.js, etc.)
- Eventuali log di errore pertinenti
- Screenshot se applicabili

## Richieste di Funzionalità

Per suggerire nuove funzionalità, crea un issue su GitHub descrivendo:

- Qual è il problema che la nuova funzionalità dovrebbe risolvere
- Come dovrebbe funzionare
- Eventuali alternative considerate
- Contesto aggiuntivo o casi d'uso

## Rilascio

Il processo di rilascio è gestito dai maintainer del progetto. In generale:

1. Il codice viene testato su un branch di sviluppo
2. Una PR viene creata verso `main`
3. Dopo il merge, viene creato un tag di versione
4. Le note di rilascio vengono generate automaticamente

## Domande?

Se hai domande sul processo di contribuzione, non esitare a chiedere creando un issue con il tag "question".

---

*Questo documento è soggetto a modifiche. Controlla sempre la versione più recente prima di contribuire.*