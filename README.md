# vapr-input [![Build Status](https://travis-ci.org/JoshuaWise/vapr-input.svg?branch=master)](https://travis-ci.org/JoshuaWise/vapr-input)

The `vapr-input` plugin is used to declare which *content-types* are acceptable for an incoming request's body. If someone makes a request with an unsupported content-type, they'll receive `415 Unsupported Media Type`.

When an acceptable request is received, the raw request body (a [River](https://github.com/JoshuaWise/vapr#modern-async-tooling)) will be passed to the correct parsing function, and the result will be available at `req.body`.

## Installation

```bash
npm install --save vapr
npm install --save vapr-input
```

## Usage

```js
const app = require('vapr')();
const input = require('vapr-input');

const route = app.get('/foo');

route.use(input({
  'application/json': raw => raw.all().then(Buffer.concat).then(JSON.parse),
  'application/xml': raw => raw.all().then(Buffer.concat).then(parseXML),
}));

route.use((req) => {
  req.body; // { foo: 'bar' };
});
```

## Guide

Each parsing function also takes a second argument, which is an object describing the parameters found within the content-type header. For the sake of simplicity and security, if someone makes a request with any charset parameter besides `utf-8` or `us-ascii`, they'll receive `415 Unsupported Media Type`. This behavior can be suppressed by passing the `anyCharset` option to the plugin.

```js
route.use(input({
  'anyCharset': true,
  'application/xml': async (raw, params) => {
    if (!params.charset) return 415;
    if (params.charset.toLowerCase() !== 'utf-16le') return 415;
    const buffers = await raw.all();
    return parseXML(Buffer.concat(buffers).toString('utf16le'));
  },
}));
```

You can optionally pass a `default` function, which is used when no other media type is matched.

```js
route.use(input({
  'application/json': raw => ...,
  'application/xml': raw => ...,
  'text/plain': raw => ...,
  'default': raw => ...,
}));
```

Sometimes you may wish to defer parsing the body until you really need to. By passing the `deferred` option, no parsing will happen automatically. Instead, `req.body` will be a function that triggers the correct parsing function and returns the result (typically a promise).

```js
route.use(input({
  'deferred': true,
  'application/json': raw => raw.all().then(Buffer.concat).then(JSON.parse),
}));

route.use((req) => {
  const body = await req.body();
});
```
