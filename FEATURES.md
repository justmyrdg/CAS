# CogniView AR — Features by User

CogniView AR is a learning platform for schools that combines course content, class management, learning analytics and augmented reality (AR). It has three apps that share one backend:

| App | Who uses it | Platform |
|---|---|---|
| **Admin Portal** | Administrators and Deans | Web (desktop) |
| **Instructor Portal** | Instructors | Web (desktop) |
| **Student App** | Students | Mobile (Android / iOS), also runs in a browser |

---

## 1. Administrator / Dean (Admin Portal)

### Dashboard
- Headline figures:
  - subjects (with module, lesson and quiz counts), active classes, instructors and students;
  - average completion and average module-quiz score;
  - high-risk students and students predicted to fail.
- **Learning activity chart:** lessons completed, module quizzes taken, and class quizzes and exams submitted, per week for the last 12 weeks.
- **Students at risk:** a breakdown of all class enrollments by risk level (high, moderate, low).
- **Forecast & recommended actions** (predictive and prescriptive):
  - each class now compared with its end-of-term forecast (current completion, projected completion, predicted final score);
  - predicted outcome across the institution (likely to fail, borderline, likely to pass);
  - the most urgent recommended actions across all classes, ranked *Do now*, *This week* or *Suggested*.
- **Comparisons:** subjects compared and classes compared (average completion and quiz score).
- **Results and progress:** module-quiz results by score band, and how far students are through their subjects.
- **Flagged for review:** high-risk students (with reasons) and unusually hard quizzes.
- **Recent activity** feed, and a **by-subject** summary table.
- **Quick actions:** New Subject, Upload AR Model, Add Instructor, Add Student.

### Subjects and course content
- Subject list as a table, with search. A new subject is added in a dialog.
- Subject page with its modules (reorder, edit, delete).
- **Module workspace:** an outline of chapters, lessons and quizzes on the left, the selected editor on the right.
  - Add chapters, lessons and quizzes from the outline; reorder items.
  - Unsaved changes are protected (you're asked before leaving).
- **Lesson editor:**
  - **Blocks:** build a lesson from headings, text, images (uploaded), YouTube videos and *Check Your Understanding* questions.
  - **Hands-on activity:** link an AR model to the lesson.
  - **Preview:** see the unsaved draft inside a phone frame, exactly as students will see it.
- **Chapter quiz editor:** multiple-choice questions with a preview.
- **Module details:**
  - **Overview:** every lesson and quiz written out in full.
  - **Student preview:** click through the module as a student would, with chapters unlocking in order.

### AR Library
- Grid of 3D models with search and a subject filter.
- **Upload models:** from a dialog.
  - Accepted files: `.glb`, a self-contained `.gltf`, or a `.zip` of a `.gltf` with its textures.
  - Models are converted automatically so textures always display correctly.
- **Model page:**
  - interactive 3D preview (rotate and zoom);
  - edit the name, subject and description; replace the file; delete the model.
- **Points of interest:** click on the model to place numbered pins, each with a title and information. Students see them in 3D and in AR.
- **Trigger pictures:** upload pictures (for example a brain diagram from a lesson). When a student points the camera at one, that model appears on it.
- **Printable AR marker** and a **printable AR card** per model (the marker plus a QR code that opens that model).

### Accounts
- **Instructors:** add, edit, enable or disable; new accounts get a temporary password.
- **Students:** add, enable or disable, and reset a password.
- **Administrators & Deans:** add, enable or disable.
- All lists have search, filters and pagination.

### Classes and assessments (institution-wide)
- **Classes:** every class with its instructor, section, term, number of students, status and join code; filter by active or archived.
- **Assessments:** every chapter quiz with its question count, number of students, attempts and average score.

---

## 2. Instructor (Instructor Portal)

### Dashboard
- Headline figures:
  - active classes and total students;
  - average module-quiz score;
  - at-risk students and students predicted to fail.
- **Student activity chart:** activity per week across all of the instructor's classes.
- **Risk overview:** students by risk level.
- **Recommended actions:** the most urgent across all classes, each with an *Open* button that goes to that class.
- **Your classes compared:** completion, module-quiz average, and average on the instructor's own quizzes and exams.
- List of the instructor's classes.

### My Classes
- Create, edit, archive and delete classes (subject, section, term, school year).
- Each class gets a **join code** that students use to join.

### Class page (tabs)
| Tab | What it shows / does |
|---|---|
| **Overview** | Class details and the join code (with a copy button). |
| **Students** | Roster with each student's progress; add a student by SR code; remove a student. |
| **Content** | The subject's lessons and quizzes (read-only), with how many students finished each and the class average on each quiz. |
| **Quizzes** / **Exams** | The instructor's own quizzes and exams for this class (see below). |
| **Performance** | Descriptive analytics, listed below this table. |
| **At-Risk** | Diagnostic analytics, listed below this table. |
| **Insights** | Predictive and prescriptive analytics, listed below this table. |

**Performance tab (descriptive analytics):**
- average completion, module-quiz score, and score on the instructor's own quizzes and exams;
- weekly class activity and the spread of module-quiz averages;
- completion by module, and the lowest-performing topic;
- class average on each quiz or exam;
- a table of every student's stats.

**At-Risk tab (diagnostic analytics):**
- each student's risk level (high, moderate, low) with the reasons;
- charts of risk levels and of why students are flagged;
- the flags: low averages, missed exams or quizzes, inactivity, not started, or falling behind the class.

**Insights tab (predictive and prescriptive analytics):**
- **Headline figures:** predicted class average, projected completion by the end of term, number of students on track, and number predicted to fail.
- **Class completion forecast:** actual progress so far, then a dashed forecast to the end of term.
- **Predicted final scores:** by score band, plus the predicted outcome (likely to fail, borderline, likely to pass).
- **Recommended actions for the class:**
  - reach out to students predicted to fail;
  - remind students who haven't taken an open quiz;
  - grade pending essays;
  - reteach weak chapters;
  - go over questions most students got wrong;
  - plan catch-up for students falling behind.
- **Forecast per student:**
  - predicted final score with its likely range, and chance of failing;
  - projected completion and finish date;
  - confidence level, and the main reasons behind the forecast;
  - a suggested action for that student.

### Quizzes and exams builder
- Create quizzes or exams with **any question type**:
  - multiple choice;
  - multiple select (with partial credit);
  - true or false;
  - identification / short answer (several accepted answers; letter case and spacing ignored);
  - enumeration (ordered or unordered);
  - matching;
  - essay.
- **Settings:**
  - time limit (enforced by the server);
  - maximum attempts;
  - opening and closing dates and times;
  - whether students see the correct answers after submitting;
  - draft or published.
- **Automatic marking** for every type except essays.
- **Results page:**
  - who submitted, their scores and the class average;
  - each submission's answers;
  - grade essays and override points, with feedback.
- Questions are locked once someone has submitted, to keep grading fair.

### Profile
- Account details (email, employee ID, position) and change password.

---

## 3. Student (Student App)

### Getting in
- Sign in with the **SR code** and password.
- Students with a temporary password must change it first.

### My Classes
- Summary figures: overall completion, items completed, quiz average.
- **Recommended for you:** the top next steps.
- Active and archived classes, each with its instructor, term and progress.
- **Join a class** with the instructor's join code.

### Class content
- Modules, then chapters, then lessons and quizzes.
- Each chapter is marked *Completed*, *In progress* or *Locked*.
- **Chapters unlock in order:** a chapter opens once the previous ones are finished.
- **Lessons:**
  - text, images and videos;
  - *Check Your Understanding* questions; the lesson can be marked complete only after answering them all;
  - a button to open the lesson's 3D model in AR.
- **Chapter quizzes:**
  - multiple choice with instant results and a review;
  - retakes allowed; the best attempt counts.
- **Quizzes and Exams tabs:** the instructor's quizzes and exams.
  - **Status:** shows whether each one is open, in progress, submitted, graded, or closed.
  - **Taking one:** a countdown timer, and every question type supported.
  - **Results:** the score, feedback on essays, and the correct answers when the instructor allows it.

### AR (augmented reality)
- **Scan button** in the middle of the tab bar opens the AR camera.
- **Three ways to bring up a model:**
  - scan the QR code on a printed **AR card** to open that model;
  - point the camera at the printed **AR marker** and the model appears standing on it;
  - point the camera at a **trigger picture** (for example the brain diagram in a lesson) and that model appears on the picture.
- **Handling the model:** rotate it by dragging and resize it by pinching.
- **Points of interest:** tap the numbered pins to read their information.
- **3D view mode** for looking at the model without the camera.

### My Progress
- Overall completion, items completed, lessons completed, quizzes taken, quiz average.
- **Recommended for you** (prescriptive): for example take a quiz before it closes, review a weak chapter and retake its quiz, resume where you left off, or a weekly target to finish on time.
- **Outlook per class** (predictive):
  - predicted final score with its likely range;
  - projected completion by the end of term, and when you'll finish;
  - a status of *On track*, *Needs attention* or *At risk*, with the reasons.
- Weekly activity chart (last 8 weeks) and module-quiz score trend.
- Completion by class and recent activity.

### Profile
- Name, SR code, batch and email.
- Change password and log out.

---

## 4. Shared across the system

### Analytics levels
| Level | Question it answers | Where |
|---|---|---|
| **Descriptive** | What happened? | Dashboards, Performance tab, student Progress |
| **Diagnostic** | Why did it happen? | At-Risk tab (risk levels with reasons), *Flagged for review* |
| **Predictive** | What is likely to happen? | Insights tab, dashboard forecasts, student Outlook |
| **Prescriptive** | What should be done? | Recommended actions (admin, instructor, class, student) |

**How the forecast works** (an explainable statistical model):
- **Pace:** lessons and quizzes finished per week, with the last 4 weeks weighted 60%. Past pace counts for less if the student has been inactive for 2+ weeks.
- **Predicted final score:**
  - 60% the instructor's quizzes and exams plus 40% the chapter quizzes;
  - adjusted for the recent score trend, work that won't be finished by the end of term, and missed exams or quizzes.
- **Likely range:** an 80% range based on how much the student's scores vary; it narrows as more scores come in.
- **Chance of failing:** the probability of scoring under 60%.
- **Confidence:** High with 6+ scores, Medium with 3–5, Low with fewer.
- **Recommendations:** explicit rules, so each one can be traced to the data that triggered it.

### Security and accounts
- Sign in with an email, SR code or employee ID.
- Short-lived sessions that renew automatically.
- Each portal keeps its own sign-in, so admin and instructor can be open side by side.
- Disabling an account takes effect immediately.
- New accounts get temporary passwords that must be changed on first sign-in.
- Repeated failed sign-ins are limited to prevent password guessing.
- **Access rules:**
  - instructors only see their own classes;
  - students only see classes they're enrolled in;
  - locked chapters are enforced by the server.

### Consistent design
- All three apps share the same colors and fonts.
- The student app follows the same formal style as the two portals.
