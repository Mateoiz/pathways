import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type AcademicConfig = {
  schoolYear: string;
  currentTerm: "1st Trimester" | "2nd Trimester" | "3rd Trimester";
  enrollmentOpen: boolean;
  maxUnitsDefault: number;
  updatedAt?: string;
};

const currentYear = new Date().getFullYear();

export const DEFAULT_ACADEMIC_CONFIG: AcademicConfig = {
  schoolYear: `${currentYear}-${currentYear + 1}`,
  currentTerm: "1st Trimester",
  enrollmentOpen: true,
  maxUnitsDefault: 21,
};

export async function getAcademicConfig(): Promise<AcademicConfig> {
  try {
    const ref = doc(db, "settings", "academic");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...DEFAULT_ACADEMIC_CONFIG, ...(snap.data() as Partial<AcademicConfig>) };
    }
    await setDoc(ref, DEFAULT_ACADEMIC_CONFIG);
    return DEFAULT_ACADEMIC_CONFIG;
  } catch (error) {
    console.error("Failed to load academic config:", error);
    return DEFAULT_ACADEMIC_CONFIG;
  }
}