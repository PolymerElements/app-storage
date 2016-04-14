(function() {
  'use strict';

  let clientPorts = Symbol('clientPorts');
  let dbName = Symbol('dbName');
  let storeName = Symbol('storeName');

  class CarbonMirrorWorker {
    constructor(_dbName='carbon-mirror', _storeName='mirrored_data') {
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
          'unhandledrejection', error => console.error(error));
      self.addEventListener(
          'error', error => console.error(error));
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
      port.postMessage({ type: 'carbon-mirror-connected' });
    }

    handleClientMessage(event, port) {
      console.log(event.data);
      if (!event.data) {
        return;
      }

      switch(event.data.type) {
        case 'carbon-mirror-transaction':
          let transaction = this.transaction(
              event.data.method, event.data.key, event.data.value);
          let id = event.data.id;

          transaction.then((result) => {
            port.postMessage({
              type: 'carbon-mirror-transaction-result',
              id,
              result
            });
          });
          break;
        case 'carbon-mirror-disconnect':
          this[clientPorts].remove(port);
          break;
      }
    }
  }

  self.carbonMirrorWorker = new CarbonMirrorWorker();

  self.addEventListener(
      'connect', event => carbonMirrorWorker.registerClient(event.ports[0]));
})();
