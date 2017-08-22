import { CommonWorker } from './common-worker.js';

var WORKER_URL = '__workerUrl';
var CONNECTS_TO_WORKER = '__connectsToWorker';
var CONNECTED = '__connected';
var MESSAGE_ID = '__messageId';
var SUPPORTS_MIRRORING = '__mirroringSupported';
var worker = null;

export const AppIndexedDBMirrorClient = function AppIndexedDBMirrorClient(_workerUrl) {
this[WORKER_URL] = _workerUrl;
this[CONNECTED] = false;
this[MESSAGE_ID] = 0;
this[CONNECTS_TO_WORKER] = null;
this[SUPPORTS_MIRRORING] = null;

this.connect();
};

AppIndexedDBMirrorClient.prototype = {

  get supportsMirroring() {
    return this[SUPPORTS_MIRRORING];
  },

  /**
   * Requests that the worker validate the current session against the
   * provided `session` parameter. If the current session and the provided
   * `session` do not match, the worker is expected to clear any stored
   * data.
   *
   * @param {string} session The session to validate the current session
   * against.
   * @return {Promise|undefined} A promise that resolves when the worker confirms that
   * the session has been validated.
   */
  validateSession: function(session) {
    if (session === undefined) {
      // Ignore session `undefined` conventionally, as it means the session
      // (such as the user ID) has not been initialized yet.
      return;
    }

    return this.post({
      type: 'app-mirror-validate-session',
      session: session
    });
  },

  /**
   * Sends a message to the worker and awaits and handles a corresponding
   * response.
   *
   * @param {*} message Any value that can be sent via `postMessage` to the
   * worker.
   * @return {Promise} A promise that resolves when a corresponding response
   * message has been received by from the worker. Requests are given a
   * unique ID, so the first worker response that echos this ID will be
   * used to resolve the promise.
   */
  post: function(message) {
    return this.connect().then(function(worker) {
      if (!this[SUPPORTS_MIRRORING]) {
        return Promise.resolve({});
      }

      return new Promise(function(resolve) {
        var id = this[MESSAGE_ID]++;
        var port = worker.port;

        port.addEventListener('message', function onMessage(event) {
          if (event.data && event.data['id'] === id) {
            port.removeEventListener('message', onMessage);
            resolve(event.data['result']);
          }
        });

        message['id'] = id;

        port.postMessage(message);
      }.bind(this));
    }.bind(this));
  },

  /**
   * Requests that the worker perform a transaction (supported verbs are
   * `get` and `set`) against a provided `key` and optional `value` in the
   * IndexedDB object store.
   *
   * @param {string} method The method of the transaction (`"get"` or
   * `"set"`)
   * @param {string} key The key in the IndexedDB object store to operate
   * on.
   * @param {Object} value The value to set at `key`, if using the `"set"`
   * `method`.
   * @return {Promise} A promise that resolves when the worker indicates
   * that the transaction has completed.
   */
  transaction: function(method, key, value) {
    return this.post({
      type: 'app-mirror-transaction',
      method: method,
      key: key,
      value: value
    });
  },

  closeDb: function() {
    return this.post({
      type: 'app-mirror-close-db'
    });
  },

  /**
   * Instantiates (if necessary) and connects to the backing worker
   * instance.
   *
   * @return {Promise} A promise that resolves when the worker has been
   * created and a handshake has been returned. The worker is an instance
   * of `SharedWorker` (if available), or else `Polymer.CommonWorker`.
   */
  connect: function() {
    if (this[CONNECTED] || this[CONNECTS_TO_WORKER]) {
      return this[CONNECTS_TO_WORKER];
    }

    console.log('App IndexedDB Client connecting..');

    return this[CONNECTS_TO_WORKER] = new Promise(function(resolve) {
      var worker = new CommonWorker(this[WORKER_URL]);

      worker.port.addEventListener('message', function(event) {
        if (event.data &&
            event.data['type'] === 'app-mirror-connected') {
          console.log('App IndexedDB Client connected!');
          this[CONNECTED] = true;
          this[SUPPORTS_MIRRORING] = event.data['supportsIndexedDB'];
          resolve(worker);
        }
      }.bind(this));

      worker.addEventListener('error', function(error) {
        console.error(error.message || error);
      });

      worker.port.start();
      worker.port.postMessage({
        'type': 'app-mirror-connect'
      });
    }.bind(this));
  }
}
