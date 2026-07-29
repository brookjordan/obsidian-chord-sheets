/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
	testEnvironment: "node",
	transform: {
		"^.+.[tj]sx?$": ["ts-jest"],
	},
	transformIgnorePatterns: [
		"node_modules/(?!(escape-string-regexp|chord-fingering)/)",
	],
	testMatch: ["**/test/**/*.test.ts"],
};
