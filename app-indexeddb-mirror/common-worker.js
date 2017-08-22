import { Element } from '../../polymer/polymer-element.js';
import { resolveUrl } from '../../polymer/lib/utils/resolve-url.js';

var WEB_WORKERS = {};
var HAS_SHARED_WORKER = typeof SharedWorker !== 'undefined';
var HAS_WEB_WORKER = typeof Worker !== 'undefined';
// NOTE(cdata): see http://www.2ality.com/2014/05/current-script.html
var currentScript = document._currentScript || document.currentScript ||
    (function() {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

var BASE_URI = (function() {
  // Polymer 2 baseURI polyfill for IE and Safari
  if (Element && window.HTMLImports && HTMLImports.importForElement) {
    return HTMLImports.importForElement(
        /** @type {!HTMLScriptElement} */(document.currentScript)).baseURI;
  }
  // Polymer 1 or no HTML Imports
  currentScript = document._currentScript ? document._currentScript :
      document.currentScript;
  return currentScript.ownerDocument.baseURI;
})();

var WORKER_SCOPE_URL =
    resolveUrl('common-worker-scope.js', BASE_URI);

export const CommonWorker = function CommonWorker (workerUrl) {
  if (HAS_SHARED_WORKER) {
    return new SharedWorker(workerUrl);

  } else if (HAS_WEB_WORKER) {
    if (!WEB_WORKERS.hasOwnProperty(workerUrl)) {
      WEB_WORKERS[workerUrl] =
          new Worker(WORKER_SCOPE_URL + '?' + workerUrl);
    }

  } else {
    console.error('This browser does not support SharedWorker or' +
'WebWorker, but at least one of those two features is required for' +
'CommonWorker to do its thing.');
  }

  this.channel = new MessageChannel();
  this.webWorker = WEB_WORKERS[workerUrl];

  if (this.webWorker) {
    this.webWorker.postMessage({
      'type': 'common-worker-connect'
    }, [this.channel.port2]);
  }
};

CommonWorker.prototype = {

  /**
   * @type {MessagePort} A port that is unique to each instance of
   * CommonWorker. Messages posted to this port can be received inside of
   * the worker instance.
   */
  get port() {
    return this.channel.port1;
  },

  /**
   * A proxy method that forwards all calls to the backing `WebWorker`
   * instance.
   *
   * @param {String|string|undefined} eventType The event to listen for
   * @param {Function} listenerFunction The function to be attached to the event
   * @param {Object=} options addEventListener Options object
   */
  addEventListener: function(eventType, listenerFunction, options) {
    if (this.webWorker) {
      return this.webWorker.addEventListener.apply(this.webWorker, arguments);
    }
  },

  /**
   * A proxy method that forwards all calls to the backing `WebWorker`
   * instance.
   *
   * @param {...*} removeEventListenerArgs The arguments to call the same
   * method on the `WebWorker` with.
   */
  removeEventListener: function(removeEventListenerArgs) {
    if (this.webWorker) {
      return this.webWorker
          .removeEventListener.apply(this.webWorker, arguments);
    }
  }
};
