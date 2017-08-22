import '../../polymer/polymer.js';
import { AppStorageBehavior } from '../app-storage-behavior.js';
import { AppNetworkStatusBehavior } from '../app-network-status-behavior.js';
import { AppIndexedDBMirrorClient } from './app-indexeddb-mirror-client.js';
import { Polymer } from '../../polymer/lib/legacy/polymer-fn.js';

Polymer({
  is: 'app-indexeddb-mirror',

  behaviors: [
    AppStorageBehavior,
    AppNetworkStatusBehavior
  ],

  properties: {
    /**
     * The key against which to persist data in the IndexedDB database.
     * This key uniquely maps to a key in an IndexedDB object store, so
     * any instances of `app-indexeddb-mirror` with the same `key` will
     * operate on the same persisted representation of the input `data`.
     */
    key: {
      type: String,
      value: 'app-mirror-default-key'
    },

    /**
     * Any string value that uniquely identifies the current session.
     * Whenever this value changes, the data stored at `key` will be
     * deleted. This is useful for handling scenarios such as user
     * session changes (e.g., logout).
     */
    session: {
      type: String
    },

    /**
     * A URL that points to the script to load for the corresponding
     * Worker instance that will be used for minimally-blocking operations
     * on IndexedDB.
     *
     * By default, this will be the path to
     * `app-indexeddb-mirror-worker.js` as resolved by
     * `Polymer.Base.resolveUrl` for the current element being created.
     */
    workerUrl: {
      type: String,
      value: function() {
        return this.resolveUrl('./app-indexeddb-mirror-worker.js');
      }
    },

    /**
     * An instance of `Polymer.AppIndexedDBMirrorClient`, which is
     * responsible for negotiating transactions with the corresponding
     * Worker spawned from `workerUrl`.
     */
    client: {
      type: Object,
      computed: '__computeClient(workerUrl)',
      observer: '__clientChanged'
    },

    /**
     * When online, this property is a pass-through value mapped directly
     * to the `data` property of this element.
     *
     * When offline, this property is a read-only copy of the `data` that
     * has been stored in the IndexedDB database at `key`.
     */
    persistedData: {
      type: Object,
      notify: true
    }
  },

  observers: [
    '__updatePersistedData(client, key, session, online)',
    '__updatePersistedData(data.*)',
  ],

  get isNew() {
    return false;
  },

  destroy: function() {
    return this.client.transaction('set', this.key, null);
  },

  setStoredValue: function(path, value) {
    if (this.online) {
      return this.client.transaction('set', this.key, this.data);
    }

    return Promise.resolve();
  },

  getStoredValue: function(path) {
    return this.client.transaction('get', this.key);
  },

  initializeStoredValue: function() {
    return Promise.resolve();
  },

  __clientChanged: function(client) {
    this._enqueueTransaction(function() {
      return client.connect();
    });
  },

  __computeClient: function(workerUrl) {
    return new AppIndexedDBMirrorClient(workerUrl);
  },

  __updatePersistedData: function() {
    this._log('Updating persisted data..');
    this._enqueueTransaction(function() {
      return this.client.validateSession(this.session);
    });

    if (this.online) {
      this.persistedData = this.data;
      this.linkPaths('data', 'persistedData');
    } else {
      this.unlinkPaths('data');
      this._enqueueTransaction(function() {
        return this.getStoredValue().then(function(value) {
          // We may have gone online since retrieving the persisted value..
          if (this.online || !this.client.supportsMirroring) {
            return;
          }
          this.persistedData = value;
        }.bind(this));
      });
    }
  }
});
