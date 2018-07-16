[![Published on NPM](https://img.shields.io/npm/v/@polymer/app-storage.svg)](https://www.npmjs.com/package/@polymer/app-storage)
[![Build status](https://travis-ci.org/PolymerElements/app-storage.svg?branch=master)](https://travis-ci.org/PolymerElements/app-storage)
[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://webcomponents.org/element/@polymer/app-storage)

## App-Storage

These are a set of behaviors and elements that make it easy to synchronize
in-memory data to persistant storage systems.

See: [Documentation](https://www.webcomponents.org/element/@polymer/app-storage),

### AppStorageBehavior

`AppStorageBehavior` is an abstract behavior that makes it easy to
synchronize in-memory data and a persistant storage system, such as
the browser's IndexedDB, or a remote database like Firebase.

### AppNetworkStatusBehavior

`AppNetworkStatusBehavior` tracks the status of whether the browser
is online or offline. True if the browser is online, and false if the browser is
offline matching the HTML browser state spec.

### &lt;app-indexeddb-mirror&gt;

`app-indexeddb-mirror` is a purpose-built element to easily add read-only
offline access of application data that is typically only available when the
user is connected to the network.

When an app using this element is connected to the network, the element acts as
a pass-through for live application data. Data is bound into the `data`
property, and consumers of the data can bind to the correlated `persistedData`
property. As live data changes, `app-indexeddb-mirror` caches a copy of the live
data in a local IndexedDB database. When the app is no longer connected to the
network, `app-indexeddb-mirror` toggles its `persistedData` property to refer
to a read-only copy of the corresponding data in IndexedDB.

This element is particularly useful in cases where an API or storage layer (such
as Firebase, for example) does not support caching data for later use during
user sessions that begin while the user is disconnected from the network.

### &lt;app-localstorage-document&gt;

app-localstorage-document synchronizes storage between an in-memory
value and a location in the browser's localStorage system.

localStorage is a simple and widely supported storage API that provides both
permanent and session-based storage options. Using app-localstorage-document
you can easily integrate localStorage into your app via normal Polymer
databinding.

app-localstorage-document is the reference implementation of an element
that uses `AppStorageBehavior`. Reading its code is a good way to get
started writing your own storage element.

## Usage

### Installation
```
npm install --save @polymer/app-storage
```

### In an html file

#### &lt;app-indexeddb-mirror&gt;
```html
<html>
  <head>
    <script type="module">
      import '@polymer/polymer/lib/elements/dom-bind.js';
      import '@polymer/iron-ajax/iron-ajax.js';
      import '@polymer/app-storage/app-indexeddb-mirror/app-indexeddb-mirror.js';
    </script>
  </head>
  <body>
    <dom-bind>
      <template>
        <iron-ajax
            url="/api/cats"
            handle-as="json"
            last-response="{{liveData}}">
        </iron-ajax>
        <app-indexeddb-mirror
            key="cats"
            data="{{liveData}}"
            persisted-data="{{persistedData}}">
        </app-indexeddb-mirror>

        <dom-repeat>
          <template items="{{persistedData}}" as="cat">
            <div>[[cat.name]]</div>
          </template>
        </dom-repeat>
      </template>
    </dom-bind>
  </body>
</html>
```

#### &lt;app-localstorage-document&gt;
```html
<html>
  <head>
    <script type="module">
      import '@polymer/polymer/lib/elements/dom-bind.js';
      import '@polymer/paper-input/paper-input.js';
      import '@polymer/app-storage/app-localstorage-document/app-localstorage-document.js';
    </script>
  </head>
  <body>
    <dom-bind>
      <template>
        <paper-input value="{{search}}"></paper-input>
        <app-localstorage-document key="search" data="{{search}}">
        </app-localstorage-document>
      </template>
    </dom-bind>
  </body>
</html>
```

### In a Polymer 3 element

#### AppStorageBehavior
```js
import {PolymerElement, html} from '@polymer/polymer';
import {mixinBehaviors} from '@polymer/polymer/lib/legacy/class.js';
import {AppStorageBehavior} from '@polymer/app-storage/app-storage-behavior.js';

class SampleElement extends mixinBehaviors([AppStorageBehavior], PolymerElement) {
  get isNew() { return /* your override here */ }
  get zeroValue() { return /* your override here */ }
  get saveValue() { return /* your override here */ }
  reset() {  /* your optional override here */ }
  getStoredValue() {  /* your override here */ }
  setStoredValue() {  /* your override here */ }
}
customElements.define('sample-element', SampleElement);
```

#### Polymer.AppNetworkStatusBehavior
```js
import {PolymerElement, html} from '@polymer/polymer';
import {mixinBehaviors} from '@polymer/polymer/lib/legacy/class.js';
import {AppNetworkStatusBehavior} from '@polymer/app-storage/app-network-status-behavior.js';

class SampleElement extends mixinBehaviors([AppNetworkStatusBehavior], PolymerElement) {
  alertNetworkStatus() { alert(`I am ${this.online ? 'online' : 'offline'}!`) }
}
customElements.define('sample-element', SampleElement);
```

#### &lt;app-indexeddb-mirror&gt;
```js
import {PolymerElement, html} from '@polymer/polymer';
import '@polymer/iron-ajax/iron-ajax.js';
import '@polymer/app-storage/app-indexeddb-mirror/app-indexeddb-mirror.js';

class SampleElement extends PolymerElement {
  static get template() {
    return html`
      <iron-ajax
          url="/api/cats"
          handle-as="json"
          last-response="{{liveData}}">
      </iron-ajax>
      <app-indexeddb-mirror
          key="cats"
          data="{{liveData}}"
          persisted-data="{{persistedData}}">
      </app-indexeddb-mirror>

      <template is="dom-repeat" items="{{persistedData}}" as="cat">
        <div>[[cat.name]]</div>
      </template>
    `;
  }
}
customElements.define('sample-element', SampleElement);
```

##### &lt;app-localstorage-document&gt;
```js
import {PolymerElement, html} from '@polymer/polymer';
import '@polymer/paper-input/paper-input.js';
import '@polymer/app-storage/app-localstorage-document/app-localstorage-document.js';

class SampleElement extends PolymerElement {
  static get template() {
    return html`
      <paper-input value="{{search}}"></paper-input>
      <app-localstorage-document key="search" data="{{search}}">
      </app-localstorage-document>
    `;
  }
}
customElements.define('sample-element', SampleElement);
```

## Contributing
If you want to send a PR to this element, here are
the instructions for running the tests and demo locally:

### Installation
```sh
git clone https://github.com/PolymerElements/app-storage
cd app-storage
npm install
npm install -g polymer-cli
```

### Running the demo locally
```sh
polymer serve --npm
open http://127.0.0.1:<port>/demo/
```

### Running the tests
```sh
polymer test --npm
```