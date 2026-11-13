// tests/mock-fetch.test.js — mock fetchClimbs read normalization must match
// firebase-climbs.fetchClimbs: the store (Firestore and MOCK_CLIMBS alike)
// holds the lowercase canonical send type; the UI expects Title Case.
// Regression guard for the "RE instead of RP" badge after a successful
// attempt logged in mock mode (docs/plan-new-ui-gui-followups.md #10).

import { describe, it, expect, beforeAll, vi } from "vitest";

// mock.js re-exports computeStats/filterClimbs from firebase-climbs.js, which
// needs the real firebase/firestore package (not installed in the test env).
vi.mock("../app/js/firebase-climbs.js", () => ({
	computeStats: () => ({}),
	filterClimbs: (climbs) => climbs,
}));
vi.mock("../app/js/firebase-training.js", () => ({
	computeTrainingStats: () => ({}),
}));

// fetchClimbs reads window.location.search — stub it before the dynamic
// import (mock.js only touches window inside functions, not at module load).
beforeAll(() => {
	vi.stubGlobal("window", { location: { search: "" } });
});

const { fetchClimbs, saveClimbNote } = await import("../app/js/mock.js");

describe("mock fetchClimbs — send-type read normalization", () => {
	it("normalizes the lowercase canonical sendType written by the attempt pipeline", async () => {
		await saveClimbNote({
			recordName: "mock-4",
			sendType: "redpoint", // buildAttemptFields success payload
			projectStatus: "completed",
		});
		const climbs = await fetchClimbs();
		const sent = climbs.find((c) => c.recordName === "mock-4");
		expect(sent.sendType).toBe("Redpoint");
		expect(sent.isProject).toBe(false);
	});

	it("keeps stored projects identified as projects (Title Case on read)", async () => {
		const climbs = await fetchClimbs();
		const project = climbs.find((c) => c.recordName === "mock-5");
		expect(project.sendType).toBe("Project");
		expect(project.isProject).toBe(true);
	});
});
