(function() {
  'use strict';

  var INTERNAL_STORE_NAME = 'internal';
  var DB_VERSION = 2;

  var CLIENT_PORTS = '__clientPorts';
  var DB_NAME = '__dbName';
  var STORE_NAME = '__storeName';

  var MIGRATIONS = [
    // v1
    function(context) {context.database.createObjectStore(context.__storeName)},
    // v2
    function(context) {context.database.createObjectStore(INTERNAL_STORE_NAME)}
  ];

  function AppIndexedDBMirrorWorker(_dbName, _storeName) {
    _dbName = _dbName || 'app-mirror';
    _storeName = _storeName || 'mirrored_data';

    this[DB_NAME] = _dbName;
    this[STORE_NAME] = _storeName;
    // Maybe useful in case we want to notify clients of changes..
    this[CLIENT_PORTS] = new Array;
    this.dbOpens = new Promise(function(resolve, reject) {
      var request = indexedDB.open(_dbName, DB_VERSION);

      request.onupgradeneeded = function(event) {
        var context = {
          database: request.result,
          storeName: _storeName,
          dbName: _dbName
        };

        for (var i = event.oldVersion; i < event.newVersion; ++i) {
          MIGRATIONS[i] && MIGRATIONS[i].call(this, context);
        }
      };

      request.onsuccess = function() {
        resolve(request.result);
      };
      request.onerror = function() {
        reject(request.error);
      };
    });

    self.addEventListener(
        'unhandledrejection', function(error){ console.error(error) });
    self.addEventListener(
        'error', function(error) { console.error(error) });
    console.log('AppIndexedDBMirrorWorker started...');
  };

  AppIndexedDBMirrorWorker.prototype = {
    operateOnStore: function(operation, storeName, mode) {
      var operationArgs = Array.from(arguments).slice(3);

      return this.dbOpens.then(function(db) {
        return new Promise(function(resolve, reject) {
          var transaction = db.transaction(storeName, mode);
          var store = transaction.objectStore(storeName);
          var request = store[operation].apply(store, operationArgs);

          transaction.oncomplete = function() {resolve(request.result)};
          transaction.onabort = function() {reject(transaction.error)};
        });
      });
    },

    get: function(storeName, key) {
      return this.operateOnStore('get', storeName, 'readonly', key);
    },

    set: function(storeName, key, value) {
      return this.operateOnStore('put', storeName, 'readwrite', value, key);
    },

    clear: function(storeName) {
      return this.operateOnStore('clear', storeName, 'readwrite');
    },

    transaction: function(method, key, value) {
      value = value || null;

      switch(method) {
        case 'get':
          return this.get(this[STORE_NAME], key);
        case 'set':
          return this.set(this[STORE_NAME], key, value);
      }
    },

    validateSession: function(session) {
      return Promise.all([
        this.dbOpens,
        this.get(INTERNAL_STORE_NAME, 'session')
      ]).then(function(results) {
        var db = results[0];
        var currentSession = results[1];
        var operations = [];

        if (session !== currentSession) {
          if (currentSession != null) {
            operations.push(this.clear(this[STORE_NAME]));
          }

          operations.push(this.set(INTERNAL_STORE_NAME, 'session', session));
        }
      }.bind(this));
    },

    registerClient: function(port) {
      port.addEventListener('message', function(event) {
        this.handleClientMessage(event, port)
      }.bind(this));

      if (!port in this[CLIENT_PORTS]) {
        this[CLIENT_PORTS].push(port);
      }

      port.start();
      port.postMessage({ type: 'app-mirror-connected' });
    },

    handleClientMessage: function(event, port) {
      if (!event.data) {
        return;
      }

      var id = event.data.id;

      switch(event.data.type) {
        case 'app-mirror-validate-session':
          this.validateSession(event.data.session).then(function() {
            port.postMessage({
              type: 'app-mirror-session-validated',
              id
            });
          });
          break;
        case 'app-mirror-transaction':
          this.transaction(event.data.method, event.data.key, event.data.value)
              .then(function(result) {
                port.postMessage({
                  type: 'app-mirror-transaction-result',
                  id,
                  result
                });
              });
          break;
        case 'app-mirror-disconnect':
          var index = this[CLIENT_PORTS].indexOf(port);

          if (index !== -1) {
            this[CLIENT_PORTS].splice(index, 1);
          }
          break;
      }
    }
  };

  self.appIndexedDBMirrorWorker = new AppIndexedDBMirrorWorker();

  self.addEventListener('connect', function(event) {
    appIndexedDBMirrorWorker.registerClient(event.ports[0])
  });
})();
