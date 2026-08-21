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


    // If nothing is left, show empty message
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