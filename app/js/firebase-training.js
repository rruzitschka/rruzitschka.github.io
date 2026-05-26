// firebase-training.js — Firestore implementation (modular SDK)
// Exposes same interface as the original
// Depends on: firebase-config.js, firebase-auth.js

import {
	collection,
	doc,
	getDocs,
	setDoc,
	updateDoc,
	query,
	orderBy,
	serverTimestamp,
	Timestamp,
} from "firebase/firestore";
import { db } from "./firebase-config.js";
import { getCurrentUser } from "./firebase-auth.js";

export const TRAINING_TYPES = [
	"Hangboard",
	"Campus Board",
	"System Wall",
	"Gym Session",
	"Yoga",
	"Cardio",
	"Other",
];

export const TYPE_EMOJI = {
	Hangboard: "🏋️",
	"Campus Board": "🪜",
	"System Wall": "🧩",
	"Gym Session": "🧗",
	Yoga: "🧘",
	Cardio: "🏃",
	Other: "⚡",
};

export async function fetchTrainingSessions() {
	const user = getCurrentUser();
	if (!user) return [];
	const snapshot = await getDocs(
		query(
			collection(db, `users/${user.uid}/trainingSessions`),
			orderBy("date", "desc"),
		),
	);
	return snapshot.docs
		.filter((d) => !d.data().deletedAt)
		.map((d) => {
			const data = d.data();
			return {
				recordName: d.id,
				id: data.id ?? d.id,
				date: data.date?.toDate() ?? null,
				type: data.type ?? "Gym Session",
				duration: data.duration ?? 60,
				intensity: data.intensity ?? 3,
				notes: data.notes ?? null,
			};
		});
}

export async function saveTrainingSession(session) {
	const user = getCurrentUser();
	if (!user) throw new Error("Not signed in");
	const id =
		session.recordName ?? (session.id ?? crypto.randomUUID()).toUpperCase();
	const docData = {
		id,
		type: session.type ?? "Gym Session",
		duration: session.duration ?? 60,
		intensity: session.intensity ?? 3,
		notes: session.notes ?? "",
		updatedAt: serverTimestamp(),
	};
	if (session.date) docData.date = Timestamp.fromDate(new Date(session.date));
	await setDoc(doc(db, `users/${user.uid}/trainingSessions/${id}`), docData, {
		merge: true,
	});
	return id;
}

export async function deleteTrainingSession(id) {
	const user = getCurrentUser();
	if (!user) return;
	const ts = serverTimestamp();
	await updateDoc(doc(db, `users/${user.uid}/trainingSessions/${id}`), {
		deletedAt: ts,
		updatedAt: ts,
	});
}

export function computeTrainingStats(sessions, period = "allTime") {
	const now = new Date();
	const filtered = sessions.filter((s) => {
		if (!s.date || period === "allTime") return true;
		const d = s.date;
		if (period === "week") {
			const weekAgo = new Date(now);
			weekAgo.setDate(now.getDate() - 7);
			return d >= weekAgo;
		}
		if (period === "month") {
			return (
				d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
			);
		}
		if (period === "year") {
			return d.getFullYear() === now.getFullYear();
		}
		return true;
	});

	const totalSessions = filtered.length;
	const totalMinutes = filtered.reduce((sum, s) => sum + (s.duration ?? 0), 0);
	const daySet = new Set(
		filtered
			.map((s) => (s.date ? s.date.toDateString() : null))
			.filter(Boolean),
	);
	const trainingDays = daySet.size;
	const byType = {};
	filtered.forEach((s) => {
		byType[s.type] = (byType[s.type] ?? 0) + 1;
	});

	const weeks =
		period === "week"
			? 1
			: period === "month"
				? 4
				: period === "year"
					? 52
					: Math.max(
							1,
							Math.ceil(
								(now - (filtered.at(-1)?.date ?? now)) /
									(7 * 24 * 60 * 60 * 1000),
							),
						);
	const avgPerWeek = totalSessions / weeks;

	function formattedTotalTime(mins) {
		if (mins < 60) return `${mins} min`;
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return m ? `${h} h ${m} min` : `${h} h`;
	}

	return {
		totalSessions,
		totalMinutes,
		trainingDays,
		byType,
		avgPerWeek,
		formattedTotalTime,
	};
}
