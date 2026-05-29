import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      // Only measure coverage for the pure-logic modules that are actually
      // unit-testable. Browser-side UI files (stats.js, ui.js, admin.js etc.)
      // require a live DOM and are excluded from coverage measurement.
      include: [
        "app/js/firebase-climbs.js",
        "app/js/firebase-routes.js",
        "app/js/firebase-training.js",
        "app/js/grades.js",
      ],
    },
  },
});
