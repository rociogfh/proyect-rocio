module.exports = {
	globDirectory: 'dist/',
	globPatterns: [
		'**/*.{js,css,svg,html}'
	],
	swDest: 'sw.js',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	]
};