"use client";

import { useState } from "react";
import { collection, doc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { db, createAuthUserWithoutLoggingOut } from "@/lib/firebase";

type TermEntry = { year: string; term: string; block: boolean; codes: string[] };

// 1. BS COMPUTER SCIENCE FLOWCHART
const CS_TERMS: TermEntry[] = [
  {
    year: "1st Year",
    term: "1st Trimester",
    block: true,
    codes: ["CORE107", "CORE106", "CC101A", "CC101B", "CC102A", "CC102B", "PEED101", "NSTP101A"],
  },
  {
    year: "1st Year",
    term: "2nd Trimester",
    block: false,
    codes: ["LSVI101", "CORE109", "CC103A", "CC103B", "CORE105", "PEED102", "NSTP102A"],
  },
  {
    year: "1st Year",
    term: "3rd Trimester",
    block: false,
    codes: ["CORE101", "COEF362A", "SDF104A", "SDF104B", "CC104A", "CC104B", "DS101A", "PEED103"],
  },
  {
    year: "2nd Year",
    term: "1st Trimester",
    block: false,
    codes: ["COEE402A", "AL101A", "CC105A", "CC105B", "LSVI102", "DS102A", "PEED104"],
  },
  {
    year: "2nd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CC106A", "AL102A", "AR101A", "CN101A", "CORE110", "LSVI103"],
  },
  {
    year: "2nd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["PD101A", "SE101A", "PL101A", "COEN122A", "SP101A"],
  },
  {
    year: "3rd Year",
    term: "1st Trimester",
    block: false,
    codes: ["SE102A", "SE102B", "COSC117C", "OS101A", "HCI101A", "GV101A", "CORE108"],
  },
  {
    year: "3rd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["NC101A", "COSC122C", "IAS101A", "FEL005C", "SE103A"],
  },
];

// 2. BS ACCOUNTANCY FLOWCHART
const BSA_TERMS: TermEntry[] = [
  {
    year: "1st Year",
    term: "1st Trimester",
    block: true,
    codes: ["CORE101", "CORE102", "LSVI101", "BACC102A", "BACC122A", "PEED101", "NSTP101A"],
  },
  {
    year: "1st Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE103", "CORE104", "CORE105", "CORE106", "LSVI102", "BACC112A", "PEED102", "NSTP102A"],
  },
  {
    year: "1st Year",
    term: "3rd Trimester",
    block: false,
    codes: ["CORE107", "CORE114", "LSVI103", "COMP101A", "COMP101B", "ECON201A", "BACC121A", "BACC132A", "PEED103"],
  },
  {
    year: "2nd Year",
    term: "1st Trimester",
    block: false,
    codes: ["CORE110", "CORE202", "ECON202A", "PREL101A", "ACCT211A", "BLAW211A", "BACC131A", "PEED104"],
  },
  {
    year: "2nd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["GEEL101A", "BMEC101A", "COMP102A", "COMP102B", "ACCT221A", "ACCT232A", "BLAW221A", "BTAX211A"],
  },
  {
    year: "2nd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["BMEC102A", "PREL102A", "ACCT231A", "ACCT312A", "ACCT314A", "ACCT334A", "BLAW231A", "BTAX221A"],
  },
  {
    year: "3rd Year",
    term: "1st Trimester",
    block: false,
    codes: ["RZAL101A", "PREL103A", "PREL104A", "ACCT311A", "ACCT322A", "ACCT323A", "ACCT234A", "ACCT234B"],
  },
  {
    year: "3rd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["ACCT331A", "ACCT324A", "ACCT332A", "ACCT333A", "ACCT333B", "ACCT233A", "ACCT325A", "BLAW331A"],
  },
  {
    year: "3rd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["ACCT335A", "ACCT336A"],
  },
  {
    year: "4th Year",
    term: "1st Trimester",
    block: false,
    codes: ["AREV421A", "AREV422A", "AREV423A"],
  },
  {
    year: "4th Year",
    term: "2nd Trimester",
    block: false,
    codes: ["AREV424A", "AREV425A", "AREV426A"],
  },
];

// 3. BSBA MARKETING MANAGEMENT FLOWCHART
const MKTG_TERMS: TermEntry[] = [
  {
    year: "1st Year",
    term: "1st Trimester",
    block: true,
    codes: ["CORE101", "MKTG100A", "LSVI101", "CORE104", "PEED101", "NSTP101A"],
  },
  {
    year: "1st Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE103", "CORE110", "MKTG102A", "LSVI102", "PEED102", "NSTP102A"],
  },
  {
    year: "1st Year",
    term: "3rd Trimester",
    block: false,
    codes: ["BACC101A", "ECON111A", "MKTG103A", "MKTG104A", "LSVI103", "PEED103"],
  },
  {
    year: "2nd Year",
    term: "1st Trimester",
    block: false,
    codes: ["CORE102", "BMEC101A", "BACC103A", "MKTG105A", "MKTG106A", "PEED104"],
  },
  {
    year: "2nd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE114", "CORE106", "BACC104A", "BTAX103A", "MKTG107A", "MKTG108A"],
  },
  {
    year: "2nd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["CORE107", "CORE203", "BACC106A", "FELEC101A", "BMEC102A", "MKTG109A"],
  },
  {
    year: "3rd Year",
    term: "1st Trimester",
    block: false,
    codes: ["CORE202", "BACC107A", "BACC105A", "MKTG111A", "MKTG111B", "MKTG112A", "BMIS101A", "BMIS101B"],
  },
  {
    year: "3rd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE105", "BACC108A", "BACC108B", "BSBA101A", "BSBA101B", "BSBA102A", "BSBA102B"],
  },
  {
    year: "3rd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["RZAL101A", "FORL111A", "BSBA103A", "BSBA103B", "BSBA104A", "BSBA104B", "BSBA105A", "BSBA105B"],
  },
  {
    year: "4th Year",
    term: "1st Trimester",
    block: false,
    codes: ["PRAC101A"],
  },
];

// 4. DOCTOR OF VETERINARY MEDICINE (DVM 2018) 6-YEAR FLOWCHART
const DVM_TERMS: TermEntry[] = [
  {
    year: "1st Year",
    term: "1st Trimester",
    block: true,
    codes: ["CHEF102A", "CORE102", "LSVI101", "CORE103", "PEED101", "CHEF102B", "CORE106", "NSTP101A"],
  },
  {
    year: "1st Year",
    term: "2nd Trimester",
    block: false,
    codes: ["ZOOL101A", "ZOOL101B", "PEED102", "CORE101", "CORE105", "NSTP102A"],
  },
  {
    year: "1st Year",
    term: "3rd Trimester",
    block: false,
    codes: ["LSVI102", "BASC101A", "CORE107", "PEED103", "CORE104", "BCHE102A", "BCHE102B"],
  },
  {
    year: "2nd Year",
    term: "1st Trimester",
    block: false,
    codes: ["BOTA101A", "LSVI103", "BASC102A", "BASC103A", "CORE108", "PEED104", "BOTA101B", "BASC102B"],
  },
  {
    year: "2nd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CORE109", "BASC104A", "BASC105A", "BASC105B", "BASC106A", "BASC106B", "FSTC100B", "RMSW101A"],
  },
  {
    year: "2nd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["DEVA100A", "DEVA100B", "ANAT101A", "ANAT101B", "BASC107A", "BASC108A", "BASC108B", "RZAL101A"],
  },
  {
    year: "3rd Year",
    term: "1st Trimester",
    block: false,
    codes: ["ANAT102A", "ANAT102B", "HIST100A", "PHYG101A", "MICR101A", "HIST100B", "PHYG101B", "MICR101B"],
  },
  {
    year: "3rd Year",
    term: "2nd Trimester",
    block: false,
    codes: ["PATH101A", "PATH101B", "MICR102A", "MICR103A", "PHYG102A", "MICR102B", "PHYG102B"],
  },
  {
    year: "3rd Year",
    term: "3rd Trimester",
    block: false,
    codes: ["PATH102A", "PATH102B", "PHAR101A", "PHAR101B", "PHYG103A", "PHYG103B", "MICR104A"],
  },
  {
    year: "4th Year",
    term: "1st Trimester",
    block: false,
    codes: ["PHAR102A", "PHAR102B", "SURG101A", "SURG101B", "PATH103A", "PATH103B", "PARA101A", "PARA101B"],
  },
  {
    year: "4th Year",
    term: "2nd Trimester",
    block: false,
    codes: ["SURG102A", "SURG102B", "SURG103A", "SURG103B", "MEDI101A", "PARA102A", "PARA102B"],
  },
  {
    year: "4th Year",
    term: "3rd Trimester",
    block: false,
    codes: ["MEDI102A", "MEDI103A", "MEDI104A", "MEDI105A", "MEDI106A", "MEDI107A", "ESPM101A"],
  },
  {
    year: "5th Year",
    term: "1st Trimester",
    block: false,
    codes: ["MEDI108A", "MEDI109A", "MEDI110A", "PUHL101A", "PUHL102A", "STAT101A", "CORE110"],
  },
  {
    year: "5th Year",
    term: "2nd Trimester",
    block: false,
    codes: ["PUHL103A", "MEDI111A", "MEDI112A", "MEDI113A", "CLIN101B", "THES101B", "MEDI112B"],
  },
  {
    year: "5th Year",
    term: "3rd Trimester",
    block: false,
    codes: ["PUHL104A", "PUHL104B", "SURG104A", "SURG104B", "CLIN102B", "THES102B"],
  },
  {
    year: "6th Year",
    term: "1st Trimester",
    block: false,
    codes: ["CLIN103B", "VCIP101A", "CLIP103B"],
  },
  {
    year: "6th Year",
    term: "2nd Trimester",
    block: false,
    codes: ["CLIN104B", "VCIP102A", "CLIP104B"],
  },
  {
    year: "6th Year",
    term: "3rd Trimester",
    block: false,
    codes: ["CLIN105B", "VCIP103A"],
  },
];

// Full DVM + BSA + GenEd Master Subject Definitions
const MASTER_SUBJECTS_CATALOG = [
  // ───── DVM 1st Year - 1st Trimester ─────
  { code: "CHEF102A", title: "ORGANIC CHEMISTRY LEC", units: 2, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: false },
  { code: "CHEF102B", title: "ORGANIC CHEMISTRY LAB", units: 1, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: false },
  { code: "CORE102", title: "ART APPRECIATION", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "LSVI101", title: "THE SPIRIT OF FAITH: The Philosophy, Values and Spirituality of Founders", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "CORE103", title: "CONTEMPORARY WORLD", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "PEED101", title: "PHYSICAL ACTIVITIES TOWARD HEALTH AND FITNESS 1 (PATHFIT-1) Movement Competency Training", units: 2, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "CORE106", title: "MATHEMATICS IN THE MODERN WORLD", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },
  { code: "NSTP101A", title: "NATIONAL SERVICE TRAINING PROGRAM 1", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: true },

  // ───── DVM 1st Year - 2nd Trimester ─────
  { code: "ZOOL101A", title: "GENERAL ZOOLOGY LEC", units: 3, prereq: "None", year: "1st Year", term: "2nd Trimester", isGenEd: false },
  { code: "ZOOL101B", title: "GENERAL ZOOLOGY LAB", units: 2, prereq: "None", year: "1st Year", term: "2nd Trimester", isGenEd: false },
  { code: "PEED102", title: "PHYSICAL ACTIVITIES TOWARD HEALTH AND FITNESS 2 (PATHFIT-2) Fitness Training", units: 2, prereq: "PEED101", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "CORE101", title: "READINGS IN PHILIPPINE HISTORY", units: 3, prereq: "None", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "CORE105", title: "SCIENCE, TECHNOLOGY AND SOCIETY", units: 3, prereq: "None", year: "1st Year", term: "2nd Trimester", isGenEd: true },
  { code: "NSTP102A", title: "NATIONAL SERVICE TRAINING PROGRAM 2", units: 3, prereq: "NSTP101A", year: "1st Year", term: "2nd Trimester", isGenEd: true },

  // ───── DVM 1st Year - 3rd Trimester ─────
  { code: "LSVI102", title: "THE SPIRIT OF COMMUNION: The Bible, the Church and Christian Family", units: 3, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: true },
  { code: "BASC101A", title: "PRINCIPLES OF ANIMAL PRODUCTION AND ECONOMICS", units: 3, prereq: "ZOOL101A, ZOOL101B", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "CORE107", title: "UNDERSTANDING THE SELF", units: 3, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: true },
  { code: "PEED103", title: "PHYSICAL ACTIVITIES TOWARD HEALTH AND FITNESS 3 (PATHFIT-3) Menu of Dance, Sports, Martial Arts, Group Exercise", units: 2, prereq: "PEED102", year: "1st Year", term: "3rd Trimester", isGenEd: true },
  { code: "CORE104", title: "PURPOSIVE COMMUNICATION", units: 3, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: true },
  { code: "BCHE102A", title: "BIOCHEMISTRY LEC", units: 3, prereq: "CHEF102A, CHEF102B", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "BCHE102B", title: "BIOCHEMISTRY LAB", units: 1, prereq: "CHEF102A, CHEF102B", year: "1st Year", term: "3rd Trimester", isGenEd: false },

  // ───── DVM 2nd Year - 1st Trimester ─────
  { code: "BOTA101A", title: "VETERINARY BOTANY 1 LEC", units: 2, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "BOTA101B", title: "VETERINARY BOTANY 1 LAB", units: 1, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "LSVI103", title: "THE SPIRIT OF SERVICE: Morality and Social Transformation", units: 3, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: true },
  { code: "BASC102A", title: "PRINCIPLES OF ANIMAL NUTRITION LEC", units: 2, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "BASC102B", title: "PRINCIPLES OF ANIMAL NUTRITION LAB", units: 1, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "BASC103A", title: "ANIMAL WELFARE", units: 2, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "CORE108", title: "FILIPINO (Komunikasyon sa Kolehiyo)", units: 3, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: true },
  { code: "PEED104", title: "PHYSICAL ACTIVITIES TOWARD HEALTH AND FITNESS 4 (PATHFIT-4) Menu of Dance, Sports, Martial Arts, Group Exercise", units: 2, prereq: "PEED103", year: "2nd Year", term: "1st Trimester", isGenEd: true },

  // ───── DVM 2nd Year - 2nd Trimester ─────
  { code: "CORE109", title: "PANITIKAN NG PILIPINO", units: 3, prereq: "None", year: "2nd Year", term: "2nd Trimester", isGenEd: true },
  { code: "BASC104A", title: "PRINCIPLES OF ANIMAL BREEDING AND GENETICS", units: 3, prereq: "BASC101A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BASC105A", title: "POULTRY PRODUCTION AND FLOCK HEALTH MANAGEMENT LEC", units: 2, prereq: "BASC101A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BASC105B", title: "POULTRY PRODUCTION AND FLOCK HEALTH MANAGEMENT LAB", units: 1, prereq: "BASC101A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BASC106A", title: "SWINE PRODUCTION AND HERD HEALTH MANAGEMENT LEC", units: 2, prereq: "BASC101A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BASC106B", title: "SWINE PRODUCTION AND HERD HEALTH MANAGEMENT LAB", units: 1, prereq: "BASC101A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "FSTC100B", title: "PROCESSING AND UTILIZATION OF MEAT, MILK AND AGRI. BY PRODUCTS", units: 1, prereq: "CHEF102A, CHEF102B", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "RMSW101A", title: "RESEARCH METHODS AND SCIENTIFIC WRITING", units: 2, prereq: "None", year: "2nd Year", term: "2nd Trimester", isGenEd: false },

  // ───── DVM 2nd Year - 3rd Trimester ─────
  { code: "DEVA100A", title: "VETERINARY DEVELOPMENTAL ANATOMY (Embryology) LEC", units: 2, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "DEVA100B", title: "VETERINARY DEVELOPMENTAL ANATOMY (Embryology) LAB", units: 1, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ANAT101A", title: "GROSS VETERINARY ANATOMY LEC", units: 2, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ANAT101B", title: "GROSS VETERINARY ANATOMY LAB", units: 2, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "BASC107A", title: "EQUINE PRODUCTION AND HEALTH MANAGEMENT", units: 2, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "BASC108A", title: "RUMINANT PRODUCTION AND HERD HEALTH MANAGEMENT LEC", units: 2, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "BASC108B", title: "RUMINANT PRODUCTION AND HERD HEALTH MANAGEMENT LAB", units: 1, prereq: "BASC101A, ZOOL101A, ZOOL101B", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "RZAL101A", title: "LIFE AND WORKS OF RIZAL", units: 3, prereq: "None", year: "2nd Year", term: "3rd Trimester", isGenEd: true },

  // ───── DVM 3rd Year - 1st Trimester ─────
  { code: "ANAT102A", title: "COMPARATIVE VETERINARY ANATOMY LEC", units: 2, prereq: "ANAT101A, ANAT101B", year: "3rd Year", term: "1st Trimester", isGenEd: false, room: "RM702" },
  { code: "ANAT102B", title: "COMPARATIVE VETERINARY ANATOMY LAB", units: 2, prereq: "ANAT101A, ANAT101B", year: "3rd Year", term: "1st Trimester", isGenEd: false, room: "VH-101" },
  { code: "HIST100A", title: "VETERINARY MICROSCOPIC ANATOMY (Histology) LEC", units: 2, prereq: "ANAT101A, ANAT101B", year: "3rd Year", term: "1st Trimester", isGenEd: false, room: "RM703" },
  { code: "HIST100B", title: "VETERINARY MICROSCOPIC ANATOMY (Histology) LAB", units: 2, prereq: "ANAT101A, ANAT101B", year: "3rd Year", term: "1st Trimester", isGenEd: false, room: "VM205" },
  { code: "PHYG101A", title: "GENERAL VETERINARY PHYSIOLOGY LEC", units: 3, prereq: "BASC101A, BCHE102A, ANAT101A, ANAT101B", year: "3rd Year", term: "1st Trimester", isGenEd: false, room: "RM704" },
  { code: "PHYG101B", title: "GENERAL VETERINARY PHYSIOLOGY LAB", units: 1, prereq: "BASC101A, BCHE102B, BCHE102A, ANAT101A, ANAT101B", year: "3rd Year", term: "1st Trimester", isGenEd: false, room: "VM204" },
  { code: "MICR101A", title: "GENERAL VETERINARY MICROBIOLOGY LEC", units: 3, prereq: "BCHE102A, BCHE102B", year: "3rd Year", term: "1st Trimester", isGenEd: false, room: "RM404" },
  { code: "MICR101B", title: "GENERAL VETERINARY MICROBIOLOGY LAB", units: 1, prereq: "BCHE102A, BCHE102B", year: "3rd Year", term: "1st Trimester", isGenEd: false, room: "VM104" },

  // ───── DVM 3rd Year - 2nd Trimester ─────
  { code: "PATH101A", title: "GENERAL VETERINARY PATHOLOGY LEC", units: 3, prereq: "HIST100A, HIST100B, ANAT102A, ANAT102B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "PATH101B", title: "GENERAL VETERINARY PATHOLOGY LAB", units: 1, prereq: "HIST100A, HIST100B, ANAT102A, ANAT102B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "MICR102A", title: "VETERINARY BACTERIOLOGY AND MYCOLOGY LEC", units: 2, prereq: "MICR101A, MICR101B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "MICR102B", title: "VETERINARY BACTERIOLOGY AND MYCOLOGY LAB", units: 1, prereq: "MICR101B, MICR101A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "MICR103A", title: "VETERINARY VIROLOGY", units: 2, prereq: "MICR101A, MICR101B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "PHYG102A", title: "SYSTEMIC VETERINARY PHYSIOLOGY LEC", units: 3, prereq: "PHYG101A, PHYG101B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "PHYG102B", title: "SYSTEMIC VETERINARY PHYSIOLOGY LAB", units: 1, prereq: "PHYG101A, PHYG101B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },

  // ───── DVM 3rd Year - 3rd Trimester ─────
  { code: "PATH102A", title: "SYSTEMIC VETERINARY PATHOLOGY LEC", units: 3, prereq: "PATH101A, PATH101B", year: "3rd Year", term: "3rd Trimester", isGenEd: false },
  { code: "PATH102B", title: "SYSTEMIC VETERINARY PATHOLOGY LAB", units: 1, prereq: "PATH101A, PATH101B", year: "3rd Year", term: "3rd Trimester", isGenEd: false },
  { code: "PHAR101A", title: "BASIC VETERINARY PHARMACOLOGY LEC", units: 3, prereq: "ANAT102A, ANAT102B, MICR102A, MICR102B, BCHE102A, BCHE102B", year: "3rd Year", term: "3rd Trimester", isGenEd: false },
  { code: "PHAR101B", title: "BASIC VETERINARY PHARMACOLOGY LAB", units: 1, prereq: "ANAT102A, ANAT102B, MICR102A, MICR102B, BCHE102A, BCHE102B", year: "3rd Year", term: "3rd Trimester", isGenEd: false },
  { code: "PHYG103A", title: "VETERINARY REPRODUCTIVE PHYSIOLOGY AND ENDOCRINOLOGY LEC", units: 2, prereq: "PHYG102A, PHYG102B", year: "3rd Year", term: "3rd Trimester", isGenEd: false },
  { code: "PHYG103B", title: "VETERINARY REPRODUCTIVE PHYSIOLOGY AND ENDOCRINOLOGY LAB", units: 1, prereq: "PHYG102A, PHYG102B", year: "3rd Year", term: "3rd Trimester", isGenEd: false },
  { code: "MICR104A", title: "FUNDAMENTALS OF IMMUNOLOGY", units: 2, prereq: "MICR102A, MICR102B, MICR103A", year: "3rd Year", term: "3rd Trimester", isGenEd: false },

  // ───── DVM 4th Year - 1st Trimester ─────
  { code: "PHAR102A", title: "VETERINARY CLINICAL PHARMACOLOGY LEC", units: 3, prereq: "PHAR101A, PHAR101B, PHYG101A", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "PHAR102B", title: "VETERINARY CLINICAL PHARMACOLOGY LAB", units: 1, prereq: "PHAR101A, PHAR101B, PHYG101A", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "SURG101A", title: "PRINCIPLES OF VETERINARY SURGERY AND ANESTHESIOLOGY LEC", units: 2, prereq: "PHYG101A, PHAR101A, PHAR101B, PATH101A, PATH101B", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "SURG101B", title: "PRINCIPLES OF VETERINARY SURGERY AND ANESTHESIOLOGY LAB", units: 1, prereq: "PHYG101A, PHAR101A, PHAR101B, PATH101A, PATH101B", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "PATH103A", title: "VETERINARY CLINICAL PATHOLOGY LEC", units: 2, prereq: "PATH102A, PATH102B", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "PATH103B", title: "VETERINARY CLINICAL PATHOLOGY LAB", units: 1, prereq: "PATH102A, PATH102B", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "PARA101A", title: "VETERINARY ENTOMOLOGY AND PROTOZOOLOGY LEC", units: 2, prereq: "ZOOL101A, ZOOL101B, PHAR101A, PHAR101B", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "PARA101B", title: "VETERINARY ENTOMOLOGY AND PROTOZOOLOGY LAB", units: 2, prereq: "ZOOL101A, ZOOL101B, PHAR101A, PHAR101B", year: "4th Year", term: "1st Trimester", isGenEd: false },

  // ───── DVM 4th Year - 2nd Trimester ─────
  { code: "SURG102A", title: "VETERINARY DIAGNOSTIC IMAGING LEC", units: 2, prereq: "SURG101A, SURG101B", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "SURG102B", title: "VETERINARY DIAGNOSTIC IMAGING LAB", units: 1, prereq: "SURG101A, SURG101B", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "SURG103A", title: "VETERINARY SMALL ANIMAL SURGERY LEC", units: 1, prereq: "SURG101A, SURG101B, PHAR102A, PHAR102B", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "SURG103B", title: "VETERINARY SMALL ANIMAL SURGERY LAB", units: 2, prereq: "SURG101A, SURG101B, PHAR102A, PHAR102B", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "MEDI101A", title: "GENERAL PRINCIPLES OF VETERINARY MEDICINE", units: 2, prereq: "PHAR101A, PHAR101B, PATH101A, PATH101B, PHYG101A, PHYG101B", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "PARA102A", title: "VETERINARY HELMINTHOLOGY LEC", units: 2, prereq: "PARA101A, PARA101B", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "PARA102B", title: "VETERINARY HELMINTHOLOGY LAB", units: 2, prereq: "PARA101A, PARA101B", year: "4th Year", term: "2nd Trimester", isGenEd: false },

  // ───── DVM 4th Year - 3rd Trimester ─────
  { code: "MEDI102A", title: "POULTRY MEDICINE", units: 2, prereq: "MEDI101A", year: "4th Year", term: "3rd Trimester", isGenEd: false },
  { code: "MEDI103A", title: "FELINE MEDICINE", units: 2, prereq: "MEDI101A", year: "4th Year", term: "3rd Trimester", isGenEd: false },
  { code: "MEDI104A", title: "CANINE MEDICINE", units: 2, prereq: "MEDI101A", year: "4th Year", term: "3rd Trimester", isGenEd: false },
  { code: "MEDI105A", title: "SWINE MEDICINE", units: 2, prereq: "MEDI101A", year: "4th Year", term: "3rd Trimester", isGenEd: false },
  { code: "MEDI106A", title: "RUMINANT MEDICINE", units: 2, prereq: "MEDI101A", year: "4th Year", term: "3rd Trimester", isGenEd: false },
  { code: "MEDI107A", title: "EQUINE MEDICINE", units: 2, prereq: "MEDI101A", year: "4th Year", term: "3rd Trimester", isGenEd: false },
  { code: "ESPM101A", title: "ENVIRONMENTAL SCIENCE, PROTECTION AND MANAGEMENT", units: 3, prereq: "ZOOL101A, ZOOL101B", year: "4th Year", term: "3rd Trimester", isGenEd: false },

  // ───── DVM 5th Year - 1st Trimester ─────
  { code: "MEDI108A", title: "APICULTURE, WILDLIFE CONSERVATION AND MEDICINE", units: 2, prereq: "MEDI101A", year: "5th Year", term: "1st Trimester", isGenEd: false },
  { code: "MEDI109A", title: "AQUACULTURE AND AQUATIC ANIMAL MEDICINE", units: 2, prereq: "MEDI101A", year: "5th Year", term: "1st Trimester", isGenEd: false },
  { code: "MEDI110A", title: "LABORATORY ANIMAL MANAGEMENT AND MEDICINE", units: 2, prereq: "MEDI101A", year: "5th Year", term: "1st Trimester", isGenEd: false },
  { code: "PUHL101A", title: "ENVIRONMENTAL ANIMAL HEALTH AND BIOSAFETY", units: 2, prereq: "MICR104A", year: "5th Year", term: "1st Trimester", isGenEd: false },
  { code: "PUHL102A", title: "VETERINARY ZOONOSES, EIDs AND ONE HEALTH", units: 3, prereq: "MICR104A", year: "5th Year", term: "1st Trimester", isGenEd: false },
  { code: "STAT101A", title: "BIOSTATISTICS", units: 3, prereq: "None", year: "5th Year", term: "1st Trimester", isGenEd: false },
  { code: "CORE110", title: "ETHICS", units: 3, prereq: "None", year: "5th Year", term: "1st Trimester", isGenEd: true },

  // ───── DVM 5th Year - 2nd Trimester ─────
  { code: "PUHL103A", title: "VETERINARY EPIDEMIOLOGY", units: 3, prereq: "PUHL101A", year: "5th Year", term: "2nd Trimester", isGenEd: false },
  { code: "MEDI111A", title: "VETERINARY PRACTICE MANAGEMENT AND ENTREPRENEURSHIP", units: 2, prereq: "MEDI101A, MEDI108A, MEDI109A, MEDI110A", year: "5th Year", term: "2nd Trimester", isGenEd: false },
  { code: "MEDI112A", title: "VETERINARY THERIOGENOLOGY LEC", units: 1, prereq: "MEDI101A, MEDI108A, MEDI109A, MEDI110A", year: "5th Year", term: "2nd Trimester", isGenEd: false },
  { code: "MEDI112B", title: "VETERINARY THERIOGENOLOGY LAB", units: 1, prereq: "MEDI101A, MEDI108A, MEDI109A, MEDI110A", year: "5th Year", term: "2nd Trimester", isGenEd: false },
  { code: "MEDI113A", title: "VETERINARY JURISPRUDENCE AND ETHICS", units: 2, prereq: "MEDI101A, MEDI108A, MEDI109A, MEDI110A", year: "5th Year", term: "2nd Trimester", isGenEd: false },
  { code: "CLIN101B", title: "INTRODUCTION TO VETERINARY CLINICS", units: 2, prereq: "MEDI108A, MEDI109A, MEDI110A, PUHL101A, PUHL102A, STAT101A", year: "5th Year", term: "2nd Trimester", isGenEd: false },
  { code: "THES101B", title: "VETERINARY THESIS 1 (Thesis Proposal and Outline Defense)", units: 2, prereq: "STAT101A, RMSW101A", year: "5th Year", term: "2nd Trimester", isGenEd: false },

  // ───── DVM 5th Year - 3rd Trimester ─────
  { code: "PUHL104A", title: "VETERINARY FOOD SAFETY AND HYGIENE LEC", units: 2, prereq: "PUHL103A", year: "5th Year", term: "3rd Trimester", isGenEd: false },
  { code: "PUHL104B", title: "VETERINARY FOOD SAFETY AND HYGIENE LAB", units: 1, prereq: "PUHL103A", year: "5th Year", term: "3rd Trimester", isGenEd: false },
  { code: "SURG104A", title: "LARGE ANIMAL SURGERY LEC", units: 1, prereq: "SURG101A, SURG101B, SURG103A, SURG103B", year: "5th Year", term: "3rd Trimester", isGenEd: false },
  { code: "SURG104B", title: "LARGE ANIMAL SURGERY LAB", units: 2, prereq: "SURG101A, SURG101B, SURG103A, SURG103B", year: "5th Year", term: "3rd Trimester", isGenEd: false },
  { code: "CLIN102B", title: "CLERKSHIP", units: 2, prereq: "CLIN101B", year: "5th Year", term: "3rd Trimester", isGenEd: false },
  { code: "THES102B", title: "VETERINARY THESIS 2 (Thesis Conduct and Defense)", units: 2, prereq: "THES101B", year: "5th Year", term: "3rd Trimester", isGenEd: false },

  // ───── DVM 6th Year - 1st, 2nd, 3rd Trimester ─────
  { code: "CLIN103B", title: "VETERINARY CLINICAL INTERNSHIP 1", units: 10, prereq: "PUHL104A, PUHL104B, SURG104A, SURG104B, CLIN102B", year: "6th Year", term: "1st Trimester", isGenEd: false },
  { code: "VCIP101A", title: "VETERINARY COURSE INTEGRATION PROGRAM 1", units: 3, prereq: "PUHL104A, PUHL104B, SURG104A, SURG104B, CLIN102B", year: "6th Year", term: "1st Trimester", isGenEd: false },
  { code: "CLIP103B", title: "VETERINARY CLINICO-PATHOLOGICAL CONFERENCE 1", units: 1, prereq: "PUHL104A, PUHL104B, SURG104A, CLIN102B, SURG104B", year: "6th Year", term: "1st Trimester", isGenEd: false },
  { code: "CLIN104B", title: "VETERINARY CLINICAL INTERNSHIP 2 (Field Experience)", units: 6, prereq: "CLIN103B", year: "6th Year", term: "2nd Trimester", isGenEd: false },
  { code: "VCIP102A", title: "VETERINARY COURSE INTEGRATION PROGRAM 2", units: 3, prereq: "CLIN103B", year: "6th Year", term: "2nd Trimester", isGenEd: false },
  { code: "CLIP104B", title: "VETERINARY CLINICO-PATHOLOGICAL CONFERENCE 2", units: 1, prereq: "CLIP103B", year: "6th Year", term: "2nd Trimester", isGenEd: false },
  { code: "CLIN105B", title: "VETERINARY CLINICAL INTERNSHIP 3 (Field Exp./Area of Interest)", units: 6, prereq: "CLIN104B", year: "6th Year", term: "3rd Trimester", isGenEd: false },
  { code: "VCIP103A", title: "VETERINARY COURSE INTEGRATION PROGRAM 3", units: 3, prereq: "CLIN104B", year: "6th Year", term: "3rd Trimester", isGenEd: false },

  // ───── BSA Subjects ─────
  { code: "BACC102A", title: "FINANCIAL ACCOUNTING AND REPORTING", units: 6, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: false },
  { code: "BACC122A", title: "CONCEPTUAL FRAMEWORK AND ACCOUNTING STANDARDS", units: 3, prereq: "None", year: "1st Year", term: "1st Trimester", isGenEd: false },
  { code: "BACC112A", title: "INTERMEDIATE ACCOUNTING 1", units: 3, prereq: "BACC102A", year: "1st Year", term: "2nd Trimester", isGenEd: false },
  { code: "CORE114", title: "LIVING IN THE I.T. ERA", units: 3, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: true },
  { code: "COMP101A", title: "I.T. APPLICATION TOOLS IN BUSINESS LEC", units: 2, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "COMP101B", title: "I.T. APPLICATION TOOLS IN BUSINESS LAB", units: 1, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "ECON201A", title: "MANAGERIAL ECONOMICS", units: 3, prereq: "None", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "BACC121A", title: "INTERMEDIATE ACCOUNTING 2", units: 3, prereq: "BACC112A", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "BACC132A", title: "COST ACCOUNTING AND CONTROL", units: 3, prereq: "BACC112A", year: "1st Year", term: "3rd Trimester", isGenEd: false },
  { code: "CORE202", title: "THE ENTREPRENEURIAL MIND", units: 3, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: true },
  { code: "ECON202A", title: "ECONOMIC DEVELOPMENT", units: 3, prereq: "ECON201A", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "PREL101A", title: "PROFESSIONAL ELECTIVES (Valuation Concepts and Methods)", units: 3, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT211A", title: "MANAGEMENT SCIENCE", units: 3, prereq: "BACC132A", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "BLAW211A", title: "LAW ON OBLIGATIONS AND CONTRACTS", units: 3, prereq: "None", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "BACC131A", title: "INTERMEDIATE ACCOUNTING 3", units: 3, prereq: "BACC121A", year: "2nd Year", term: "1st Trimester", isGenEd: false },
  { code: "GEEL101A", title: "GENERAL ELECTIVES (Business Logic)", units: 3, prereq: "None", year: "2nd Year", term: "2nd Trimester", isGenEd: true },
  { code: "BMEC101A", title: "STRATEGIC MANAGEMENT", units: 3, prereq: "None", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "COMP102A", title: "STATISTICAL ANALYSIS WITH SOFTWARE APPLICATION LEC", units: 2, prereq: "COMP101A, COMP101B", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "COMP102B", title: "STATISTICAL ANALYSIS WITH SOFTWARE APPLICATION LAB", units: 1, prereq: "COMP101A, COMP101B", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT221A", title: "ACCOUNTING FOR SPECIAL TRANSACTION", units: 6, prereq: "BACC131A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT232A", title: "FINANCIAL MANAGEMENT", units: 3, prereq: "ACCT211A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BLAW221A", title: "BUSINESS LAWS AND REGULATIONS (Law on Sales and Credit Transactions)", units: 3, prereq: "BLAW211A", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BTAX211A", title: "INCOME TAXATION", units: 3, prereq: "None", year: "2nd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BMEC102A", title: "OPERATIONS MANAGEMENT (TQM)", units: 3, prereq: "BMEC101A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "PREL102A", title: "PROFESSIONAL ELECTIVES (Updates in Financial Reporting Standards)", units: 3, prereq: "None", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT231A", title: "AUDITING AND ASSURANCE PRINCIPLES", units: 3, prereq: "ACCT221A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT312A", title: "GOVERNANCE, BUSINESS ETHICS, RISK MANAGEMENT AND INTERNAL CONTROL", units: 3, prereq: "ACCT221A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT314A", title: "FINANCIAL MARKETS", units: 3, prereq: "ACCT232A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT334A", title: "STRATEGIC COST MANAGEMENT", units: 3, prereq: "ACCT232A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "BLAW231A", title: "BUSINESS LAW AND REGULATIONS (Law on Negotiable Instruments)", units: 3, prereq: "BLAW221A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "BTAX221A", title: "BUSINESS TAXATION", units: 3, prereq: "BTAX211A", year: "2nd Year", term: "3rd Trimester", isGenEd: false },
  { code: "PREL103A", title: "PROFESSIONAL ELECTIVES (Operations Auditing)", units: 3, prereq: "None", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "PREL104A", title: "PROFESSIONAL ELECTIVES (Principles and Methods of Teaching Accounting)", units: 3, prereq: "None", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT311A", title: "ACCOUNTING FOR BUSINESS COMBINATIONS", units: 3, prereq: "ACCT221A", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT322A", title: "ACCOUNTING FOR GOVERNMENT AND NON-PROFIT ORGANIZATIONS", units: 3, prereq: "ACCT221A", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT323A", title: "AUDITING AND ASSURANCE: CONCEPTS AND APPLICATIONS 1", units: 3, prereq: "ACCT231A", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT234A", title: "ACCOUNTING INFORMATION SYSTEM LEC", units: 2, prereq: "BACC131A", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT234B", title: "ACCOUNTING INFORMATION SYSTEM LAB", units: 1, prereq: "BACC131A", year: "3rd Year", term: "1st Trimester", isGenEd: false },
  { code: "ACCT331A", title: "ACCOUNTING RESEARCH METHODS (Thesis 1)", units: 3, prereq: "BACC131A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT324A", title: "AUDITING AND ASSURANCE: CONCEPTS AND APPLICATIONS 2", units: 3, prereq: "ACCT323A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT332A", title: "AUDITING AND ASSURANCE: SPECIALIZED INDUSTRIES", units: 3, prereq: "ACCT323A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT333A", title: "AUDITING IN A CIS ENVIRONMENT LEC", units: 2, prereq: "ACCT234A, ACCT234B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT333B", title: "AUDITING IN A CIS ENVIRONMENT LAB", units: 1, prereq: "ACCT234A, ACCT234B", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT233A", title: "STRATEGIC BUSINESS ANALYSIS", units: 3, prereq: "ACCT334A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT325A", title: "INTERNATIONAL BUSINESS AND TRADE", units: 3, prereq: "ACCT314A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "BLAW331A", title: "REGULATORY FRAMEWORK AND LEGAL ISSUES IN BUSINESS", units: 3, prereq: "BLAW221A", year: "3rd Year", term: "2nd Trimester", isGenEd: false },
  { code: "ACCT335A", title: "ACCOUNTING INTERNSHIP (600 HOURS)", units: 6, prereq: "ACCT231A", year: "3rd Year", term: "3rd Trimester", isGenEd: false },
  { code: "ACCT336A", title: "ACCOUNTANCY RESEARCH (Thesis 2)", units: 3, prereq: "ACCT331A", year: "3rd Year", term: "3rd Trimester", isGenEd: false },
  { code: "AREV421A", title: "INTEGRATED REVIEW 1 FAR", units: 3, prereq: "BACC131A", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "AREV422A", title: "INTEGRATED REVIEW 2 MAS", units: 3, prereq: "ACCT325A", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "AREV423A", title: "INTEGRATED REVIEW 3 RFBT", units: 3, prereq: "BLAW331A", year: "4th Year", term: "1st Trimester", isGenEd: false },
  { code: "AREV424A", title: "INTEGRATED REVIEW 4 AFAR", units: 3, prereq: "ACCT311A", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "AREV425A", title: "INTEGRATED REVIEW 5 BTAX", units: 3, prereq: "BTAX221A", year: "4th Year", term: "2nd Trimester", isGenEd: false },
  { code: "AREV426A", title: "INTEGRATED REVIEW 6 AUDITING", units: 3, prereq: "ACCT324A", year: "4th Year", term: "2nd Trimester", isGenEd: false },
];

// Dedicated non-overlapping slots for Academic Courses (Mon/Wed, Tue/Thu, Fri)
const ACADEMIC_SLOTS = [
  { days: "Mon, Wed", time: "07:30 AM - 09:00 AM", room: "RM301" },
  { days: "Mon, Wed", time: "09:15 AM - 10:45 AM", room: "RM302" },
  { days: "Mon, Wed", time: "11:00 AM - 12:30 PM", room: "RM304" },
  { days: "Mon, Wed", time: "01:30 PM - 03:00 PM", room: "RM401" },
  { days: "Tue, Thu", time: "07:30 AM - 09:00 AM", room: "RM613" },
  { days: "Tue, Thu", time: "09:15 AM - 10:45 AM", room: "RM608" },
  { days: "Tue, Thu", time: "11:00 AM - 12:30 PM", room: "RM502" },
  { days: "Tue, Thu", time: "01:30 PM - 03:00 PM", room: "RM508" },
  { days: "Fri", time: "01:00 PM - 04:00 PM", room: "RM305" },
];

const CURRICULA = [
  { id: "bs-computer-science", program: "BS Computer Science", terms: CS_TERMS },
  { id: "bs-accountancy", program: "BS Accountancy", terms: BSA_TERMS },
  { id: "bsba-marketing-management", program: "BSBA Marketing Management", terms: MKTG_TERMS },
  { id: "doctor-of-veterinary-medicine", program: "Doctor of Veterinary Medicine", terms: DVM_TERMS },
];

function buildCollisionFreeScheduleMap() {
  const scheduleMap: Record<string, { days: string; time: string; room: string }> = {};

  for (const c of CURRICULA) {
    for (const t of c.terms) {
      const usedSlotsInTerm = new Set<string>();
      for (const code of t.codes) {
        if (scheduleMap[code]?.days && scheduleMap[code]?.time) {
          usedSlotsInTerm.add(`${scheduleMap[code].days}__${scheduleMap[code].time}`);
        }
      }

      let acadIdx = 0;
      for (const code of t.codes) {
        if (
          code === "ACCT335A" ||
          code === "PRAC101A" ||
          code === "CLIN103B" ||
          code === "CLIN104B" ||
          code === "CLIN105B"
        ) {
          scheduleMap[code] = { days: "", time: "", room: "FIELD / VTH" };
          continue;
        }

        if (code.startsWith("PEED")) {
          scheduleMap[code] = {
            days: "Fri",
            time: "08:00 AM - 10:00 AM",
            room: "GYM-01",
          };
          continue;
        }

        if (code.startsWith("NSTP")) {
          scheduleMap[code] = {
            days: "Sat",
            time: "08:00 AM - 11:00 AM",
            room: "FIELD-01",
          };
          continue;
        }

        if (!scheduleMap[code]) {
          while (
            acadIdx < ACADEMIC_SLOTS.length * 2 &&
            usedSlotsInTerm.has(
              `${ACADEMIC_SLOTS[acadIdx % ACADEMIC_SLOTS.length].days}__${
                ACADEMIC_SLOTS[acadIdx % ACADEMIC_SLOTS.length].time
              }`
            )
          ) {
            acadIdx++;
          }
          const slot = ACADEMIC_SLOTS[acadIdx % ACADEMIC_SLOTS.length];
          scheduleMap[code] = {
            days: slot.days,
            time: slot.time,
            room: code.endsWith("B") ? "LAB-608" : slot.room,
          };
          usedSlotsInTerm.add(`${slot.days}__${slot.time}`);
          acadIdx++;
        }
      }
    }
  }

  return scheduleMap;
}

export default function SeedCurriculaPage() {
  const [status, setStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;

  // SAFE SEEDER: Writes DVM, BSA, CS, and Marketing curricula + catalog subjects WITHOUT wiping enlistments
  async function seedCatalogAndCurriculaOnly() {
    setIsRunning(true);
    try {
      setStatus("1/2 Writing CS, BSA, Marketing & DVM flowcharts to `curricula`...");
      for (const c of CURRICULA) {
        await setDoc(doc(db, "curricula", c.id), { program: c.program, terms: c.terms });
      }

      setStatus("2/2 Writing all DVM & BSA subjects with zero-conflict schedules to `subjects`...");
      const scheduleMap = buildCollisionFreeScheduleMap();

      for (let i = 0; i < MASTER_SUBJECTS_CATALOG.length; i += 400) {
        const batch = writeBatch(db);
        MASTER_SUBJECTS_CATALOG.slice(i, i + 400).forEach((subj) => {
          const assigned = scheduleMap[subj.code] || ACADEMIC_SLOTS[0];
          batch.set(
            doc(db, "subjects", subj.code),
            {
              ...subj,
              slots: 40,
              max: 40,
              days: assigned.days,
              time: assigned.time,
              room: subj.room || assigned.room,
            },
            { merge: true }
          );
        });
        await batch.commit();
      }

      setStatus(
        `Done! Seeded all 4 program flowcharts (including 6-year DVM) and ${MASTER_SUBJECTS_CATALOG.length} catalog subjects into Firestore.`
      );
    } catch (e) {
      console.error(e);
      setStatus("Failed to seed catalog. Check the console.");
    } finally {
      setIsRunning(false);
    }
  }

  async function provisionLiveAuthAccounts() {
    setIsRunning(true);
    setStatus("Provisioning live Firebase Auth accounts for Admin, Registrar, and Students...");
    let createdCount = 0;

    try {
      const staffAccounts = [
        { email: "admin@dlsau.edu.ph", password: "password123", role: "admin", name: "System Administrator" },
        { email: "registrar@dlsau.edu.ph", password: "password123", role: "registrar", name: "University Registrar" },
      ];

      for (const staff of staffAccounts) {
        let uid = "";
        try {
          uid = await createAuthUserWithoutLoggingOut(staff.email, staff.password);
          createdCount++;
        } catch (err: any) {
          if (err?.code !== "auth/email-already-in-use") console.warn(err);
        }

        await setDoc(
          doc(db, "users", staff.email),
          {
            email: staff.email,
            role: staff.role,
            name: staff.name,
            ...(uid ? { uid } : {}),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      const studentsSnap = await getDocs(collection(db, "students"));
      for (const stDoc of studentsSnap.docs) {
        const data = stDoc.data();
        const studentId = data.studentId || stDoc.id;
        const authEmail = `${studentId}@dlsau.edu.ph`;

        try {
          const uid = await createAuthUserWithoutLoggingOut(authEmail, "password123");
          await setDoc(doc(db, "students", stDoc.id), { uid, authEmail }, { merge: true });
          createdCount++;
        } catch (err: any) {
          if (err?.code !== "auth/email-already-in-use") console.warn(err);
        }
      }

      setStatus(
        `Done! Provisioned ${createdCount} new Firebase Auth account(s). Log in with admin@dlsau.edu.ph / password123 or any student number / password123.`
      );
    } catch (error) {
      console.error(error);
      setStatus("Failed to provision Auth accounts. Make sure Email/Password Sign-In is enabled in Firebase Console.");
    } finally {
      setIsRunning(false);
    }
  }

  async function resetAndSeedSystem() {
    if (
      !confirm(
        "This will wipe all current student enlistments, seed all DVM/BSA/CS/MKTG subjects, force-assign zero-conflict schedules, and reset all slots to 40/40. Continue?"
      )
    ) {
      return;
    }

    setIsRunning(true);
    try {
      setStatus("1/4 Clearing all existing student enlistments...");
      const enlistSnap = await getDocs(collection(db, "enlistments"));
      for (let i = 0; i < enlistSnap.docs.length; i += 400) {
        const batch = writeBatch(db);
        enlistSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      setStatus("2/4 Writing CS, BSA, Marketing, and DVM flowcharts & catalog...");
      await seedCatalogAndCurriculaOnly();

      setStatus("3/4 Updating all existing subjects with zero-conflict meeting times...");
      const scheduleMap = buildCollisionFreeScheduleMap();
      const subjectsSnap = await getDocs(collection(db, "subjects"));
      const allSubjects = subjectsSnap.docs.map((d) => ({
        docId: d.id,
        ...(d.data() as any),
      }));

      let fallbackIdx = 0;
      for (let i = 0; i < allSubjects.length; i += 400) {
        const batch = writeBatch(db);
        allSubjects.slice(i, i + 400).forEach((s) => {
          const code = s.code || s.docId;
          const assigned =
            scheduleMap[code] || ACADEMIC_SLOTS[fallbackIdx++ % ACADEMIC_SLOTS.length];
          const maxSlots = s.max ?? 40;

          batch.update(doc(db, "subjects", s.docId), {
            slots: maxSlots,
            max: maxSlots,
            days: assigned.days,
            time: assigned.time,
            room: s.room && s.room !== "TBA" ? s.room : assigned.room,
          });
        });
        await batch.commit();
      }

      setStatus("4/4 Resetting active term to 1st Trimester...");
      await setDoc(
        doc(db, "settings", "academic"),
        {
          schoolYear: "2026-2027",
          currentTerm: "1st Trimester",
          enrollmentOpen: true,
          maxUnitsDefault: 23,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setStatus(
        `Done! Wiped ${enlistSnap.size} old enlistments, seeded DVM & BSA catalog, and force-updated ${allSubjects.length} subjects with zero-conflict schedules.`
      );
    } catch (e) {
      console.error(e);
      setStatus("Reset failed. Check console.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-10 font-sans">
      <div className="border border-emerald-900/15 border-l-4 border-l-emerald-800 bg-white p-6 shadow-xs">
        <h1 className="text-xl font-bold text-emerald-950">
          Seed Curricula, DVM Catalog &amp; Schedules
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Seeds the complete 6-year <strong>Doctor of Veterinary Medicine (DVM)</strong>, <strong>BS Accountancy</strong>, <strong>BS Computer Science</strong>, and <strong>BSBA Marketing</strong> flowcharts and writes all missing courses into <code>subjects</code>.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            onClick={seedCatalogAndCurriculaOnly}
            disabled={isRunning}
            className="w-full border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-left text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {isRunning ? "Seeding..." : "1. Seed DVM & BSA Catalog Subjects + Flowcharts (Safe — Keeps Enlistments)"}
          </button>
          <button
            onClick={resetAndSeedSystem}
            disabled={isRunning}
            className="w-full border-l-4 border-red-400 bg-red-800 px-5 py-2.5 text-left text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isRunning ? "Working..." : "2. Full Reset: Wipe Enlistments & Force-Fix All Schedules"}
          </button>
          <button
            onClick={provisionLiveAuthAccounts}
            disabled={isRunning}
            className="w-full border border-emerald-800 bg-white px-5 py-2.5 text-left text-sm font-bold text-emerald-950 hover:bg-emerald-50 disabled:opacity-50"
          >
            {isRunning ? "Working..." : "3. Provision Live Firebase Auth (Admin, Registrar & Students)"}
          </button>
        </div>
        {status && (
          <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}