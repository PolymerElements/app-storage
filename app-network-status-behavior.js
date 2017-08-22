import '../polymer/polymer.js';

var networkStatusSubscribers = [];

function notifySubscribers() {
  for (var i = 0; i < networkStatusSubscribers.length; ++i) {
    networkStatusSubscribers[i].refreshNetworkStatus();
  }
}

window.addEventListener('online', notifySubscribers);
window.addEventListener('offline', notifySubscribers);

export const AppNetworkStatusBehavior = {
  properties: {
    /**
     * True if the browser is online, and false if the browser is offline
     * matching the HTML browser state spec.
     *
     * @type {Boolean}
     */
    online: {
      type: Boolean,
      readOnly: true,
      notify: true,
      value: function() {
        return window.navigator.onLine;
      }
    }
  },

  attached: function() {
    networkStatusSubscribers.push(this);
    this.refreshNetworkStatus();
  },

  detached: function() {
    var index = networkStatusSubscribers.indexOf(this);
    if (index < 0) {
      return;
    }
    networkStatusSubscribers.splice(index, 1);
  },

  /**
   * Updates the `online` property to reflect the browser connection status.
   */
  refreshNetworkStatus: function() {
    this._setOnline(window.navigator.onLine);
  }
};
