'use strict';
const { parameters: parseParams } = require('negotiated');
const input = require('./input');

module.exports = ({ deferred, anyCharset, strictParameters, default: defaultParser, ...parsers } = {}) => {
	if (!Object.values(parsers).length) throw new TypeError('Expected at least one input parser to be defined');
	if (!Object.values(parsers).every(x => typeof x === 'function')) throw new TypeError('Expected each input parser to be a function');
	deferred = !!deferred;
	anyCharset = !!anyCharset;
	strictParameters = !!strictParameters;
	
	// Identify the default parser.
	if (defaultParser != null) {
		if (typeof defaultParser === 'string') {
			if (parsers.hasOwnProperty(defaultParser)) defaultParser = parsers[defaultParser];
			else throw new TypeError(`Default parser "${defaultParser}" is not defined`);
		} else if (typeof defaultParser !== 'function') {
			throw new TypeError('Expected \'default\' option to be a string or function');
		}
	}
	
	// Create an array of media type definitions.
	const definitions = [];
	const existing = new Set;
	for (const [string, parser] of Object.entries(parsers)) {
		const match = string.match(mediaRange);
		if (!match) throw new TypeError(`Invalid media type: ${string}`);
		const type = match[1].toLowerCase();
		const paramMap = new Map;
		for (const { key, value } of parseParams(match[2])) {
			if (paramMap.has(key)) throw new TypeError(`Duplicate media parameter: ${key}`);
			paramMap.set(key, strictParameters ? value : value.toLowerCase());
		}
		const hash = getHash(type, paramMap);
		if (existing.has(hash)) throw new TypeError(`Duplicate media type: ${string}`);
		const params = [paramMap.entries()].map(([key, value]) => ({ key, value }));
		existing.add(hash);
		definitions.push({ type, params, parser });
	}
	
	// Return the parameterized plugin.
	definitions.sort(sortBySpecificity);
	return input(definitions, defaultParser, deferred, anyCharset, strictParameters);
};

const getHash = (type, params) => {
	params = [...params.entries()].map(([k, v]) => `${k}\r${v}`);
	return `${type}\n${params.sort().join('\n')}`;
};

const sortBySpecificity = (a, b) => b.params.length - a.params.length;
const mediaRange = /^(?!\*\/\*(?:$|[; \t]))([-!#$%&'*+.^_`|~a-z\d]+\/(?!\*(?:$|[; \t]))[-!#$%&'*+.^_`|~a-z\d]+)((?:[ \t]*;[ \t]*(?!q=)[-!#$%&'*+.^_`|~a-z\d]+=(?:[-!#$%&'*+.^_`|~a-z\d]+|"(?:[ \t\x21\x23-\x5b\x5d-\x7e\x80-\xff]|\\[ \t\x21-\x7e\x80-\xff])*"))*)$/i;
