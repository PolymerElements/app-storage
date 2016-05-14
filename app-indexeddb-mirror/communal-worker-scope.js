(function() {
  'use strict';
  var workerScript = self.location.search.slice(1);

  if (!workerScript) {
    return;
  }

  self.addEventListener('message', function(event) {
    var data = event.data;

    if (data && data.type === 'communal-worker-connect') {
      var connectEvent = new CustomEvent('connect');
      connectEvent.ports = event.ports;
      self.dispatchEvent(connectEvent);
    }
  }.bind(this));

  self.importScripts([workerScript]);
})();
