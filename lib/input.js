'use strict';
const { parameters: parseParams } = require('negotiated');
const { Request, Promise, River } = require('vapr');
const body = Symbol();

module.exports = (definitions, defaultParser, deferred, anyCharset, strictParameters) => (req) => {
	const match = (req.headers.get('content-type') || 'application/octet-stream').match(mediaRange);
	if (!match) return [400, 'Malformed Content-Type Header'];
	
	// Parse the provided media parameters.
	const params = new Map;
	for (const { key, value } of parseParams(match[2])) {
		params.set(key, strictParameters ? value : value.toLowerCase());
	}
	
	// Enforce the utf-8 charset.
	if (!anyCharset) {
		let charset = params.get('charset');
		if (charset !== undefined) {
			charset = charset.toLowerCase();
			if (charset !== 'utf-8' && charset !== 'us-ascii') return 415;
		}
	}
	
	// Find an appropriate parser, if one exists.
	const parser = getParser(definitions, match[1].toLowerCase(), params) || defaultParser;
	if (!parser) return 415;
	
	// Parse the request body, or expose a function for doing so.
	if (deferred) {
		req.meta[body] = deferredBody(parser, req, params);
		return;
	}
	const result = parser(req.read(), params);
	if (!Promise.isPromise(result) || River.isRiver(result)) req.meta[body] = result;
	else return Promise.resolve(result).then(assignBody(req));
};

const getParser = (definitions, type, params) => {
	for (const def of definitions) {
		if (def.type !== type) continue;
		for (const { key, value } of def.params) {
			if (params.get(key) !== value) continue;
		}
		return def.parser;
	}
};

const deferredBody = (parser, req, params, memo) => () => {
	if (!memo) {
		try {
			const result = parser(req.read(), params);
			memo = River.isRiver(result) ? result : Promise.resolve(result);
		} catch (err) {
			memo = Promise.reject(err);
		}
	}
	return memo;
};

const assignBody = (req) => (value) => { req.meta[body] = value; };
const mediaRange = /^([-!#$%&'*+.^_`|~a-z\d]+\/[-!#$%&'*+.^_`|~a-z\d]+)((?:[ \t]*;[ \t]*[-!#$%&'*+.^_`|~a-z\d]+=(?:[-!#$%&'*+.^_`|~a-z\d]+|"(?:[ \t\x21\x23-\x5b\x5d-\x7e\x80-\xff]|\\[ \t\x21-\x7e\x80-\xff])*"))*)$/i;

Object.defineProperty(Request.prototype, 'body', {
	configurable: true,
	get: function getBody() { return this.meta[body]; },
});
