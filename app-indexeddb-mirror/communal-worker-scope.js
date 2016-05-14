(function() {
  'use strict';

  let workerScript = self.location.search.slice(1);

  if (!workerScript) {
    return;
  }

  self.addEventListener('message', event => {
    let data = event.data;

    if (data && data.type === 'communal-worker-connect') {
      let connectEvent = new CustomEvent('connect');
      connectEvent.ports = event.ports;
      self.dispatchEvent(connectEvent);
    }
  });

  self.importScripts([workerScript]);
})();
