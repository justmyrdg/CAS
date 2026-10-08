# CogniView AR — Test Report

Unit and system test results recorded on October 2, 2026. **2 of 6 tests failed** (002 and 004). Both have the same cause, explained in [Findings](#findings).

| Test ID | Function / Test Case | Test Type | Date Tested | Tested By | Actual Result / Remarks | Status |
|---|---|---|---|---|---|---|
| 001 | User Authentication – Login Validation | Unit | October 2, 2026 | Maloles, Arman R. | Valid login accepted; invalid password rejected with validation message. | Passed |
| **🔴 002** | **Quiz Creation – Matching** | **Unit** | **October 2, 2026** | **Maloles, Arman R.** | **Quiz creation tested; removing a submitted answer works only once, and another answer cannot be removed.** | **🔴 FAILED** |
| 003 | Class Creation | Unit | October 2, 2026 | Medina, Lander M. | Class was created, saved, and displayed in the instructor’s class list. | Passed |
| **🔴 004** | **Quiz Creation – Enumeration** | **Unit** | **October 2, 2026** | **Medina, Lander M.** | **Quiz creation tested; removing a submitted answer works only once, and another answer cannot be removed.** | **🔴 FAILED** |
| 005 | Create Subject | System Testing | October 2, 2026 | Farol, Roberto Jr. B. | Subject was created and added to the Subjects table; user was redirected to its subject management page. | Passed |
| 006 | Add Instructor | System Testing | October 2, 2026 | Aumento, Francien A. | Instructor details were saved and displayed; generated password was shown to the administrator without errors. | Passed |

## Findings

> **🔴 Cause for both failures (002 and 004):** the remove button is not broken. The editor enforces a minimum of 2 items and never told the tester.

### 🔴 002 — Quiz Creation – Matching

- **Where:** Instructor portal → class → **Assessments** tab → new quiz/exam → add a **Matching** question (`/classes/:id/assessments/new`).
- **Start:** a new Matching question has **3 pairs**.
- **Limit:** at least **2 pairs**. The ✕ ("Remove pair") button is disabled at 2, and the backend rejects fewer (`.min(2, 'Give at least 2 pairs')` in `backend/src/utils/assessmentQuestions.ts`).
- **Result:** the first removal works (3 → 2). The next ✕ is greyed out, with no message saying why.

### 🔴 004 — Quiz Creation – Enumeration

- **Where:** the same page, adding an **Enumeration** question.
- **Start:** a new Enumeration question has **3 answers** (`answers: ['', '', '']` in `assessmentTypes.ts`).
- **Limit:** at least **2 answers**. The ✕ ("Remove") button is disabled at 2, and the backend rejects fewer (`.min(2, 'Give at least 2 answers')` in `backend/src/utils/assessmentQuestions.ts`).
- **Result:** identical to 002. The first removal works (3 → 2), then the ✕ buttons are greyed out with no explanation.
- **Note:** the "Answers must be in this order" checkbox does not affect removal.

### Fix applied (covers 002 and 004)

In `instructor-web/src/pages/assessments/QuestionEditor.tsx`:

| Question type | Label now shows | Tooltip on the disabled ✕ |
|---|---|---|
| Matching | **Pairs (at least 2)** | "Needs at least 2 pairs" |
| Enumeration | **Answers (3, at least 2)** | "Needs at least 2" |
| Multiple choice / select | Choices (at least 2) | "Needs at least 2 choices" |

- The 2-item minimum itself is unchanged. A matching or enumeration question with one item can't be graded meaningfully.
- **Status:** the change builds cleanly but has **not been re-tested in a browser**. Re-run 002 and 004 to confirm, and mark them Passed only if the testers accept the minimum-of-2 behaviour.
