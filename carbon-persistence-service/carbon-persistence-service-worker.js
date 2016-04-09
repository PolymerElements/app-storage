(function() {
  'use strict';

  let clientPorts = Symbol('clientPorts');
  let dbName = Symbol('dbName');
  let storeName = Symbol('storeName');

  class CarbonPersistenceService {
    constructor(_dbName='carbon-persistence', _storeName='persisted_data') {
      // Maybe useful in case we want to notify clients of changes..
      this[dbName] = _dbName;
      this[storeName] = _storeName;
      this[clientPorts] = new Set();
      this.dbOpens = new Promise((resolve, reject) => {
        let request = indexedDB.open(_dbName);

        request.onupgradeneeded = () => {
          request.result.createObjectStore(_storeName);
        };
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error);
        };
      });

      self.addEventListener(
          'message', message => this.handleGlobalMessage(message));
      console.log('CarbonPersistenceService started...');
    }

    transaction(method, key, value=null) {
      console.log.apply(console, arguments);
      switch(method) {
        case 'get':
          return this.get(key);
        case 'set':
          return this.set(key, value);
      }
    }

    get(key) {
      return this.dbOpens.then((db) => {
        return new Promise((resolve, reject) => {
          let transaction = db.transaction(this[storeName], 'readonly');
          let store = transaction.objectStore(this[storeName]);
          let request = store.get(key);

          transaction.oncomplete = () => resolve(request.result);
          transaction.onabort = () => reject(transaction.error);
        });
      });
    }

    set(key, value) {
      return this.dbOpens.then((db) => {
        return new Promise((resolve, reject) => {
          let transaction = db.transaction(this[storeName], 'readwrite');
          let store = transaction.objectStore(this[storeName]);
          let request = store.put(value, key);

          transaction.oncomplete = () => resolve(request.result);
          transaction.onabort = () => resolve(transaction.error);
        });
      });
    }

    registerClient(port) {
      console.log('Registering client', port)
      port.addEventListener(
          'message', event => this.handleClientMessage(event, port));
      this[clientPorts].add(port);
      port.start();
      port.postMessage({ type: 'carbon-persistence-connected' });
    }

    handleClientMessage(event, port) {
      console.log(event.data);
      if (!event.data) {
        return;
      }

      switch(event.data.type) {
        case 'carbon-persistence-transaction':
          let transaction = this.transaction(
              event.data.method, event.data.key, event.data.value);
          let id = event.data.id;

          transaction.then((result) => {
            port.postMessage({
              type: 'carbon-persistence-transaction-result',
              id,
              result
            });
          });
          break;
        case 'carbon-persistence-disconnect':
          this[clientPorts].remove(port);
          break;
      }
    }

    handleGlobalMessage(event) {
      console.log('Got global message!');
      console.log(event.data);
      if (event.data && event.data.type === 'carbon-persistence-connect') {
        this.registerClient(event.ports[0]);
      }
    }
  }

  self.addEventListener('install', event => {
    self.skipWaiting();
  });

  self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
    self.carbonPersistenceService = new CarbonPersistenceService();
  });
})();
