# vapr-input [![Build Status](https://travis-ci.org/JoshuaWise/vapr-input.svg?branch=master)](https://travis-ci.org/JoshuaWise/vapr-input)

## Installation

```bash
npm install --save vapr
npm install --save vapr-input
```

## Usage

This plugin is used to declare which *media types* are acceptable for an incoming request's body. If someone makes a request with an unsupported media type, they'll receive `415 Unsupported Media Type`.

When a valid request is received, the corresponding parser function will be invoked with the raw body stream (a [River](https://github.com/JoshuaWise/vapr#modern-async-tooling)) as its argument, and the result will become available at `req.body`.

```js
const input = require('vapr-input');
const app = require('vapr')();
const route = app.get('/foo');

route.use(input({
  'application/json': raw => raw.all().then(Buffer.concat).then(JSON.parse),
  'application/xml': raw => raw.all().then(Buffer.concat).then(parseXML),
}));

route.use((req) => {
  req.body; // { foo: 'bar' };
});
```

## Options

Media parameters are negotiated in a case-insensitive manner because many common parameters (e.g., `charset`) are case-insensitive. If you're using media parameters that are case-sensitive, you can reverse this behavior by setting the `strictParameters` option.

```js
route.use(input({
  'strictParameters': true,
  'application/foo; some-strange-parameter=hello': serializationFunction,
}));
```

For the sake of simplicity and security, if someone makes a request with a `charset` parameter besides `utf-8` or `us-ascii`, they'll receive `415 Unsupported Media Type`. This behavior can be suppressed by using the `anyCharset` option.

```js
route.use(input({
  'anyCharset': true,
  'application/xml': async (raw, params) => {
    if (params.get('charset') !== 'utf-16le') return 415;
    return parseXML(Buffer.concat(await raw.all()).toString('utf16le'));
  },
}));
```

> As shown above, each parser function receives a second argument, which is a [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) of the media parameters found within the Content-Type header. All parameter keys will be lowercased and, unless the `strictParameters` option is set, all parameter values will be lowercased as well.

You can optionally pass a `default` function, which is used when no other media type is matched.

```js
route.use(input({
  'text/plain': raw => ...,
  'default': raw => ...,
}));
```

To reuse another parser as the default, set the `default` option to a string.

```js
route.use(input({
  'text/plain': raw => ...,
  'default': 'text/plain',
}));
```

Sometimes you may wish to defer parsing the body until you really need to. By setting the `deferred` option, no parsing will happen automatically. Instead, `req.body` will be a function that triggers the correct parser and returns a promise for the result.

```js
route.use(input({
  'deferred': true,
  'application/json': raw => raw.all().then(Buffer.concat).then(JSON.parse),
}));

route.use(async (req) => {
  const body = await req.body();
});
```
