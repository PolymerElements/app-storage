(function() {
  'use strict';

  const internalStoreName = 'internal';

  let clientPorts = Symbol('clientPorts');
  let dbName = Symbol('dbName');
  let storeName = Symbol('storeName');

  class CarbonIndexedDBMirrorWorker {
    constructor(_dbName='carbon-mirror', _storeName='mirrored_data') {
      this[dbName] = _dbName;
      this[storeName] = _storeName;
      // Maybe useful in case we want to notify clients of changes..
      this[clientPorts] = new Set();
      this.dbOpens = new Promise((resolve, reject) => {
        let request = indexedDB.open(_dbName);

        request.onupgradeneeded = () => {
          request.result.createObjectStore(_storeName);
          request.result.createObjectStore(internalStoreName);
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

      console.log('CarbonIndexedDBMirrorWorker started...');
    }

    operateOnStore(operation, storeName, mode) {
      let operationArgs = Array.from(arguments).slice(3);

      return this.dbOpens.then(db => {
        return new Promise((resolve, reject) => {
          let transaction = db.transaction(storeName, mode);
          let store = transaction.objectStore(storeName);
          let request = store[operation].apply(store, operationArgs);

          transaction.oncomplete = () => resolve(request.result);
          transaction.onabort = () => reject(transaction.error);
        });
      });
    }

    get(storeName, key) {
      return this.operateOnStore('get', storeName, 'readonly', key);
    }

    set(storeName, key, value) {
      return this.operateOnStore('put', storeName, 'readwrite', value, key);
    }

    clear(storeName) {
      return this.operateOnStore('clear', storeName, 'readwrite');
    }

    transaction(method, key, value=null) {
      switch(method) {
        case 'get':
          return this.get(this[storeName], key);
        case 'set':
          return this.set(this[storeName], key, value);
      }
    }

    validateSession(session) {
      return Promise.all([
        this.dbOpens,
        this.get(internalStoreName, 'session')
      ]).then(results => {
        let db = results[0];
        let currentSession = results[1];
        let operations = [];

        if (session !== currentSession) {
          if (currentSession != null) {
            operations.push(this.clear(this[storeName]));
          }

          operations.push(this.set(internalStoreName, 'session', session));
        }
      });
    }

    registerClient(port) {
      port.addEventListener(
          'message', event => this.handleClientMessage(event, port));
      this[clientPorts].add(port);
      port.start();
      port.postMessage({ type: 'carbon-mirror-connected' });
    }

    handleClientMessage(event, port) {
      if (!event.data) {
        return;
      }

      let id = event.data.id;

      switch(event.data.type) {
        case 'carbon-mirror-validate-session':
          this.validateSession(event.data.session).then(() => {
            port.postMessage({
              type: 'carbon-mirror-session-validated',
              id
            });
          });
          break;
        case 'carbon-mirror-transaction':
          this.transaction(event.data.method, event.data.key, event.data.value)
              .then(result => {
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

  self.carbonIndexedDBMirrorWorker = new CarbonIndexedDBMirrorWorker();

  self.addEventListener(
      'connect',
      event => carbonIndexedDBMirrorWorker.registerClient(event.ports[0]));
})();
