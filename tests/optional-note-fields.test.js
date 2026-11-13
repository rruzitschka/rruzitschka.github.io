// tests/optional-note-fields.test.js — buildClimbNoteDoc's optional-field
// semantics via saveClimbNote (Firestore mocked): undefined = not part of the
// save (merge keeps the stored value), null = explicit clear, values written.
// Covers the climbDuration + Multi-Pitch plan fields added with items #8/#9.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSetDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
	collection: vi.fn(),
	doc: vi.fn(),
	getDocs: vi.fn(),
	setDoc: (...a) => mockSetDoc(...a),
	updateDoc: vi.fn(),
	query: vi.fn(),
	orderBy: vi.fn(),
	where: vi.fn(),
	serverTimestamp: vi.fn(),
	Timestamp: { fromDate: vi.fn((d) => d), now: vi.fn() },
}));
vi.mock("../app/js/firebase-config.js", () => ({ db: {} }));
vi.mock("../app/js/firebase-auth.js", () => ({
	getCurrentUser: () => ({ uid: "test-uid" }),
}));

import { saveClimbNote } from "../app/js/firebase-climbs.js";

function lastDocData() {
	return mockSetDoc.mock.calls.at(-1)[1];
}

beforeEach(() => {
	mockSetDoc.mockClear();
});

describe("optional note fields (buildClimbNoteDoc via saveClimbNote)", () => {
	it("writes the multi-pitch plan fields when set", async () => {
		await saveClimbNote({
			route: "Salathé",
			sendType: "Project",
			projectStatus: "active",
			numberOfPitches: 35,
			approachNotes: "4h approach",
			descentNotes: "many rappels",
			gearNotes: "2×70m rope",
			climbDuration: 240,
		});
		const docData = lastDocData();
		expect(docData.numberOfPitches).toBe(35);
		expect(docData.approachNotes).toBe("4h approach");
		expect(docData.descentNotes).toBe("many rappels");
		expect(docData.gearNotes).toBe("2×70m rope");
		expect(docData.climbDuration).toBe(240);
	});

	it("omits plan fields when undefined — merge keeps stored values", async () => {
		await saveClimbNote({
			route: "R",
			sendType: "Redpoint",
			numberOfPitches: undefined,
			approachNotes: undefined,
			descentNotes: undefined,
			gearNotes: undefined,
			climbDuration: undefined,
		});
		const docData = lastDocData();
		expect(docData).not.toHaveProperty("numberOfPitches");
		expect(docData).not.toHaveProperty("approachNotes");
		expect(docData).not.toHaveProperty("descentNotes");
		expect(docData).not.toHaveProperty("gearNotes");
		expect(docData).not.toHaveProperty("climbDuration");
	});

	it("writes null for explicitly cleared plan notes", async () => {
		await saveClimbNote({
			route: "R",
			sendType: "Redpoint",
			numberOfPitches: 0,
			approachNotes: null,
			descentNotes: null,
			gearNotes: null,
		});
		const docData = lastDocData();
		expect(docData.numberOfPitches).toBe(0);
		expect(docData.approachNotes).toBeNull();
		expect(docData.descentNotes).toBeNull();
		expect(docData.gearNotes).toBeNull();
	});

	it("does not write project fields for plain sends", async () => {
		await saveClimbNote({ route: "R", sendType: "Redpoint", rating: 4 });
		const docData = lastDocData();
		expect(docData).not.toHaveProperty("lastAttemptDate");
		expect(docData).not.toHaveProperty("projectStatus");
		expect(docData).not.toHaveProperty("projectNotes");
		expect(docData).not.toHaveProperty("highPoint");
		expect(docData).not.toHaveProperty("centralRouteID");
	});
});
