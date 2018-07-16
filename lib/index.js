'use strict';
const { parse: getContentType } = require('content-type');
const { Request, Promise } = require('vapr');
const body = Symbol();

/*
	This plugin is constructed by passing an object that maps media types (e.g.,
	"application/json") to parser functions. Each parser function takes a river
	of buffers, and should return the parsed value (usually a promise or river).
	If there is no parser matching a request's "content-type" header, a 415
	error will be triggered. Alternatively, a "default" parser may be provided,
	which will be used when no other media type is matched.
	
	Each parser function also takes a second argument, which is an object
	describing any media type parameters provided in the request. For the sake
	of simplicity and security, if any charset is provided besides utf-8 or
	us-ascii, a 415 error will be triggered. This behavior can be suppressed by
	setting the "anyCharset" option to true.
	
	When this plugin is used on a route, the associated Request object will have
	a read-only "body" property which contains the (awaited) parsed body value.
	The "deferred" option may be set, causing the body value to instead be a
	function that parses the body and returns the (not awaited) parsed value.
 */

module.exports = ({ deferred = false, anyCharset = false, default: defaultParser, ...parsers } = {}) => {
	if (!Object.values(parsers).every(x => typeof x === 'function')) throw new TypeError('Expected each input parser to be a function');
	parsers = new Map(Object.entries(parsers).map(([k, v]) => [k.toLowerCase(), v]));
	deferred = !!deferred;
	anyCharset = !!anyCharset;
	
	// Identify the default parser.
	if (defaultParser != null) {
		if (typeof defaultParser === 'string') {
			defaultParser = defaultParser.toLowerCase();
			if (parsers.has(defaultParser)) defaultParser = parsers.get(defaultParser);
			else throw new TypeError(`Default parser "${defaultParser}" is not defined`);
		} else if (typeof defaultParser !== 'function') {
			throw new TypeError('Expected \'default\' option to be a string or function');
		}
	}
	
	// Return the parameterized plugin.
	return (req) => {
		let contentType, parameters;
		const header = req.headers.get('content-type');
		if (header) {
			let obj;
			try { obj = getContentType(header); }
			catch (_) { return [400, 'Malformed Content-Type Header']; }
			contentType = obj.type;
			parameters = obj.parameters;
			if (!anyCharset && !isSupportedCharset(parameters.charset)) return 415;
		} else {
			// Default to octet-stream (https://tools.ietf.org/html/rfc7231#section-3.1.1.5).
			contentType = 'application/octet-stream';
			parameters = Object.create(null);
		}
		const fn = parsers.get(contentType) || defaultParser;
		if (!fn) return 415;
		if (deferred) {
			req.meta[body] = deferredBody(req, fn);
			return;
		}
		const result = fn(req.read());
		if (!Promise.isPromise(result)) req.meta[body] = result;
		else return Promise.resolve(result).then(assignBody(req));
	};
};

const deferredBody = (req, fn, memo) => () => {
	if (!memo) {
		try { memo = Promise.resolve(fn(req.read())); }
		catch (err) { memo = Promise.reject(err); }
	}
	return memo;
};

const assignBody = (req) => (value) => { req.meta[body] = value; };
const isSupportedCharset = x => x === undefined || supportedCharsets.includes(x.toLowerCase());
const supportedCharsets = ['utf-8', 'utf8', 'unicode-1-1-utf-8', 'us-ascii'];
Object.defineProperty(Request.prototype, 'body', {
	configurable: true,
	get: function getBody() { return this.meta[body]; },
});
