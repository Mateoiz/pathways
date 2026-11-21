// lib/enlistments.ts
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AcademicConfig } from "@/lib/academicConfig";

const termOf = (e: any): string => e.enrolledTerm || e.term || "1st Trimester";

/** True if the enlistment belongs to the term and school year currently open. */
export function isCurrentTerm(e: any, config: AcademicConfig): boolean {
  return termOf(e) === config.currentTerm && (!e.schoolYear || e.schoolYear === config.schoolYear);
}

/** Block-assigned and registrar-confirmed units are locked in. Everything else is still a draft. */
const isConfirmed = (e: any): boolean => e.status === "Enrolled" || e.source === "block";

/**
 * Current-term enlistments for one student, one entry per course code.
 * Use this instead of querying every enlistment by userId, so previous terms don't count toward the load.
 */
export async function getCurrentTermEnlistments(userId: string, config: AcademicConfig) {
  const snap = await getDocs(query(collection(db, "enlistments"), where("userId", "==", userId)));
  const byCode = new Map<string, any>();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (isCurrentTerm(data, config)) byCode.set(data.code, { docId: d.id, ...data });
  });
  return Array.from(byCode.values());
}

/**
 * Deletes a student's unconfirmed ("Enlisted", non-block) enlistments from ANY term,
 * so they start from a clean slate before enlisting again.
 *
 * Kept on purpose: anything with status "Enrolled" or source "block". Past-term enrolled
 * records are academic history (the ledger and prerequisite checks read them).
 *
 * Call this right before writing the student's new selection.
 * Returns how many enlistments were discarded.
 */
export async function discardUnconfirmedEnlistments(userId: string): Promise<number> {
  const snap = await getDocs(query(collection(db, "enlistments"), where("userId", "==", userId)));
  const drafts = snap.docs.filter((d) => !isConfirmed(d.data()));

  // Firestore batches are capped at 500 writes
  for (let i = 0; i < drafts.length; i += 450) {
    const batch = writeBatch(db);
    drafts.slice(i, i + 450).forEach((d) => batch.delete(doc(db, "enlistments", d.id)));
    await batch.commit();
  }
  return drafts.length;
}
