// script.js — Band Achievements
// Google Sheets -> Student Cards -> Category Stacks -> Spotlight View

const SHEET_ID = "1Rdi7AdcFcNd2hCbvqUkmkO-WVxi1qjVZ9jlu_G4JPm4";

// Supabase connection
const SUPABASE_URL =
  "https://spkgcythuogunkqsmhqp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_Svmi15-_UY2CxEwLfHm-Lw_ZXOGRPAC";

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

// ============================================================
// ANONYMOUS STUDENT SESSION
// ============================================================

let studentAuthUser = null;

async function ensureAnonymousStudentSession() {

  try {

    const {
      data: sessionData,
      error: sessionError
    } =
      await supabaseClient.auth
        .getSession();


    if (sessionError) {
      throw sessionError;
    }


    // Reuse existing session if one already exists
    if (sessionData.session?.user) {

      studentAuthUser =
        sessionData.session.user;

      console.log(
        "Existing student session:",
        studentAuthUser.id
      );

      return studentAuthUser;

    }


    // Otherwise create an anonymous Supabase user
    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInAnonymously();


    if (error) {
      throw error;
    }


    studentAuthUser =
      data.user;


    console.log(
      "Anonymous student session created:",
      studentAuthUser.id
    );


    return studentAuthUser;

  }

  catch (error) {

  console.error(
    "Could not create student session:",
    error
  );

  console.error(
    "Auth error code:",
    error?.code
  );

  console.error(
    "Auth error message:",
    error?.message
  );

  return null;

}

}  

// Google Sheet GIDs
const STUDENTS_GID = "7781822";
const ACHIEVEMENTS_GID = "509720984";
const EARNED_CARDS_GID = "1663037260";
const CLASSES_GID = "894952475";

// Global student list
let allStudents = [];

// Category display order
const CATEGORY_ORDER = [
  "Band Level",
  "Practice",
  "Scales",
  "Achievement",
  "Band Music"
];

console.log("Band Achievements script running...");


// ============================================================
// GOOGLE SHEETS
// ============================================================

async function fetchSheetCSV(sheetId, gid) {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Could not fetch sheet CSV: " + res.statusText);
  }

  return await res.text();
}


// ============================================================
// CSV PARSER
// ============================================================

function parseCSV(csvText) {
  const rows = csvText
    .split(/\r?\n/)
    .filter(row => row.trim() !== "");

  return rows.map(row => {

    const cols = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {

      const ch = row[i];

      if (ch === '"' && row[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }

    cols.push(cur);

    return cols.map(c => c.trim());
  });
}


function rowsToObjects(parsedRows) {

  if (!parsedRows.length) return [];

  const header = parsedRows[0].map(h =>
    h.trim().toLowerCase()
  );

  return parsedRows.slice(1).map(row => {

    const obj = {};

    for (let i = 0; i < header.length; i++) {
      obj[header[i]] =
        row[i] !== undefined ? row[i].trim() : "";
    }

    return obj;
  });
}


// ============================================================
// UTILITIES
// ============================================================

function escapeHtml(s) {

  return String(s).replace(/[&<>"']/g, function(m) {

    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m];

  });
}


function cardNameToFilename(cardName) {

  if (!cardName) {
    return "missing-card.png";
  }

  const fname = cardName
    .toLowerCase()
    .replace(/[\/\\]/g, "_")
    .replace(/[^a-z0-9_\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return fname + ".png";
}


// ============================================================
// CATEGORY HELPERS
// ============================================================

function normalizeCategory(category) {

  if (!category) return "Achievement";

  const value = category.trim().toLowerCase();

  if (value === "band level") return "Band Level";
  if (value === "practice") return "Practice";
  if (value === "scales") return "Scales";
  if (value === "achievement") return "Achievement";
  if (value === "band music") return "Band Music";

  return category.trim();
}


function createEmptyCategories() {

  const categories = {};

  CATEGORY_ORDER.forEach(category => {
    categories[category] = [];
  });

  return categories;
}


// ============================================================
// CREATE CATEGORY STACK
// ============================================================

function createCategoryStack(category, cards, studentName) {

  if (!cards || cards.length === 0) {
    return "";
  }

  const cardsHtml = cards.map(card => {

    const filename =
      card.image || cardNameToFilename(card.card);

    const src = `images/${filename}`;

    return `
      <img
        class="achievement-card"
        src="${src}"
        alt="${escapeHtml(card.card)}"
        title="${escapeHtml(card.card)}"
        onerror="this.src='images/missing-card.png'; this.style.opacity=0.9"
      >
    `;

  }).join("");


  return `
    <div class="category-section">

      <div class="cards-container">
        ${cardsHtml}
      </div>

    </div>
  `;
}


// ============================================================
// CREATE STUDENT CARD
// ============================================================

function createStudentCardElem(student) {

  const div = document.createElement("div");

  div.className = "student-card";


  // Achievement-point glow

  if (student.total >= 200) {
    div.classList.add("glow-blue");
  }

  else if (student.total >= 150) {
    div.classList.add("glow-gold");
  }

  else if (student.total >= 100) {
    div.classList.add("glow-silver");
  }

  else if (student.total >= 50) {
    div.classList.add("glow-bronze");
  }


  // Points display

  const pointsHtml = `
    <div class="points">

      <div class="label">
        Achievement Points
      </div>

      <div class="num">
        ${Math.round(student.total)}
      </div>

    </div>
  `;


  // Create category stacks

  let categoriesHtml = "";

  CATEGORY_ORDER.forEach(category => {

    const cards = student.categories[category] || [];

    categoriesHtml +=
      createCategoryStack(
        category,
        cards,
        student.name
      );

  });


  div.innerHTML = `

    <div class="student-name">
      ${escapeHtml(student.name)}
    </div>

    ${pointsHtml}

    <div class="category-stacks">

      ${categoriesHtml}

    </div>

  `;


  return div;
}


// ============================================================
// RENDER STUDENTS
// ============================================================

function renderStudents(students) {

  const container =
    document.getElementById("student-container");

  if (!container) return;

  container.innerHTML = "";

  students.forEach(student => {

    container.appendChild(
      createStudentCardElem(student)
    );

  });


  attachCardClickHandlers();
}


// ============================================================
// STACK OPEN/CLOSE
// ============================================================

function attachStackHandlers() {

  document
    .querySelectorAll(".category-section")
    .forEach(section => {

      const header =
        section.querySelector(".category-header");

      const stack =
        section.querySelector(".card-stack");

      if (!header || !stack) return;


      function toggleStack() {

        const isOpen =
          section.classList.contains("expanded");

        // Close this stack
        if (isOpen) {

          section.classList.remove("expanded");

          header.setAttribute(
            "aria-expanded",
            "false"
          );

        }

        // Open this stack
        else {

          section.classList.add("expanded");

          header.setAttribute(
            "aria-expanded",
            "true"
          );

        }

      }


      header.addEventListener(
        "click",
        toggleStack
      );


      stack.addEventListener(
        "click",
        toggleStack
      );


      stack.addEventListener(
        "keydown",
        event => {

          if (
            event.key === "Enter" ||
            event.key === " "
          ) {

            event.preventDefault();
            toggleStack();

          }

        }
      );

    });
}


// ============================================================
// SPOTLIGHT / LARGE CARD VIEW
// ============================================================

function attachCardClickHandlers() {

  let overlay =
    document.getElementById("card-overlay");


  if (!overlay) {

    overlay =
      document.createElement("div");

    overlay.id = "card-overlay";

    document.body.appendChild(overlay);

  }


  let zoomImg =
    overlay.querySelector(".zoom-image");


  if (!zoomImg) {

    zoomImg =
      document.createElement("img");

    zoomImg.className = "zoom-image";

    overlay.appendChild(zoomImg);

  }


  function openOverlay(src, alt) {

    zoomImg.src = src;
    zoomImg.alt = alt || "";

    overlay.style.display = "flex";

    overlay.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "overlay-open"
    );

    setTimeout(() => {

      zoomImg.classList.add("glow");

    }, 20);

  }


  function closeOverlay() {

    zoomImg.classList.remove("glow");

    overlay.style.display = "none";

    overlay.setAttribute(
      "aria-hidden",
      "true"
    );

    zoomImg.src = "";

    document.body.classList.remove(
      "overlay-open"
    );

  }


  // Only expanded cards should open the spotlight

  document
  .querySelectorAll(".achievement-card")
    .forEach(img => {

      const fresh =
        img.cloneNode(true);

      img.parentNode.replaceChild(
        fresh,
        img
      );


      fresh.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          const src =
            fresh.src;

          const alt =
            fresh.getAttribute("alt") ||
            fresh.getAttribute("title") ||
            "";

          openOverlay(src, alt);

        }
      );

    });


  // Close overlay when clicking background

  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay ||
        event.target === zoomImg
      ) {

        closeOverlay();

      }

    }
  );


  // Escape key

  if (!window.bandAchievementsEscapeHandler) {

    window.bandAchievementsEscapeHandler =
      event => {

        if (
          event.key === "Escape" &&
          overlay.style.display === "flex"
        ) {

          closeOverlay();

        }

      };

    document.addEventListener(
      "keydown",
      window.bandAchievementsEscapeHandler
    );

  }

}


// ============================================================
// FILTERS & SORTING
// ============================================================

function applyFilters() {

  const q =
    document
      .getElementById("searchBar")
      ?.value
      ?.toLowerCase() || "";


  const sort =
    document
      .getElementById("sortSelect")
      ?.value ||
    "points";


  let filtered =
    allStudents.filter(student =>
      student.name
        .toLowerCase()
        .includes(q)
    );


  if (sort === "points") {

    filtered.sort(
      (a, b) =>
        b.total - a.total
    );

  }

  else if (sort === "name") {

    filtered.sort(
      (a, b) =>
        a.name.localeCompare(b.name)
    );

  }

  else if (sort === "cards") {

    filtered.sort(
      (a, b) =>
        b.cards.length -
        a.cards.length
    );

  }


  renderStudents(filtered);

}


document.addEventListener(
  "input",
  event => {

    if (
      event.target.id === "searchBar"
    ) {

      applyFilters();

    }

  }
);


document.addEventListener(
  "change",
  event => {

    if (
      event.target.id === "sortSelect"
    ) {

      applyFilters();

    }

  }
);


// ============================================================
// MAIN LOADER
// ============================================================

async function loadAndRender() {

  try {

    console.log("Loading Band Achievements database...");


    // ========================================================
    // 1. LOAD ALL REQUIRED GOOGLE SHEETS
    // ========================================================

    const [
      studentsCSV,
      classesCSV,
      achievementsCSV,
      earnedCSV
    ] = await Promise.all([

      fetchSheetCSV(
        SHEET_ID,
        STUDENTS_GID
      ),

      fetchSheetCSV(
        SHEET_ID,
        CLASSES_GID
      ),

      fetchSheetCSV(
        SHEET_ID,
        ACHIEVEMENTS_GID
      ),

      fetchSheetCSV(
        SHEET_ID,
        EARNED_CARDS_GID
      )

    ]);


    // ========================================================
    // 2. CONVERT CSV DATA INTO OBJECTS
    // ========================================================

    const studentsData =
      rowsToObjects(
        parseCSV(studentsCSV)
      );

    const classesData =
      rowsToObjects(
        parseCSV(classesCSV)
      );

    const achievementsData =
      rowsToObjects(
        parseCSV(achievementsCSV)
      );

    const earnedCardsData =
      rowsToObjects(
        parseCSV(earnedCSV)
      );


    console.log(
      "Students loaded:",
      studentsData.length
    );

    console.log(
      "Classes loaded:",
      classesData.length
    );

    console.log(
      "Achievements loaded:",
      achievementsData.length
    );

    console.log(
      "Earned cards loaded:",
      earnedCardsData.length
    );


    // ========================================================
    // 3. BUILD CLASS LOOKUP
    // ========================================================

    const classLookup = {};


    classesData.forEach(row => {

      const classId =
        row["class id"] || "";

      if (!classId) return;


      classLookup[classId] = {

        id: classId,

        name:
          row["class name"] || "",

        grade:
          row["grade"] || "",

        active:
          String(
            row["active"]
          ).toLowerCase() !== "false"

      };

    });


    // ========================================================
    // 4. BUILD ACHIEVEMENT LOOKUP
    // ========================================================

    const achievementLookup = {};


    achievementsData.forEach(row => {

      const achievementId =
        row["achievement id"] || "";

      if (!achievementId) return;


      achievementLookup[
        achievementId
      ] = {

        id:
          achievementId,

        card:
          row["card name"] || "",

        points:
          Number(
            row["points"]
          ) || 0,

        category:
          normalizeCategory(
            row["category"]
          ),

        subcategory:
          row["subcategory"] || "",

        description:
          row["description"] || "",

        image:
          row["image file"] || "",

        active:
          String(
            row["active"]
          ).toLowerCase() !== "false"

      };

    });


    // ========================================================
    // 5. BUILD STUDENT LOOKUP
    //
    // Every student comes from the Students tab now.
    // Earned Cards no longer determines who exists.
    // ========================================================

    const studentsMap = {};


    studentsData.forEach(row => {

      const studentId =
        row["student id"] || "";

      const studentName =
        row["student name"] || "";

      const classId =
        row["class id"] || "";


      if (!studentId) return;


      const classInfo =
        classLookup[classId] || null;


      studentsMap[
        studentId
      ] = {

        id:
          studentId,

        name:
          studentName ||
          studentId,

        classId:
          classId,

        className:
          classInfo?.name || "",

        grade:
          classInfo?.grade || "",

        username:
          row["username"] || "",

        avatar:
          row["avatar"] || "",

        cards: [],

        total: 0,

        categories:
          createEmptyCategories()

      };

    });


    // ========================================================
    // 6. CONNECT EARNED CARDS TO STUDENTS
    // ========================================================

    earnedCardsData.forEach(row => {

      const studentId =
        row["student id"] || "";

      const achievementId =
        row["achievement id"] || "";


      if (
        !studentId ||
        !achievementId
      ) {

        return;

      }


      const student =
        studentsMap[
          studentId
        ];


      const achievement =
        achievementLookup[
          achievementId
        ];


      // If an ID doesn't match something in the database,
      // report it instead of silently creating bad data.

      if (!student) {

        console.warn(
          "Earned card references unknown student:",
          studentId
        );

        return;

      }


      if (!achievement) {

        console.warn(
          "Earned card references unknown achievement:",
          achievementId
        );

        return;

      }


      const cardObject = {

        achievementId:
          achievement.id,

        card:
          achievement.card,

        points:
          achievement.points,

        category:
          achievement.category,

        subcategory:
          achievement.subcategory,

        description:
          achievement.description,

        image:
          achievement.image,

        dateEarned:
          row["date earned"] || "",

        teacherComment:
          row["teacher comment"] || "",

        awardedBy:
          row["awarded by"] || "",

        source:
          row["source"] || ""

      };


      student.cards.push(
        cardObject
      );


      student.total +=
        achievement.points;


      const category =
        achievement.category;


      if (
        !student.categories[
          category
        ]
      ) {

        student.categories[
          category
        ] = [];

      }


      student.categories[
        category
      ].push(
        cardObject
      );

    });


    // ========================================================
    // 7. CREATE FINAL STUDENT ARRAY
    // ========================================================

    allStudents =
      Object.values(
        studentsMap
      ).sort(
        (a, b) =>
          b.total - a.total
      );

      populateRecordingStudentSelect();


    console.log(
      "Finished student database:",
      allStudents
    );


    // ========================================================
    // 8. DISPLAY
    // ========================================================

    applyFilters();

  }

  catch (err) {

    console.error(
      "Error loading database:",
      err
    );


    const container =
      document.getElementById(
        "student-container"
      );


    if (container) {

      container.innerHTML = `

        <p style="color:crimson">

          Error loading database:
          ${escapeHtml(err.message)}

        </p>

      `;

    }

  }

}


// ============================================================
// START
// ============================================================

loadAndRender();

// ============================================================
// AUDIO RECORDER - PHASE 1
// Record -> Stop -> Preview -> Record Again
// ============================================================

let mediaRecorder = null;
let recordingStream = null;
let recordedChunks = [];
let recordedAudioBlob = null;
let recordedAudioUrl = null;

let recordingStartTime = null;
let recordingTimerInterval = null;


// ------------------------------------------------------------
// RECORDER ELEMENTS
// ------------------------------------------------------------

const openRecorderBtn =
  document.getElementById("openRecorderBtn");

const recorderPanel =
  document.getElementById("recorder-panel");

const startRecordingBtn =
  document.getElementById("startRecordingBtn");

const stopRecordingBtn =
  document.getElementById("stopRecordingBtn");

const discardRecordingBtn =
  document.getElementById("discardRecordingBtn");

const submitRecordingBtn =
  document.getElementById("submitRecordingBtn");

const recordingStatus =
  document.getElementById("recording-status");

const recordingTimer =
  document.getElementById("recording-timer");

const recordingPreview =
  document.getElementById("recording-preview");

const audioPlayback =
  document.getElementById("audioPlayback");


// ------------------------------------------------------------
// OPEN RECORDER
// ------------------------------------------------------------

openRecorderBtn?.addEventListener(
  "click",
  () => {

    recorderPanel.classList.toggle("hidden");

  }
);


// ------------------------------------------------------------
// TIMER
// ------------------------------------------------------------

function formatRecordingTime(totalSeconds) {

  const minutes =
    Math.floor(totalSeconds / 60);

  const seconds =
    totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;

}


function startRecordingTimer() {

  recordingStartTime =
    Date.now();

  recordingTimer.textContent =
    "0:00";


  recordingTimerInterval =
    setInterval(() => {

      const elapsedMilliseconds =
        Date.now() -
        recordingStartTime;

      const elapsedSeconds =
        Math.floor(
          elapsedMilliseconds / 1000
        );

      recordingTimer.textContent =
        formatRecordingTime(
          elapsedSeconds
        );

    }, 250);

}


function stopRecordingTimer() {

  if (recordingTimerInterval) {

    clearInterval(
      recordingTimerInterval
    );

  }

  recordingTimerInterval =
    null;

}


// ------------------------------------------------------------
// START RECORDING
// ------------------------------------------------------------

startRecordingBtn?.addEventListener(
  "click",
  async () => {

    try {

      // Check browser support

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        throw new Error(
          "Audio recording is not supported by this browser."
        );

      }


      // Request microphone access

      recordingStream =
        await navigator.mediaDevices.getUserMedia({
          audio: true
        });


      recordedChunks = [];
      recordedAudioBlob = null;


      // Remove previous temporary audio URL

      if (recordedAudioUrl) {

        URL.revokeObjectURL(
          recordedAudioUrl
        );

        recordedAudioUrl = null;

      }


      mediaRecorder =
        new MediaRecorder(
          recordingStream
        );


      // Save audio chunks

      mediaRecorder.addEventListener(
        "dataavailable",
        event => {

          if (
            event.data &&
            event.data.size > 0
          ) {

            recordedChunks.push(
              event.data
            );

          }

        }
      );


      // Recording finished

      mediaRecorder.addEventListener(
        "stop",
        () => {

          recordedAudioBlob =
            new Blob(
              recordedChunks,
              {
                type:
                  mediaRecorder.mimeType ||
                  "audio/webm"
              }
            );


          recordedAudioUrl =
            URL.createObjectURL(
              recordedAudioBlob
            );


          audioPlayback.src =
            recordedAudioUrl;


          recordingPreview.classList.remove(
            "hidden"
          );


          recordingStatus.textContent =
            "Recording complete";

          recordingStatus.classList.remove(
            "recording"
          );


          // We'll enable this later when uploads work.
          submitRecordingBtn.disabled =
            false;


          // Release microphone

          if (recordingStream) {

            recordingStream
              .getTracks()
              .forEach(track =>
                track.stop()
              );

          }

          recordingStream = null;

        }
      );


      // Start

      mediaRecorder.start();


      recordingStatus.textContent =
        "Recording…";

      recordingStatus.classList.add(
        "recording"
      );


      startRecordingBtn.disabled =
        true;

      stopRecordingBtn.disabled =
        false;


      recordingPreview.classList.add(
        "hidden"
      );


      startRecordingTimer();

    }

    catch (error) {

      console.error(
        "Microphone error:",
        error
      );


      recordingStatus.textContent =
        "Could not access microphone.";


      recordingStatus.classList.remove(
        "recording"
      );


      alert(
        "The website could not access your microphone. Please make sure microphone permission is allowed for this site."
      );

    }

  }
);


// ------------------------------------------------------------
// STOP RECORDING
// ------------------------------------------------------------

stopRecordingBtn?.addEventListener(
  "click",
  () => {

    if (
      mediaRecorder &&
      mediaRecorder.state ===
        "recording"
    ) {

      mediaRecorder.stop();

    }


    stopRecordingTimer();


    startRecordingBtn.disabled =
      false;

    stopRecordingBtn.disabled =
      true;

  }
);


// ------------------------------------------------------------
// RECORD AGAIN / DISCARD
// ------------------------------------------------------------

discardRecordingBtn?.addEventListener(
  "click",
  () => {

    if (recordedAudioUrl) {

      URL.revokeObjectURL(
        recordedAudioUrl
      );

    }


    recordedAudioUrl = null;
    recordedAudioBlob = null;
    recordedChunks = [];


    audioPlayback.removeAttribute(
      "src"
    );

    audioPlayback.load();


    recordingPreview.classList.add(
      "hidden"
    );


    recordingTimer.textContent =
      "0:00";


    recordingStatus.textContent =
      "Ready to record";


    startRecordingBtn.disabled =
      false;

    stopRecordingBtn.disabled =
      true;

      startRecordingBtn.click();

  }
);

// ============================================================
// SUBMIT RECORDING TO SUPABASE
// Upload audio + create submission database record
// ============================================================

submitRecordingBtn?.addEventListener(
  "click",
  async () => {

    // --------------------------------------------------------
    // 1. Make sure a recording exists
    // --------------------------------------------------------

    if (!recordedAudioBlob) {

      alert(
        "There is no recording to submit."
      );

      return;
    }

    // Make absolutely sure this browser has
// an authenticated student session before submitting

const currentStudentAuthUser =
  studentAuthUser ||
  await ensureAnonymousStudentSession();


if (!currentStudentAuthUser) {

  recordingStatus.textContent =
    "Could not verify this device. Please refresh and try again.";

  return;
}


    // --------------------------------------------------------
    // 2. Get selected student
    // --------------------------------------------------------

    const studentSelect =
      document.getElementById(
        "recordingStudent"
      );


    const selectedOption =
      studentSelect?.selectedOptions[0];


    const studentId =
      selectedOption?.value || "";


    const studentName =
      selectedOption?.textContent?.trim() || "";


    const classId =
      selectedOption?.dataset?.classId || "";


    // Student must choose their name

    if (!studentId) {

      alert(
        "Please select your name before submitting your recording."
      );

      return;
    }


    // --------------------------------------------------------
    // 3. Show submitting state
    // --------------------------------------------------------

    submitRecordingBtn.disabled =
      true;

    submitRecordingBtn.textContent =
      "Submitting...";

    recordingStatus.textContent =
      "Uploading recording...";


    try {

      // ------------------------------------------------------
      // 4. Create unique filename
      // ------------------------------------------------------

      const timestamp =
        new Date()
          .toISOString()
          .replace(/[:.]/g, "-");


      const extension =
        recordedAudioBlob.type.includes("ogg")
          ? "ogg"
          : recordedAudioBlob.type.includes("mp4")
          ? "mp4"
          : "webm";


      // Put each student's recordings inside their own folder.

      const filename =
        `${studentId}/recording-${timestamp}.${extension}`;


      // ------------------------------------------------------
      // 5. Upload audio to private recordings bucket
      // ------------------------------------------------------

      const {
        data: uploadData,
        error: uploadError
      } =
        await supabaseClient
          .storage
          .from("recordings")
          .upload(
            filename,
            recordedAudioBlob,
            {
              contentType:
                recordedAudioBlob.type ||
                "audio/webm",

              upsert: false
            }
          );


      if (uploadError) {

        console.error(
          "Supabase upload error:",
          uploadError
        );

        throw uploadError;
      }


      console.log(
        "Recording uploaded:",
        uploadData
      );


      // ------------------------------------------------------
      // 6. Create submission record in database
      // ------------------------------------------------------

      recordingStatus.textContent =
        "Saving submission...";


      const {
        data: submissionData,
        error: submissionError
      } =
        await supabaseClient
          .from(
            "recording_submissions"
          )
          .insert([
            {
              student_id:
                studentId,

              student_name:
                studentName,

              class_id:
                classId,

              storage_path:
                uploadData.path,

              status:
                "Pending",

              submitter_uid:
                currentStudentAuthUser.id
            }
          ]);


      if (submissionError) {

        console.error(
          "Submission database error:",
          submissionError
        );

        throw submissionError;
      }


      console.log(
        "Submission saved:",
        submissionData
      );


      // ------------------------------------------------------
      // 7. Success
      // ------------------------------------------------------

      recordingStatus.textContent =
        "Recording submitted!";


      submitRecordingBtn.textContent =
        "Submitted ✓";


      submitRecordingBtn.disabled =
        true;


      discardRecordingBtn.disabled =
        true;

      if (typeof loadStudentFeedback === "function") {
  loadStudentFeedback();
}

    }


    catch (error) {

      console.error(
        "Recording submission failed:",
        error
      );


      recordingStatus.textContent =
        "Submission failed. Please try again.";


      submitRecordingBtn.disabled =
        false;


      submitRecordingBtn.textContent =
        "Submit Recording";

    }

  }
);

// ============================================================
// RECORDING STUDENT SELECTOR
// ============================================================

function populateRecordingStudentSelect() {

  const select =
    document.getElementById(
      "recordingStudent"
    );

  if (!select) return;

  select.innerHTML = `
    <option value="">
      Select your name…
    </option>
  `;

  const sortedStudents =
    [...allStudents].sort(
      (a, b) =>
        a.name.localeCompare(b.name)
    );

  sortedStudents.forEach(student => {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      student.id;

    option.textContent =
      student.name;

    option.dataset.classId =
      student.classId || "";

    select.appendChild(
      option
    );

  });

}

ensureAnonymousStudentSession()
  .then(() => {
    loadStudentFeedback();
  });

  // ============================================================
// STUDENT FEEDBACK / RECENT RECORDINGS
// ============================================================

async function loadStudentFeedback() {

  const list =
    document.getElementById(
      "student-feedback-list"
    );

  if (!list) return;


  // Make sure there is an authenticated anonymous student
  const user =
    studentAuthUser ||
    await ensureAnonymousStudentSession();


  if (!user) {

    list.innerHTML =
      "<p>Could not load recording history.</p>";

    return;

  }


  list.innerHTML =
    "<p>Loading your recordings...</p>";


  try {

    const {
      data: submissions,
      error
    } =
      await supabaseClient
        .from("recording_submissions")
        .select(
          "id, student_name, submitted_at, status, teacher_comment"
        )
        .eq(
          "submitter_uid",
          user.id
        )
        .order(
          "submitted_at",
          {
            ascending: false
          }
        )
        .limit(10);


    if (error) {
      throw error;
    }


    if (
      !submissions ||
      submissions.length === 0
    ) {

      list.innerHTML =
        "<p>No recent recordings yet.</p>";

      return;

    }


    list.innerHTML = "";


    submissions.forEach(
      submission => {

        const item =
          document.createElement(
            "div"
          );

        item.className =
          "feedback-item";


        const submittedDate =
          submission.submitted_at
            ? new Date(
                submission.submitted_at
              ).toLocaleString()
            : "";


        const status =
          submission.status ||
          "Pending";


        let statusClass =
          "pending";


        if (
          status.toLowerCase() ===
          "success"
        ) {

          statusClass =
            "success";

        }


        else if (
          status.toLowerCase() ===
          "try again"
        ) {

          statusClass =
            "try-again";

        }


        const teacherComment =
          submission.teacher_comment
            ? `
              <div class="feedback-comment">
                <strong>Teacher Comment:</strong><br>
                ${escapeHtml(
                  submission.teacher_comment
                )}
              </div>
            `
            : "";


        item.innerHTML = `

          <div class="feedback-header">

            <div class="feedback-name">
              ${escapeHtml(
                submission.student_name
              )}
            </div>

            <div class="feedback-date">
              ${escapeHtml(
                submittedDate
              )}
            </div>

          </div>


          <div
            class="feedback-status ${statusClass}"
          >
            ${escapeHtml(status)}
          </div>


          ${teacherComment}

        `;


        list.appendChild(
          item
        );

      }
    );

  }


  catch (error) {

    console.error(
      "Could not load student feedback:",
      error
    );


    list.innerHTML =
      "<p>Could not load recording history.</p>";

  }

}