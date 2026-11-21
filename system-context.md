# System context

Generated 2026-11-20T06:14:20.103Z

## Source files

- app/admin/students/new/page.tsx
- app/admin/students/page.tsx
- app/applications/page.tsx
- app/apply/page.tsx
- app/auth/force-change-password/page.tsx
- app/catalog/page.tsx
- app/curriculum/page.tsx
- app/dashboard/page.tsx
- app/dev/firestore-check/page.tsx
- app/dev/seed-curricula/page.tsx
- app/dev/timetable-preview/page.tsx
- app/eaf/page.tsx
- app/layout.tsx
- app/ledger/page.tsx
- app/page.tsx
- app/schedule/page.tsx
- components/AdminNavbar.tsx
- components/Navbar.tsx
- components/RegistrarNavbar.tsx
- components/Studentprofile.tsx
- components/WeeklyTimetable.tsx
- components/catalog/EnlistmentBar.tsx
- components/catalog/RecommendedPanel.tsx
- components/catalog/SubjectCard.tsx
- components/schedule/DailyScheduleList.tsx
- components/schedule/WeeklyTimetable.tsx
- components/schedule/types.ts
- lib/academicConfig.ts
- lib/applications.ts
- lib/autoSchedule.ts
- lib/enlistments.ts
- lib/firebase.ts

## Collections used in code

- **applications**: app/applications/page.tsx, app/apply/page.tsx, app/dev/firestore-check/page.tsx, components/AdminNavbar.tsx, components/RegistrarNavbar.tsx, lib/applications.ts
- **counters**: lib/applications.ts
- **curricula**: app/catalog/page.tsx, app/curriculum/page.tsx, app/dev/seed-curricula/page.tsx, app/ledger/page.tsx
- **enlistments**: app/catalog/page.tsx, app/dashboard/page.tsx, app/dev/seed-curricula/page.tsx, app/eaf/page.tsx, app/ledger/page.tsx, app/schedule/page.tsx, lib/enlistments.ts
- **settings**: app/admin/students/page.tsx, app/dev/seed-curricula/page.tsx, lib/academicConfig.ts
- **students**: app/admin/students/new/page.tsx, app/admin/students/page.tsx, app/auth/force-change-password/page.tsx, app/catalog/page.tsx, app/dashboard/page.tsx, app/dev/seed-curricula/page.tsx, app/eaf/page.tsx, app/ledger/page.tsx, app/page.tsx, lib/applications.ts
- **subjects**: app/catalog/page.tsx, app/curriculum/page.tsx, app/dev/seed-curricula/page.tsx, app/dev/timetable-preview/page.tsx, app/eaf/page.tsx, app/ledger/page.tsx, app/schedule/page.tsx
- **users**: app/dev/seed-curricula/page.tsx, app/page.tsx

## Firestore schema (from live data)

### applications  (8 docs, scanned 8)
Fields (present in x of 8 docs):
- applicant.addressLine: string  (8)
- applicant.birthDate: string  (8)
- applicant.citizenship: string  (8)  values: Filipino | Filipino/Chinese/Spanish
- applicant.city: string  (8)  values: Malabon City | Valenzuela | Meycauayan | caloocan | Malabon
- applicant.civilStatus: string  (3)  values: Single
- applicant.consent: boolean  (8)
- applicant.email: string  (8)
- applicant.entryTerm: string  (3)  values: 1st Trimester | 1st Semester
- applicant.firstName: string  (8)
- applicant.generalAverage: string  (3)  values: 98.6 | 99 | 
- applicant.guardianEmail: string  (3)
- applicant.guardianMobile: string  (8)
- applicant.guardianName: string  (8)
- applicant.guardianOccupation: string  (3)
- applicant.guardianRelationship: string  (8)
- applicant.heardFrom: string  (3)  values: Facebook / social media | Other
- applicant.lastName: string  (8)
- applicant.lrn: string  (3)  values: 136846120176 | 
- applicant.middleName: string  (8)
- applicant.mobile: string  (8)
- applicant.placeOfBirth: string  (3)
- applicant.previousSchool: string  (8)  values: Arellano University - Elisa Esguerra Campus | ST. GABRIEL ACADEMY | Harvard High School | STI College Caloocan | School | ces | Test School
- applicant.previousSchoolCity: string  (3)  values: Malabon City | Tondo | Caloocan City
- applicant.previousSchoolType: string  (3)  values: Private | Public
- applicant.previousTrack: string  (8)  values: HUMSS | ABM | STEM | IT-MAWD | ICT-MAWD | stem
- applicant.programId: string  (8)  values: bs-computer-science | bs-accountancy | doctor-of-veterinary-medicine
- applicant.province: string  (8)  values: Metro Manila | Bulacan | bulacan
- applicant.secondProgramId: string  (3)  values: bs-accountancy | bsba-marketing-management | 
- applicant.sex: string  (8)  values: Female | Male
- applicant.specialNeeds: string  (3)  values:  | Well Functioning Citizen
- applicant.suffix: string  (8)  values: 
- applicant.yearGraduated: string  (8)  values: 2025 | 2026 | 2024
- applicant.zip: string  (8)  values: 1442 |  | 3024
- consentAtIso: string  (3)  values: 2026-11-20T06:00:48.406Z | 2026-11-03T07:58:37.087Z | 2026-11-03T07:45:55.293Z
- createdAt: timestamp  (8)
- documents.form138: boolean  (8)
- documents.goodMoral: boolean  (8)
- documents.psa: boolean  (8)
- reference: string  (8)
- reviewNote: string  (8)  values: 
- reviewedAt: timestamp  (8)
- reviewedBy: string  (8)  values: System Admin
- schemaVersion: number  (3)
- status: string  (8)  values: approved
- studentNumber: string  (8)  values: 2026-00-000010 | 2026-00-000006 | 2026-00-000009 | 2026-00-000008 | 2026-00-000005 | 2026-00-000003 | 2026-00-000007 | 2026-00-000002
- submittedAtIso: string  (7)  values: 2026-11-20T06:00:48.406Z | 2026-10-20T07:05:33.260Z | 2026-11-03T07:58:37.087Z | 2026-11-03T07:45:55.293Z | 2026-10-20T04:19:35.768Z | 2026-10-18T23:41:54.165Z | 2026-10-20T07:34:44.745Z
- type: string  (8)  values: freshman
- updatedAt: timestamp  (8)
- yearLevelAssigned: string  (8)  values: 1st Year
Example docs (redacted):
```json
{
  "_id": "APP-20…",
  "reference": "<redacted>",
  "type": "freshman",
  "schemaVersion": 2,
  "applicant": {
    "firstName": "<redacted>",
    "middleName": "<redacted>",
    "lastName": "<redacted>",
    "suffix": "",
    "birthDate": "<redacted>",
    "placeOfBirth": "<redacted>",
    "sex": "Female",
    "civilStatus": "Single",
    "citizenship": "Filipino",
    "specialNeeds": "",
    "email": "<redacted>",
    "mobile": "<redacted>",
    "addressLine": "<redacted>",
    "city": "Malabon City",
    "province": "Metro Manila",
    "zip": "1442",
    "guardianName": "<redacted>",
    "guardianRelationship": "<redacted>",
    "guardianMobile": "<redacted>",
    "guardianEmail": "<redacted>",
    "guardianOccupation": "<redacted>",
    "previousSchool": "Arellano University - Elisa Es…",
    "previousSchoolType": "Private",
    "previousSchoolCity": "Malabon City",
    "previousTrack": "HUMSS",
    "yearGraduated": "2025",
    "lrn": "136846120176",
    "generalAverage": "98.6",
    "programId": "bs-computer-science",
    "secondProgramId": "bs-accountancy",
    "entryTerm": "1st Trimester",
    "heardFrom": "Facebook / social media",
    "consent": true
  },
  "reviewNote": "",
  "consentAtIso": "2026-11-20T06:00:48.406Z",
  "submittedAtIso": "2026-11-20T06:00:48.406Z",
  "createdAt": "<timestamp>",
  "documents": {
    "psa": true,
    "goodMoral": true,
    "form138": true
  },
  "studentNumber": "2026-00-000010",
  "reviewedAt": "<timestamp>",
  "reviewedBy": "System Admin",
  "status": "approved",
  "yearLevelAssigned": "1st Year",
  "updatedAt": "<timestamp>"
}
```
```json
{
  "_id": "APP-20…",
  "reference": "<redacted>",
  "type": "freshman",
  "applicant": {
    "firstName": "<redacted>",
    "middleName": "<redacted>",
    "lastName": "<redacted>",
    "suffix": "",
    "birthDate": "<redacted>",
    "sex": "Female",
    "citizenship": "Filipino",
    "email": "<redacted>",
    "mobile": "<redacted>",
    "addressLine": "<redacted>",
    "city": "Valenzuela",
    "province": "Metro Manila",
    "zip": "1442",
    "guardianName": "<redacted>",
    "guardianRelationship": "<redacted>",
    "guardianMobile": "<redacted>",
    "previousSchool": "ST. GABRIEL ACADEMY",
    "previousTrack": "ABM",
    "yearGraduated": "2025",
    "programId": "bs-accountancy",
    "consent": true
  },
  "reviewNote": "",
  "submittedAtIso": "2026-10-20T07:05:33.260Z",
  "createdAt": "<timestamp>",
  "documents": {
    "form138": true,
    "goodMoral": true,
    "psa": true
  },
  "studentNumber": "2026-00-000006",
  "reviewedAt": "<timestamp>",
  "reviewedBy": "System Admin",
  "status": "approved",
  "yearLevelAssigned": "1st Year",
  "updatedAt": "<timestamp>"
}
```

### counters  (1 docs, scanned 1)
Fields (present in x of 1 docs):
- last: number  (1)
Example docs (redacted):
```json
{
  "_id": "student-2026",
  "last": 10
}
```

### curricula  (4 docs, scanned 4)
Fields (present in x of 4 docs):
- program: string  (4)  values: BS Accountancy | BS Computer Science | BSBA Marketing Management | Doctor of Veterinary Medicine
- terms[]: object  (4)
- terms[].block: boolean  (4)
- terms[].codes[]: string  (4)  values: CORE101 | CORE107 | CHEF102A
- terms[].term: string  (4)  values: 1st Trimester
- terms[].year: string  (4)  values: 1st Year
Example docs (redacted):
```json
{
  "_id": "bs-acc…",
  "program": "BS Accountancy",
  "terms": [
    {
      "year": "1st Year",
      "term": "1st Trimester",
      "block": true,
      "codes": [
        "CORE101",
        "CORE102"
      ]
    },
    {
      "year": "1st Year",
      "term": "2nd Trimester",
      "block": false,
      "codes": [
        "CORE103",
        "CORE104"
      ]
    }
  ]
}
```
```json
{
  "_id": "bs-com…",
  "program": "BS Computer Science",
  "terms": [
    {
      "term": "1st Trimester",
      "block": true,
      "codes": [
        "CORE107",
        "CORE106"
      ],
      "year": "1st Year"
    },
    {
      "term": "2nd Trimester",
      "codes": [
        "LSVI101",
        "CORE109"
      ],
      "block": false,
      "year": "1st Year"
    }
  ]
}
```

### enlistments  (92 docs, scanned 50)
Fields (present in x of 50 docs):
- code: string  (50)
- confirmedAt: string  (19)  values: 2026-10-20T06:56:10.294Z | 2026-10-20T07:08:46.443Z | 2026-10-20T07:37:13.796Z
- confirmedBy: string  (12)  values: System Admin
- days: string  (50)  values: Mon, Wed | Mon | Tue | Sat | Fri | Tue, Thu
- enlistedAt: string  (50)  values: 2026-10-19T04:08:19.533Z | 2026-10-19T04:14:47.235Z | 2026-10-20T04:22:14.584Z | 2026-10-20T04:26:44.385Z | 2026-10-20T07:30:58.795Z | 2026-10-20T07:07:07.525Z | 2026-10-20T07:36:34.582Z
- enrolledTerm: string  (50)  values: 1st Trimester | 2nd Trimester
- isGenEd: boolean  (50)
- max: number  (50)
- prereq: string  (50)  values: None | CC102A, CC102B | NSTP101A | PEED101 | BACC102A
- room: string  (50)  values: RM304 | LAB-608 | RM302 | RM301 | FIELD-01 | GYM-01 | RM613 | RM401
- schoolYear: string  (50)  values: 2026-2027
- slots: number  (50)
- source: string  (28)  values: block
- status: string  (50)  values: Enrolled | Enlisted
- submittedAt: string  (12)  values: 2026-10-20T07:07:15.943Z | 2026-10-20T07:36:56.562Z
- term: string  (50)  values: 1st Trimester | 2nd Trimester | 3rd Trimester
- time: string  (50)
- title: string  (50)
- units: number  (50)
- updatedAt: string  (12)  values: 2026-10-20T07:08:46.443Z | 2026-10-20T07:37:13.796Z
- userId: string  (50)  values: 2026-00-000003 | 2026-00-000004 | 2026-00-000005 | 2026-00-000006 | 2026-00-000007
- year: string  (50)  values: 1st Year | 2nd Year
Example docs (redacted):
```json
{
  "_id": "2026-0…",
  "title": "ORGANIC CHEMISTRY LEC",
  "year": "1st Year",
  "prereq": "None",
  "days": "Mon, Wed",
  "room": "RM304",
  "slots": 39,
  "max": 40,
  "code": "CHEF102A",
  "time": "11:00 AM - 12:30 PM",
  "term": "1st Trimester",
  "units": 2,
  "isGenEd": false,
  "userId": "2026-00-000003",
  "enrolledTerm": "1st Trimester",
  "schoolYear": "2026-2027",
  "enlistedAt": "2026-10-19T04:08:19.533Z",
  "source": "block",
  "status": "Enrolled"
}
```
```json
{
  "_id": "2026-0…",
  "isGenEd": false,
  "slots": 39,
  "year": "1st Year",
  "units": 1,
  "days": "Mon, Wed",
  "room": "LAB-608",
  "prereq": "None",
  "title": "ORGANIC CHEMISTRY LAB",
  "max": 40,
  "code": "CHEF102B",
  "term": "1st Trimester",
  "time": "01:30 PM - 03:00 PM",
  "userId": "2026-00-000003",
  "enrolledTerm": "1st Trimester",
  "schoolYear": "2026-2027",
  "enlistedAt": "2026-10-19T04:08:19.533Z",
  "source": "block",
  "status": "Enrolled"
}
```

### settings  (1 docs, scanned 1)
Fields (present in x of 1 docs):
- currentTerm: string  (1)  values: 1st Trimester
- enrollmentOpen: boolean  (1)
- maxUnitsDefault: number  (1)
- schoolYear: string  (1)  values: 2026-2027
- updatedAt: string  (1)  values: 2026-11-03T07:51:10.620Z
Example docs (redacted):
```json
{
  "_id": "academic",
  "schoolYear": "2026-2027",
  "maxUnitsDefault": 23,
  "enrollmentOpen": true,
  "currentTerm": "1st Trimester",
  "updatedAt": "2026-11-03T07:51:10.620Z"
}
```

### students  (11 docs, scanned 11)
Fields (present in x of 11 docs):
- academic.admissionType: string  (9)  values: Freshman
- academic.blockEnrolled: boolean|string  (9)  values: Yes
- academic.enrollmentStatus: string  (9)  values: Regular
- academic.major: string  (9)  values: 
- academic.maxUnits: number|string  (9)  values: 23
- academic.program: string  (9)  values: BS Computer Science | Doctor of Veterinary Medicine | BS Accountancy
- academic.scholarship: string  (9)  values: None
- academic.schoolYearAdmitted: string  (9)  values: 2026-2027
- academic.section: string  (10)  values: BSCS1A |  | VETM1A | BACC1A
- academic.semesterAdmitted: string  (9)  values: 1st Semester | 1st Trimester
- academic.yearLevel: string  (9)  values: 1st Year
- address.barangay: string  (9)
- address.city: string  (10)
- address.line: string  (8)
- address.province: string  (10)
- address.street: string  (9)
- address.zip: string  (8)
- address.zipCode: string  (9)
- admittedAt: timestamp  (8)
- admittedBy: string  (8)  values: System Admin
- applicationId: string  (8)  values: eB1zuKw9eNzyQlCz9iRv | APP-2026-UMP6V9 | APP-2026-QSXTNL | APP-2026-FMDUZ9 | APP-2026-VAWUUB | APP-2026-NLEY53 | APP-2026-JX85CN | APP-2026-2PFTSU
- applicationRef: string  (8)
- authEmail: string  (10)
- birthDate: string  (8)
- blockEnrolled: boolean  (11)
- citizenship: string  (8)  values: Filipino | Filipino/Chinese/Spanish
- clearances.accounting: string  (11)  values: cleared | pending
- clearances.clinic: string  (11)  values: cleared | pending
- clearances.disciplinary: string  (11)  values: cleared | pending
- clearances.guidance: string  (10)  values: cleared | pending
- clearances.laboratory: string  (10)  values: cleared | pending
- clearances.library: string  (11)  values: cleared | pending
- clearances.registrar: string  (10)  values: cleared | pending
- clearances.studentAffairs: string  (10)  values: cleared | pending
- contact.email: string  (9)
- contact.mobileNumber: string  (9)
- contact.personalEmail: string  (9)
- createdAt: string|timestamp  (11)
- eafPayment.amountPaid: number  (5)
- eafPayment.assessedTotal: number  (5)
- eafPayment.channel: string  (5)  values: BDO | UPAY
- eafPayment.paidAt: string  (5)  values: 2026-10-20T06:56:10.294Z | 2026-10-20T07:07:15.943Z | 2026-10-20T07:36:56.562Z | 2026-11-03T08:02:49.153Z | 2026-11-20T06:03:14.573Z
- eafPayment.plan: string  (5)  values: Installment4B | Full
- eafPayment.referenceNo: string  (5)
- eafPayment.schoolYear: string  (5)  values: 2026-2027
- eafPayment.settled: boolean  (5)
- eafPayment.status: string  (4)  values: verified | for_verification
- eafPayment.term: string  (5)  values: 2nd Trimester | 1st Trimester
- eafPayment.verifiedAt: string  (2)  values: 2026-10-20T07:08:46.443Z | 2026-10-20T07:37:13.796Z
- eafPayment.verifiedBy: string  (2)  values: System Admin
- email: string  (11)
- emergency.contactName: string  (9)
- emergency.contactNumber: string  (9)
- emergency.relationship: string  (9)  values: Mother | father | Father | mother | Step Brother | Legal Guardian
- enrollmentStatus: string  (11)  values: Regular
- family.fatherContact: string  (9)
- family.fatherName: string  (9)
- family.fatherOccupation: string  (9)  values: N/A | 
- family.guardianContact: string  (9)
- family.guardianName: string  (9)
- family.guardianRelationship: string  (9)
- family.motherContact: string  (9)
- family.motherMaidenName: string  (9)
- family.motherName: string  (9)
- family.motherOccupation: string  (9)  values: Bank |  | N/A
- firstName: string  (11)
- guardian.mobile: string  (8)
- guardian.name: string  (8)
- guardian.relationship: string  (8)
- health.allergies: string  (9)  values: None | 
- health.bloodType: string  (9)  values: Unknown
- health.medicalNotes: string  (9)  values: 
- health.pwd: string  (9)  values: No
- lastName: string  (11)
- maxUnits: number  (9)
- middleName: string  (8)
- mobile: string  (8)
- mustChangePassword: boolean  (8)
- passwordUpdatedAt: string  (8)
- personal.citizenship: string  (9)  values: Filipino | Filipino/Chinese/Spanish
- personal.civilStatus: string  (9)  values: Single
- personal.dateOfBirth: string  (9)
- personal.firstName: string  (9)
- personal.lastName: string  (9)
- personal.lrn: string  (9)  values: 192312309128 |  | 121020121021
- personal.middleName: string  (9)
- personal.placeOfBirth: string  (9)
- personal.religion: string  (9)  values: Catholic | 
- personal.sex: string  (9)  values: Male | Female
- personal.studentId: string  (9)
- personal.suffix: string  (9)  values: 
- personalEmail: string  (8)
- previousSchool.gwa: string  (9)  values: 91 | 
- previousSchool.lastCollegeAttended: string  (9)  values: 
- previousSchool.name: string  (8)
- previousSchool.shsName: string  (9)
- previousSchool.shsStrand: string  (9)  values: TVL - ICT | ICT-MAWD | STEM | ABM | stem | IT-MAWD | HUMSS
- previousSchool.track: string  (8)  values: STEM | ICT-MAWD | ABM | stem | IT-MAWD | HUMSS
- previousSchool.yearGraduated: string  (10)  values: 2024 | 2026 | 2025
- program: string  (11)  values: BS Computer Science | BS Accountancy | Doctor of Veterinary Medicine
- programId: string  (8)  values: bs-accountancy | doctor-of-veterinary-medicine | bs-computer-science
- requirements.form138: boolean  (9)
- requirements.goodMoral: boolean  (9)
- requirements.honorableDismissal: boolean  (9)
- requirements.idPictures: boolean  (9)
- requirements.medicalCertificate: boolean  (9)
- requirements.psaBirthCertificate: boolean  (9)
- requirements.transcriptOfRecords: boolean  (9)
- role: string  (10)  values: student
- section: string  (8)  values: VETM1A | BSCS1A | BACC1A
- sex: string  (8)  values: Female | Male
- studentId: string  (10)
- studentNumber: string  (8)  values: 2026-00-000002 | 2026-00-000003 | 2026-00-000005 | 2026-00-000006 | 2026-00-000007 | 2026-00-000008 | 2026-00-000009 | 2026-00-000010
- suffix: string  (8)  values: 
- uid: string  (3)  values: oXpFfo7T9cPwhMkURvDv62jvoys2 | TiGFpk4zSYZg6xdfTsjwKJlIfRz1 | qPMCiSzjLuXgA8WJY9Jd1XwxaeB2
- updatedAt: string  (11)  values: 2026-11-03T07:51:10.620Z | 2026-11-19T03:19:52.870Z | 2026-11-03T08:02:49.153Z | 2026-11-20T06:03:14.573Z
- yearLevel: string  (11)  values: 1st Year
Example docs (redacted):
```json
{
  "_id": "2024-0…",
  "studentId": "2024-00-000890",
  "firstName": "<redacted>",
  "lastName": "<redacted>",
  "email": "<redacted>",
  "program": "BS Computer Science",
  "yearLevel": "1st Year",
  "enrollmentStatus": "Regular",
  "clearances": {
    "library": "cleared",
    "accounting": "cleared",
    "clinic": "cleared",
    "disciplinary": "cleared"
  },
  "role": "student",
  "createdAt": "2026-10-14T02:13:59.940Z",
  "uid": "oXpFfo7T9cPwhMkURvDv62jvoys2",
  "authEmail": "<redacted>",
  "blockEnrolled": false,
  "updatedAt": "2026-11-03T07:51:10.620Z"
}
```
```json
{
  "_id": "2026-0…",
  "personal": {
    "studentId": "2026-00-000001",
    "lrn": "192312309128",
    "firstName": "<redacted>",
    "middleName": "<redacted>",
    "lastName": "<redacted>",
    "suffix": "",
    "dateOfBirth": "<redacted>",
    "placeOfBirth": "<redacted>",
    "sex": "Male",
    "civilStatus": "Single",
    "citizenship": "Filipino",
    "religion": "Catholic"
  },
  "contact": "<redacted>",
  "address": "<redacted>",
  "family": {
    "fatherName": "<redacted>",
    "fatherOccupation": "N/A",
    "fatherContact": "<redacted>",
    "motherName": "<redacted>",
    "motherMaidenName": "<redacted>",
    "motherOccupation": "Bank",
    "motherContact": "<redacted>",
    "guardianName": "<redacted>",
    "guardianRelationship": "<redacted>",
    "guardianContact": "<redacted>"
  },
  "emergency": {
    "contactName": "<redacted>",
    "relationship": "Mother",
    "contactNumber": "<redacted>"
  },
  "previousSchool": {
    "shsName": "<redacted>",
    "shsStrand": "TVL - ICT",
    "yearGraduated": "2024",
    "gwa": "91",
    "lastCollegeAttended": ""
  },
  "health": {
    "bloodType": "Unknown",
    "allergies": "None",
    "medicalNotes": "",
    "pwd": "No"
  },
  "requirements": {
    "psaBirthCertificate": "<redacted>",
    "form138": true,
    "goodMoral": true,
    "medicalCertificate": true,
    "idPictures": true,
    "transcriptOfRecords": false,
    "honorableDismissal": false
  },
  "studentId": "2026-00-000001",
  "firstName": "<redacted>",
  "lastName": "<redacted>",
  "email": "<redacted>",
  "program": "BS Computer Science",
  "yearLevel": "1st Year",
  "enrollmentStatus": "Regular",
  "role": "student",
  "createdAt": "2026-10-15T00:51:20.719Z",
  "academic": {
    "enrollmentStatus": "Regular",
    "yearLevel": "1st Year",
    "major": "",
    "scholarship": "None",
    "section": "BSCS1A",
    "admissionType": "Freshman",
    "schoolYearAdmitted": "2026-2027",
    "program": "BS Computer Science",
    "semesterAdmitted": "1st Semester",
    "maxUnits": 23,
    "blockEnrolled": true
  },
  "maxUnits": 23,
  "clearances": {
    "library": "cleared",
    "accounting": "cleared",
    "clinic": "cleared",
    "disciplinary": "cleared",
    "registrar": "cleared",
    "guidance": "cleared",
    "laboratory": "cleared",
    "studentAffairs": "cleared"
  },
  "blockEnrolled": false,
  "updatedAt": "2026-11-03T07:51:10.620Z"
}
```

### subjects  (262 docs, scanned 50)
Fields (present in x of 50 docs):
- code: string  (50)
- days: string  (50)  values: Mon, Wed | Tue, Thu | 
- isGenEd: boolean  (50)
- max: number  (50)
- prereq: string  (50)
- room: string  (50)
- slots: number  (50)
- term: string  (50)  values: 1st Trimester | 2nd Trimester | 3rd Trimester
- time: string  (50)  values: 01:30 PM - 03:00 PM | 07:30 AM - 09:00 AM | 11:00 AM - 12:30 PM | 09:15 AM - 10:45 AM | 
- title: string  (50)
- units: number  (50)
- year: string  (50)  values: 2nd Year | 3rd Year | 4th Year | 1st Year
Example docs (redacted):
```json
{
  "_id": "ACCT211A",
  "slots": 40,
  "code": "ACCT211A",
  "max": 40,
  "year": "2nd Year",
  "isGenEd": false,
  "term": "1st Trimester",
  "units": 3,
  "title": "MANAGEMENT SCIENCE",
  "prereq": "BACC132A",
  "days": "Mon, Wed",
  "time": "01:30 PM - 03:00 PM",
  "room": "RM401"
}
```
```json
{
  "_id": "ACCT221A",
  "slots": 40,
  "code": "ACCT221A",
  "max": 40,
  "year": "2nd Year",
  "isGenEd": false,
  "term": "2nd Trimester",
  "units": 6,
  "title": "ACCOUNTING FOR SPECIAL TRANSAC…",
  "prereq": "BACC131A",
  "days": "Tue, Thu",
  "time": "07:30 AM - 09:00 AM",
  "room": "RM613"
}
```

### users  (4 docs, scanned 4)
Fields (present in x of 4 docs):
- email: string  (3)
- name: string  (3)
- role: string  (3)  values: admin | registrar
- uid: string  (1)  values: ubHRFFylePRLgM889Ytwrs0QGEy1
- updatedAt: string  (2)  values: 2026-10-18T08:55:36.214Z | 2026-10-18T08:55:37.902Z
- userID: string  (1)  values: 2024-00123
Example docs (redacted):
```json
{
  "_id": "DRpblE…",
  "userID": "2024-00123"
}
```
```json
{
  "_id": "Z6kEIp…",
  "role": "admin",
  "email": "<redacted>",
  "name": "<redacted>"
}
```

## lib/academicConfig.ts

```
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
```
