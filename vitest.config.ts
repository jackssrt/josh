import { defineConfig } from "vitest/config";
export default defineConfig({
	test: {
		coverage: { enabled: true, reporter: ["html", "text-summary"], provider: "v8" },
	},
});
