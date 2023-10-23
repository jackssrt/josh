export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			["build", "chore", "ci", "docs", "feat", "fix", "perf", "ref", "revert", "style", "test"],
		],
	},
};
