// ============================================================
// BAND ACHIEVEMENTS — TEACHER INBOX
// Teacher authentication
// ============================================================


// ------------------------------------------------------------
// SUPABASE CONNECTION
// ------------------------------------------------------------

const SUPABASE_URL =
  "https://spkgcythuogunkqsmhqp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_Svmi15-_UY2CxEwLfHm-Lw_ZXOGRPAC";

const SHEET_ID =
  "1Rdi7AdcFcNd2hCbvqUkmkO-WVxi1qjVZ9jlu_G4JPm4";  

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


// ------------------------------------------------------------
// PAGE ELEMENTS
// ------------------------------------------------------------

const loginSection =
  document.getElementById("teacher-login");

const inboxSection =
  document.getElementById("teacher-inbox");

const loginForm =
  document.getElementById("teacher-login-form");

const emailInput =
  document.getElementById("teacher-email");

const passwordInput =
  document.getElementById("teacher-password");

const loginButton =
  document.getElementById("teacher-login-button");

const logoutButton =
  document.getElementById("teacher-logout-button");

const loginMessage =
  document.getElementById("login-message");


// ------------------------------------------------------------
// SHOW LOGIN SCREEN
// ------------------------------------------------------------

function showLogin() {

  loginSection.classList.remove("hidden");

  inboxSection.classList.add("hidden");

}


// ------------------------------------------------------------
// SHOW TEACHER INBOX
// ------------------------------------------------------------

function showInbox() {

  loginSection.classList.add("hidden");

  inboxSection.classList.remove("hidden");

  loadPendingRecordings();

}


// ------------------------------------------------------------
// SIGN IN
// ------------------------------------------------------------

loginForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    loginMessage.textContent = "";

    loginButton.disabled = true;
    loginButton.textContent = "Signing In...";


    const email =
      emailInput.value.trim();

    const password =
      passwordInput.value;


    try {

      const {
        data,
        error
      } =
        await supabaseClient.auth
          .signInWithPassword({
            email: email,
            password: password
          });


      if (error) {
        throw error;
      }


      console.log(
        "Teacher signed in:",
        data.user
      );


      loginMessage.textContent = "";

      passwordInput.value = "";

      showInbox();

    }

    catch (error) {

      console.error(
        "Teacher login error:",
        error
      );


      loginMessage.textContent =
        "Could not sign in. Check your email and password.";

    }

    finally {

      loginButton.disabled = false;
      loginButton.textContent = "Sign In";

    }

  }
);


// ------------------------------------------------------------
// SIGN OUT
// ------------------------------------------------------------

logoutButton?.addEventListener(
  "click",
  async () => {

    await supabaseClient.auth.signOut();

    emailInput.value = "";
    passwordInput.value = "";

    showLogin();

  }
);


// ------------------------------------------------------------
// CHECK WHETHER TEACHER IS ALREADY SIGNED IN
// ------------------------------------------------------------

async function checkTeacherSession() {

  const {
    data,
    error
  } =
    await supabaseClient.auth
      .getSession();


  if (error) {

    console.error(
      "Session check error:",
      error
    );

    showLogin();

    return;

  }


  if (data.session) {

    showInbox();

  }

  else {

    showLogin();

  }

}


// ------------------------------------------------------------
// START
// ------------------------------------------------------------

checkTeacherSession();

// ============================================================
// LOAD PENDING RECORDINGS
// ============================================================

async function loadPendingRecordings() {

  const recordingList =
    document.getElementById("recording-list");

  if (!recordingList) return;

  recordingList.innerHTML =
    "<p>Loading recordings...</p>";


  try {

    // Get pending submissions from database
    const {
      data: submissions,
      error: submissionsError
    } =
      await supabaseClient
        .from("recording_submissions")
        .select("*")
        .eq("status", "Pending")
        .order("submitted_at", {
          ascending: true
        });


    if (submissionsError) {
      throw submissionsError;
    }


    // No pending submissions
    if (
      !submissions ||
      submissions.length === 0
    ) {

      recordingList.innerHTML =
        "<p>No pending recordings.</p>";

      return;
    }


    recordingList.innerHTML = "";


    // Build one inbox card per recording
    for (const submission of submissions) {

      // Create temporary URL valid for 1 hour
      const {
        data: signedData,
        error: signedError
      } =
        await supabaseClient
          .storage
          .from("recordings")
          .createSignedUrl(
            submission.storage_path,
            3600
          );


      if (signedError) {

        console.error(
          "Signed URL error:",
          signedError
        );

        continue;
      }


      const card =
        document.createElement("div");

      card.className =
        "recording-review-card";


      const submittedTime =
        submission.submitted_at
          ? new Date(
              submission.submitted_at
            ).toLocaleString()
          : "Unknown time";


      card.innerHTML = `

        <div class="recording-review-header">

          <div>

            <h3>
              ${escapeTeacherHtml(
                submission.student_name
              )}
            </h3>

            <p>
              ${escapeTeacherHtml(
                submission.class_id || ""
              )}
            </p>

                        ${
              submission.submission_type === "Band Level"
                ? `
                  <div class="band-level-submission-info">

                    <div class="submission-type-label">
                      Band Level Submission
                    </div>

                    <div class="submission-requirement">
                      ${escapeTeacherHtml(
                        submission.requirement_name || ""
                      )}
                    </div>

                    <div class="submission-level">
                      ${escapeTeacherHtml(
                        submission.level_id || ""
                      )}
                    </div>

                  </div>
                `
                : ""
            }

            <p style="font-size:0.75rem; color:#7f8b98;">
              Student ID:
              ${escapeTeacherHtml(
                submission.student_id || ""
              )}
              <br>
              Submission ID:
              ${escapeTeacherHtml(
                submission.id || ""
              )}
            </p>

          </div>

          <div class="submission-time">
            ${escapeTeacherHtml(
              submittedTime
            )}
          </div>

        </div>


        <audio
          controls
          preload="none"
          src="${signedData.signedUrl}"
        ></audio>


        <div class="review-actions">

          <button
            class="success-button"
            type="button"
            data-submission-id="${submission.id}"
        >
            Success
        </button>

        <button
            class="retry-button"
            type="button"
            data-submission-id="${submission.id}"
        >
         Please Try Again
        </button>

        </div>


        <textarea
          class="teacher-comment-box"
          placeholder="Teacher comment..."
        ></textarea>

      `;


      recordingList.appendChild(card);

    }

  }

  catch (error) {

    console.error(
      "Could not load recordings:",
      error
    );


    recordingList.innerHTML = `
      <p style="color:#ff8a8a;">
        Could not load recordings.
      </p>
    `;

  }

}


// ============================================================
// SIMPLE HTML ESCAPING FOR TEACHER PAGE
// ============================================================

function escapeTeacherHtml(value) {

  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );

}

// ============================================================
// REVIEW RECORDINGS
// ============================================================

async function reviewSubmission(
  submissionId,
  newStatus,
  teacherComment,
  cardElement
) {

  try {

    // --------------------------------------------------------
    // If this is a successful Band Level submission,
    // mark the requirement complete first.
    // --------------------------------------------------------

    if (newStatus === "Success") {

      const {
        data: submission,
        error: submissionReadError
      } =
        await supabaseClient
          .from("recording_submissions")
          .select(
            "id, student_id, submission_type, requirement_id, submitter_uid"
          )
          .eq("id", submissionId)
          .single();


      if (submissionReadError) {
        throw submissionReadError;
      }


      if (
        submission.submission_type === "Band Level" &&
        submission.requirement_id
      ) {

        const {
          data: userData,
          error: userError
        } =
          await supabaseClient.auth
            .getUser();


        if (userError) {
          throw userError;
        }


        const teacherUid =
          userData.user?.id || null;


        const {
          error: progressError
        } =
          await supabaseClient
            .from("band_level_progress")
            .insert([
              {
                student_id:
                  submission.student_id,

                submitter_uid:
                  submission.submitter_uid,  

                requirement_id:
                  submission.requirement_id,

                source:
                  "Recording",

                submission_id:
                  submission.id,

                teacher_comment:
                  teacherComment,

                completed_by:
                  teacherUid
              }
            ]);


        // 23505 means the student already completed
        // this requirement. That's okay — don't fail
        // the review just because it was already recorded.

        if (
          progressError &&
          progressError.code !== "23505"
        ) {

          console.error(
            "Band Level progress error:",
            progressError
          );

          throw progressError;
        }

      }

    }


    // --------------------------------------------------------
    // Update the recording review itself
    // --------------------------------------------------------

    const {
      error
    } =
      await supabaseClient
        .from("recording_submissions")
        .update({
          status: newStatus,
          teacher_comment: teacherComment,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", submissionId);


    if (error) {
      throw error;
    }


    // Remove reviewed item from inbox
    cardElement.remove();


    const recordingList =
      document.getElementById(
        "recording-list"
      );


    if (
      recordingList &&
      recordingList.children.length === 0
    ) {

      recordingList.innerHTML =
        "<p>No pending recordings.</p>";

    }

  }

  catch (error) {

    console.error(
      "Could not review submission:",
      error
    );


    alert(
      "The review could not be saved. Please try again."
    );

  }

}


// ============================================================
// REVIEW BUTTON CLICKS
// ============================================================

document.addEventListener(
  "click",
  async event => {

    const successButton =
      event.target.closest(
        ".success-button"
      );

    const retryButton =
      event.target.closest(
        ".retry-button"
      );


    if (
      !successButton &&
      !retryButton
    ) {

      return;

    }


    const button =
      successButton ||
      retryButton;


    const cardElement =
      button.closest(
        ".recording-review-card"
      );


    if (!cardElement) return;


    const submissionId =
      button.dataset.submissionId;


    const commentBox =
      cardElement.querySelector(
        ".teacher-comment-box"
      );


    const teacherComment =
      commentBox?.value?.trim() || "";


    const newStatus =
      successButton
        ? "Success"
        : "Try Again";


    // Disable both buttons while saving

    cardElement
      .querySelectorAll(
        ".review-actions button"
      )
      .forEach(btn => {
        btn.disabled = true;
      });


    button.textContent =
      "Saving...";


    await reviewSubmission(
      submissionId,
      newStatus,
      teacherComment,
      cardElement
    );

  }
);

// ============================================================
// MANUAL BAND LEVEL PROGRESS
// ============================================================

const BAND_LEVELS_GID = "912222653";
const BAND_LEVEL_REQUIREMENTS_GID = "959194788";

let manualBandLevels = [];
let manualBandLevelRequirements = [];
let manualStudents = [];
let manualClasses = [];
let manualAchievements = [];


// ------------------------------------------------------------
// Fetch CSV from Google Sheets
// ------------------------------------------------------------

async function fetchTeacherSheetCSV(
  sheetId,
  gid
) {

  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      "Could not load Google Sheet data."
    );

  }

  return await response.text();

}


// ------------------------------------------------------------
// CSV parser
// ------------------------------------------------------------

function parseTeacherCSV(csvText) {

  const rows =
    csvText
      .split(/\r?\n/)
      .filter(
        row =>
          row.trim() !== ""
      );


  return rows.map(
    row => {

      const columns = [];

      let current = "";
      let inQuotes = false;


      for (
        let i = 0;
        i < row.length;
        i++
      ) {

        const character =
          row[i];


        if (
          character === '"' &&
          row[i + 1] === '"'
        ) {

          current += '"';
          i++;

          continue;

        }


        if (character === '"') {

          inQuotes =
            !inQuotes;

          continue;

        }


        if (
          character === "," &&
          !inQuotes
        ) {

          columns.push(
            current
          );

          current = "";

          continue;

        }


        current += character;

      }


      columns.push(
        current
      );


      return columns.map(
        column =>
          column.trim()
      );

    }
  );

}


// ------------------------------------------------------------
// Rows -> objects
// ------------------------------------------------------------

function teacherRowsToObjects(
  parsedRows
) {

  const header =
    parsedRows[0].map(
      heading =>
        heading.toLowerCase()
    );


  return parsedRows
    .slice(1)
    .map(
      row => {

        const object = {};


        for (
          let i = 0;
          i < header.length;
          i++
        ) {

          object[
            header[i]
          ] =
            row[i] !== undefined
              ? row[i]
              : "";

        }


        return object;

      }
    );

}


// ------------------------------------------------------------
// Load Band Level curriculum + student roster
// ------------------------------------------------------------

async function loadManualBandLevelData() {

  try {

     const [
      studentsCSV,
      classesCSV,
      achievementsCSV,
      levelsCSV,
      requirementsCSV
    ] =
      await Promise.all([

        fetchTeacherSheetCSV(
          SHEET_ID,
          "7781822"
        ),

        fetchTeacherSheetCSV(
          SHEET_ID,
          "894952475"
        ),

        fetchTeacherSheetCSV(
          SHEET_ID,
          "509720984"
        ),

        fetchTeacherSheetCSV(
          SHEET_ID,
          BAND_LEVELS_GID
        ),

        fetchTeacherSheetCSV(
          SHEET_ID,
          BAND_LEVEL_REQUIREMENTS_GID
        )

      ]);


    const studentsData =
      teacherRowsToObjects(
        parseTeacherCSV(
          studentsCSV
        )
      );

    const classesData =
      teacherRowsToObjects(
        parseTeacherCSV(
          classesCSV
        )
      );

    const achievementsData =
      teacherRowsToObjects(
        parseTeacherCSV(
          achievementsCSV
        )
      );


    const levelsData =
      teacherRowsToObjects(
        parseTeacherCSV(
          levelsCSV
        )
      );


    const requirementsData =
      teacherRowsToObjects(
        parseTeacherCSV(
          requirementsCSV
        )
      );


    manualStudents =
      studentsData
        .filter(
          row =>
            row["student id"] &&
            row["student name"]
        )
        .map(
          row => ({
            id:
              row["student id"],

            name:
              row["student name"],

            classId:
              row["class id"]
          })
        )
        .sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        );

    manualClasses =
      classesData
        .filter(
          row =>
            row["class id"] &&
            row["class name"] &&
            String(
              row["active"]
            ).toLowerCase() !==
            "false"
        )
        .map(
          row => ({
            id:
              row["class id"],

            name:
              row["class name"],

            grade:
              row["grade"]
          })
        )
        .sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        );

      manualAchievements =
        achievementsData
          .filter(
            row =>
              row["achievement id"] &&
              row["card name"] &&
              String(
                row["active"]
              ).toLowerCase() !==
              "false"
          )
          .map(
            row => ({
              id:
                row["achievement id"],

              name:
                row["card name"],

              points:
                Number(
                  row["points"]
                ) || 0,

              category:
                row["category"] || "",

              subcategory:
                row["subcategory"] || ""
            })
          )
          .sort(
            (a, b) =>
              a.name.localeCompare(
                b.name
              )
          );

          manualBandLevels =
            levelsData
              .filter(
                row =>
                  String(
                    row["active"]
                  ).toLowerCase() !==
                  "false"
              )
              .map(
                row => ({
                  id:
                    row["level id"],

                  number:
                    Number(
                      row["level number"]
                    ),

                  name:
                    row["level name"]
                })
              )
              .sort(
                (a, b) =>
                  a.number -
                  b.number
              );


    manualBandLevelRequirements =
      requirementsData
        .map(
          row => ({
            id:
              row["requirement id"],

            levelId:
              row["level id"],

            name:
              row["requirement name"],

            order:
              Number(
                row["order"]
              ) || 0
          })
        );


    populateManualClassSelect();

  }

  catch (error) {

    console.error(
      "Could not load manual Band Level data:",
      error
    );

  }

}


// ------------------------------------------------------------
// Populate student selector
// ------------------------------------------------------------

function populateManualStudentSelect() {

  const select =
    document.getElementById(
      "manualBandLevelStudent"
    );


  if (!select) return;


  select.innerHTML = `
    <option value="">
      Select a student…
    </option>
  `;


  manualStudents.forEach(
    student => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        student.id;

      option.textContent =
        `${student.name} (${student.classId})`;


      select.appendChild(
        option
      );

    }
  );

}


// ------------------------------------------------------------
// Get only configured levels
// ------------------------------------------------------------

function getManualConfiguredLevels() {

  const levelIds =
    new Set(
      manualBandLevelRequirements.map(
        requirement =>
          requirement.levelId
      )
    );


  return manualBandLevels.filter(
    level =>
      levelIds.has(
        level.id
      )
  );

}


// ------------------------------------------------------------
// Render selected student's current Band Level
// ------------------------------------------------------------

async function renderManualBandLevelProgress(
  studentId
) {

  const container =
    document.getElementById(
      "manualBandLevelProgress"
    );


  if (!container) return;


  container.innerHTML =
    "<p>Loading progress...</p>";


  try {

    const {
      data: progressRows,
      error
    } =
      await supabaseClient
        .from("band_level_progress")
        .select(
          "requirement_id"
        )
        .eq(
          "student_id",
          studentId
        );


    if (error) {
      throw error;
    }


    const completedIds =
      new Set(
        (progressRows || [])
          .map(
            row =>
              row.requirement_id
          )
      );


    const levels =
      getManualConfiguredLevels();


    const states =
      levels.map(
        level => {

          const requirements =
            manualBandLevelRequirements
              .filter(
                requirement =>
                  requirement.levelId ===
                  level.id
              )
              .sort(
                (a, b) =>
                  a.order -
                  b.order
              );


          const completedCount =
            requirements.filter(
              requirement =>
                completedIds.has(
                  requirement.id
                )
            ).length;


          return {

            level,

            requirements,

            completedCount,

            complete:
              requirements.length > 0 &&
              completedCount ===
              requirements.length

          };

        }
      );


    let currentIndex =
      states.findIndex(
        state =>
          !state.complete
      );


    if (currentIndex === -1) {

      container.innerHTML =
        "<p>All configured Band Levels are complete.</p>";

      return;

    }


    const current =
      states[
        currentIndex
      ];


    let html = `

      <div class="manual-level-header">

        <h3>
          Working Toward
          ${escapeTeacherHtml(
            current.level.name
          )}
        </h3>

        <div>
          ${current.completedCount}
          /
          ${current.requirements.length}
          requirements complete
        </div>

      </div>

    `;


    current.requirements.forEach(
      requirement => {

        const complete =
          completedIds.has(
            requirement.id
          );


        html += `

          <div
            class="manual-requirement
            ${complete ? "completed" : ""}"
            data-requirement-id="${escapeTeacherHtml(requirement.id)}"
          >

            <div class="manual-requirement-name">

              ${complete ? "✓ " : ""}

              ${escapeTeacherHtml(
                requirement.name
              )}

            </div>

            ${
              complete
                ? `
                  <div>
                    Already completed
                  </div>
                `
                : `
                  <textarea
                    class="manual-comment"
                    placeholder="Optional teacher comment..."
                  ></textarea>

                  <button
                    type="button"
                    class="manual-complete-button"
                    data-student-id="${escapeTeacherHtml(studentId)}"
                    data-requirement-id="${escapeTeacherHtml(requirement.id)}"
                  >
                    Mark Complete
                  </button>
                `
            }

          </div>

        `;

      }
    );


    container.innerHTML =
      html;

  }

  catch (error) {

    console.error(
      "Could not load manual progress:",
      error
    );


    container.innerHTML =
      "<p>Could not load Band Level progress.</p>";

  }

}


// ------------------------------------------------------------
// Student selector change
// ------------------------------------------------------------

document
  .getElementById(
    "manualBandLevelStudent"
  )
  ?.addEventListener(
    "change",
    event => {

      const studentId =
        event.target.value;


      if (!studentId) {

        document.getElementById(
          "manualBandLevelProgress"
        ).innerHTML =
          "<p>Select a student to view their current Band Level.</p>";

        return;

      }


      renderManualBandLevelProgress(
        studentId
      );

    }
  );


// ------------------------------------------------------------
// Mark requirement complete manually
// ------------------------------------------------------------

document.addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest(
        ".manual-complete-button"
      );


    if (!button) return;


    const studentId =
      button.dataset.studentId;

    const requirementId =
      button.dataset.requirementId;


    const requirementBox =
      button.closest(
        ".manual-requirement"
      );


    const comment =
      requirementBox
        ?.querySelector(
          ".manual-comment"
        )
        ?.value
        ?.trim() || "";


    button.disabled = true;
    button.textContent =
      "Saving...";


    try {

      const {
        data: userData,
        error: userError
      } =
        await supabaseClient.auth
          .getUser();


      if (userError) {
        throw userError;
      }


      const {
        error
      } =
        await supabaseClient
          .from(
            "band_level_progress"
          )
          .insert([
            {

              student_id:
                studentId,

              requirement_id:
                requirementId,

              source:
                "In Person",

              teacher_comment:
                comment,

              completed_by:
                userData.user?.id ||
                null

            }
          ]);


      if (
        error &&
        error.code !==
        "23505"
      ) {

        throw error;

      }


      await renderManualBandLevelProgress(
        studentId
      );

    }

    catch (error) {

      console.error(
        "Could not manually complete requirement:",
        error
      );


      alert(
        "Could not save Band Level progress."
      );


      button.disabled = false;
      button.textContent =
        "Mark Complete";

    }

  }
);


// Start loading manual Band Level data
loadManualBandLevelData();

function populateManualClassSelect() {

  const select =
    document.getElementById(
      "manualBandLevelClass"
    );

  if (!select) return;

  select.innerHTML = `
    <option value="">
      Select a class…
    </option>
  `;

  manualClasses.forEach(
    classInfo => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        classInfo.id;

      option.textContent =
        classInfo.name;

      select.appendChild(
        option
      );

    }
  );

}


function populateManualStudentSelect(
  classId
) {

  const select =
    document.getElementById(
      "manualBandLevelStudent"
    );

  if (!select) return;

  select.innerHTML = `
    <option value="">
      Select a student…
    </option>
  `;

  if (!classId) return;

  manualStudents
    .filter(
      student =>
        student.classId === classId
    )
    .forEach(
      student => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          student.id;

        option.textContent =
          student.name;

        select.appendChild(
          option
        );

      }
    );

}

function populateManualClassSelect() {

  const select =
    document.getElementById(
      "manualBandLevelClass"
    );

  if (!select) return;

  select.innerHTML = `
    <option value="">
      Select a class…
    </option>
  `;

  manualClasses.forEach(
    classInfo => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        classInfo.id;

      option.textContent =
        classInfo.name;

      select.appendChild(
        option
      );

    }
  );

}


function populateManualStudentSelect(
  classId
) {

  const select =
    document.getElementById(
      "manualBandLevelStudent"
    );

  if (!select) return;

  select.innerHTML = `
    <option value="">
      Select a student…
    </option>
  `;

  if (!classId) return;

  manualStudents
    .filter(
      student =>
        student.classId === classId
    )
    .forEach(
      student => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          student.id;

        option.textContent =
          student.name;

        select.appendChild(
          option
        );

      }
    );

}

document
  .getElementById(
    "manualBandLevelClass"
  )
  ?.addEventListener(
    "change",
    event => {

      const classId =
        event.target.value;

      populateManualStudentSelect(
        classId
      );

      document.getElementById(
        "manualBandLevelProgress"
      ).innerHTML =
        "<p>Select a student to view their current Band Level.</p>";

    }
  );

  // ============================================================
// QUICK ACTIONS
// ============================================================

let quickSelectedStudent = null;


// ------------------------------------------------------------
// Live student search
// ------------------------------------------------------------

function renderQuickStudentSearchResults(
  query
) {

  const results =
    document.getElementById(
      "quickStudentResults"
    );


  if (!results) return;


  const search =
    query
      .trim()
      .toLowerCase();


  if (!search) {

    results.innerHTML = "";

    return;

  }


  const matches =
    manualStudents
      .filter(
        student =>
          student.name
            .toLowerCase()
            .includes(search)
      )
      .slice(0, 8);


  if (!matches.length) {

    results.innerHTML =
      "<div class='quick-student-result'>No students found.</div>";

    return;

  }


  results.innerHTML =
    matches
      .map(
        student => `

          <div
            class="quick-student-result"
            data-student-id="${escapeTeacherHtml(student.id)}"
          >
            <strong>
              ${escapeTeacherHtml(student.name)}
            </strong>

            <br>

            <span>
              ${escapeTeacherHtml(student.classId || "")}
            </span>
          </div>

        `
      )
      .join("");

}


// ------------------------------------------------------------
// Select student
// ------------------------------------------------------------

function selectQuickStudent(
  studentId
) {

  const student =
    manualStudents.find(
      item =>
        item.id === studentId
    );


  if (!student) return;


  quickSelectedStudent =
    student;


  document
    .getElementById(
      "quickSelectedStudent"
    )
    ?.classList
    .remove("hidden");


  const nameElement =
    document.getElementById(
      "quickSelectedStudentName"
    );


  const classElement =
    document.getElementById(
      "quickSelectedStudentClass"
    );


  if (nameElement) {

    nameElement.textContent =
      student.name;

  }


  if (classElement) {

    classElement.textContent =
      student.classId || "";

  }


  const searchInput =
    document.getElementById(
      "quickStudentSearch"
    );


  if (searchInput) {

    searchInput.value = "";

  }


  const results =
    document.getElementById(
      "quickStudentResults"
    );


  if (results) {

    results.innerHTML = "";

  }


  const workspace =
    document.getElementById(
      "quickActionWorkspace"
    );


  if (workspace) {

    workspace.innerHTML = "";

  }

}


// ------------------------------------------------------------
// Quick Band Level display
// ------------------------------------------------------------

async function showQuickBandLevelProgress() {

  if (!quickSelectedStudent) {
    return;
  }


  const workspace =
    document.getElementById(
      "quickActionWorkspace"
    );


  if (!workspace) return;


  workspace.innerHTML =
    "<p>Loading Band Level progress...</p>";


  try {

    const {
      data: progressRows,
      error
    } =
      await supabaseClient
        .from("band_level_progress")
        .select(
          "requirement_id"
        )
        .eq(
          "student_id",
          quickSelectedStudent.id
        );


    if (error) {
      throw error;
    }


    const completedIds =
      new Set(
        (progressRows || [])
          .map(
            row =>
              row.requirement_id
          )
      );


    const levels =
      getManualConfiguredLevels();


    const states =
      levels.map(
        level => {

          const requirements =
            manualBandLevelRequirements
              .filter(
                requirement =>
                  requirement.levelId ===
                  level.id
              )
              .sort(
                (a, b) =>
                  a.order -
                  b.order
              );


          const completedCount =
            requirements.filter(
              requirement =>
                completedIds.has(
                  requirement.id
                )
            ).length;


          return {

            level,

            requirements,

            complete:
              requirements.length > 0 &&
              completedCount ===
              requirements.length

          };

        }
      );


    const current =
      states.find(
        state =>
          !state.complete
      );


    if (!current) {

      workspace.innerHTML =
        "<p>All configured Band Levels are complete.</p>";

      return;

    }


    let html = `

      <div class="manual-level-header">

        <h3>
          Working Toward
          ${escapeTeacherHtml(
            current.level.name
          )}
        </h3>

      </div>

    `;


    current.requirements.forEach(
      requirement => {

        const complete =
          completedIds.has(
            requirement.id
          );


        html += `

          <div
            class="quick-band-level-card
            ${complete ? "completed" : ""}"
          >

            <div class="quick-band-level-title">

              ${complete ? "✓ " : ""}

              ${escapeTeacherHtml(
                requirement.name
              )}

            </div>


            ${
              complete
                ? "<div>Completed</div>"
                : `
                  <button
                    type="button"
                    class="quick-band-level-complete"
                    data-student-id="${escapeTeacherHtml(
                      quickSelectedStudent.id
                    )}"
                    data-requirement-id="${escapeTeacherHtml(
                      requirement.id
                    )}"
                  >
                    ✓ Complete
                  </button>
                `
            }

          </div>

        `;

      }
    );


    workspace.innerHTML =
      html;

  }

  catch (error) {

    console.error(
      "Could not load Quick Band Level progress:",
      error
    );


    workspace.innerHTML =
      "<p>Could not load Band Level progress.</p>";

  }

}


// ------------------------------------------------------------
// Quick student search typing
// ------------------------------------------------------------

document
  .getElementById(
    "quickStudentSearch"
  )
  ?.addEventListener(
    "input",
    event => {

      renderQuickStudentSearchResults(
        event.target.value
      );

    }
  );


// ------------------------------------------------------------
// Quick Actions clicks
// ------------------------------------------------------------

document.addEventListener(
  "click",
  async event => {

    const studentResult =
      event.target.closest(
        ".quick-student-result[data-student-id]"
      );


    if (studentResult) {

      selectQuickStudent(
        studentResult.dataset.studentId
      );

      return;

    }


    if (
      event.target.id ===
      "quickClearStudent"
    ) {

      quickSelectedStudent =
        null;


      document
        .getElementById(
          "quickSelectedStudent"
        )
        ?.classList
        .add("hidden");


      document
        .getElementById(
          "quickStudentSearch"
        )
        ?.focus();


      return;

    }


    if (
      event.target.id ===
      "quickBandLevelProgress"
    ) {

      await showQuickBandLevelProgress();

      return;

    }


    const completeButton =
      event.target.closest(
        ".quick-band-level-complete"
      );


    if (completeButton) {

      const studentId =
        completeButton.dataset.studentId;

      const requirementId =
        completeButton.dataset.requirementId;


      completeButton.disabled =
        true;

      completeButton.textContent =
        "Saving...";


      try {

        const {
          data: userData,
          error: userError
        } =
          await supabaseClient.auth
            .getUser();


        if (userError) {
          throw userError;
        }


        const {
          error
        } =
          await supabaseClient
            .from(
              "band_level_progress"
            )
            .insert([
              {

                student_id:
                  studentId,

                requirement_id:
                  requirementId,

                source:
                  "In Person",

                completed_by:
                  userData.user?.id ||
                  null

              }
            ]);


        if (
          error &&
          error.code !== "23505"
        ) {

          throw error;

        }


        await showQuickBandLevelProgress();

      }

      catch (error) {

        console.error(
          "Quick Band Level completion failed:",
          error
        );


        completeButton.disabled =
          false;

        completeButton.textContent =
          "✓ Complete";

      }

    }

  }
);

// ============================================================
// QUICK ACHIEVEMENT CARD AWARD
// ============================================================

function showQuickAchievementSearch() {

  if (!quickSelectedStudent) {
    return;
  }


  const workspace =
    document.getElementById(
      "quickActionWorkspace"
    );


  if (!workspace) return;


  workspace.innerHTML = `

    <input
      type="text"
      id="quickAchievementSearch"
      placeholder="Search achievement card..."
      autocomplete="off"
    >

    <div
      id="quickAchievementResults"
      class="quick-achievement-results"
    ></div>

  `;


  document
    .getElementById(
      "quickAchievementSearch"
    )
    ?.focus();

}


function renderQuickAchievementResults(
  query
) {

  const results =
    document.getElementById(
      "quickAchievementResults"
    );


  if (!results) return;


  const search =
    query
      .trim()
      .toLowerCase();


  if (!search) {

    results.innerHTML = "";

    return;

  }


  const matches =
    manualAchievements
      .filter(
        achievement =>
          achievement.name
            .toLowerCase()
            .includes(search) ||

          achievement.category
            .toLowerCase()
            .includes(search) ||

          achievement.subcategory
            .toLowerCase()
            .includes(search)
      )
      .slice(0, 10);


  if (!matches.length) {

    results.innerHTML =
      "<div class='quick-achievement-result'>No achievement cards found.</div>";

    return;

  }


  results.innerHTML =
    matches
      .map(
        achievement => `

          <div
            class="quick-achievement-result"
            data-achievement-id="${escapeTeacherHtml(achievement.id)}"
          >

            <strong>
              ${escapeTeacherHtml(
                achievement.name
              )}
            </strong>

            <br>

            <span>
              ${escapeTeacherHtml(
                achievement.category
              )}

              ${
                achievement.subcategory
                  ? ` — ${escapeTeacherHtml(
                      achievement.subcategory
                    )}`
                  : ""
              }
            </span>

          </div>

        `
      )
      .join("");

}


// Live achievement search
document.addEventListener(
  "input",
  event => {

    if (
      event.target.id !==
      "quickAchievementSearch"
    ) {
      return;
    }


    renderQuickAchievementResults(
      event.target.value
    );

  }
);


// Add Achievement button
document.addEventListener(
  "click",
  event => {

    if (
      event.target.id ===
      "quickAddAchievement"
    ) {

      showQuickAchievementSearch();

    }

  }
);


// Award selected achievement
document.addEventListener(
  "click",
  async event => {

    const result =
      event.target.closest(
        ".quick-achievement-result[data-achievement-id]"
      );


    if (!result) return;


    if (!quickSelectedStudent) {
      return;
    }


    const achievementId =
      result.dataset.achievementId;


    const achievement =
      manualAchievements.find(
        item =>
          item.id ===
          achievementId
      );


    if (!achievement) {
      return;
    }


    try {

      const {
        data: userData,
        error: userError
      } =
        await supabaseClient.auth
          .getUser();


      if (userError) {
        throw userError;
      }


      const {
        error
      } =
        await supabaseClient
          .from(
            "earned_achievements"
          )
          .insert([
            {

              student_id:
                quickSelectedStudent.id,

              achievement_id:
                achievement.id,

              source:
                "In Person",

              awarded_by:
                userData.user?.id ||
                null

            }
          ]);


      if (
        error &&
        error.code ===
        "23505"
      ) {

        alert(
          `${quickSelectedStudent.name} already has ${achievement.name}.`
        );

        return;

      }


      if (error) {
        throw error;
      }


      const workspace =
        document.getElementById(
          "quickActionWorkspace"
        );


      if (workspace) {

        workspace.innerHTML = `

          <div class="quick-award-success">

            ✓ ${escapeTeacherHtml(
              achievement.name
            )}

            awarded to

            ${escapeTeacherHtml(
              quickSelectedStudent.name
            )}

          </div>

        `;

      }

    }

    catch (error) {

      console.error(
        "Could not award achievement:",
        error
      );


      alert(
        "Could not award achievement card."
      );

    }

  }
);