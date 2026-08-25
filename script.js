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
let currentStudentAccount = null;
let currentLoggedInStudent = null;



// Google Sheet GIDs
const STUDENTS_GID = "7781822";
const ACHIEVEMENTS_GID = "509720984";
const EARNED_CARDS_GID = "1663037260";
const CLASSES_GID = "894952475";
const BAND_LEVELS_GID = "912222653";
const BAND_LEVEL_REQUIREMENTS_GID = "959194788";

// Global student list
let allStudents = [];

// Band Level data loaded from Google Sheets
let allBandLevels = [];
let allBandLevelRequirements = [];
let selectedBandLevelSubmission = null;
let currentBandLevelProgress = [];

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
  earnedCSV,
  bandLevelsCSV,
  bandLevelRequirementsCSV
] = await Promise.all([
  fetchSheetCSV(SHEET_ID, STUDENTS_GID),
  fetchSheetCSV(SHEET_ID, CLASSES_GID),
  fetchSheetCSV(SHEET_ID, ACHIEVEMENTS_GID),
  fetchSheetCSV(SHEET_ID, EARNED_CARDS_GID),
  fetchSheetCSV(SHEET_ID, BAND_LEVELS_GID),
  fetchSheetCSV(SHEET_ID, BAND_LEVEL_REQUIREMENTS_GID)
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

      const bandLevelsData =
  rowsToObjects(
    parseCSV(bandLevelsCSV)
  );

const bandLevelRequirementsData =
  rowsToObjects(
    parseCSV(bandLevelRequirementsCSV)
  );

  allBandLevels =
  bandLevelsData
    .filter(row =>
      String(row["active"]).toLowerCase() !== "false"
    )
    .map(row => ({
      id: row["level id"],
      number: Number(row["level number"]),
      name: row["level name"],
      image: row["image file"] || ""
    }))
    .sort((a, b) => a.number - b.number);


allBandLevelRequirements =
  bandLevelRequirementsData
    .map(row => ({
      id: row["requirement id"],
      levelId: row["level id"],
      name: row["requirement name"],
      description: row["description"] || "",
      order: Number(row["order"]) || 0
    }))
    .sort((a, b) => a.order - b.order);


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
      populateBandLevelStudentSelect();


    console.log(
      "Finished student database:",
      allStudents
    );


    // ========================================================
    // 8. DISPLAY
    // ========================================================

    applyFilters();

    restoreStudentLogin();

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
          audio: {
            autoGainControl: false,
            noiseSuppression: false,
            echoCancellation: false
          }
        });

        const audioTrack =
          recordingStream.getAudioTracks()[0];

        console.log(
          "Actual microphone settings:",
          audioTrack.getSettings()
        );


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

      startRecordingBtn.classList.add(
        "hidden"
      );

      stopRecordingBtn.classList.remove(
        "hidden"
      );


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

    startRecordingBtn.classList.add(
      "hidden"
    );

    stopRecordingBtn.classList.add(
      "hidden"
);

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
  studentAuthUser;


if (!currentStudentAuthUser) {

  recordingStatus.textContent =
    "Please sign in before submitting.";

  return;

}



    // --------------------------------------------------------
    // 2. Get selected student
    // --------------------------------------------------------

    if (
  !currentLoggedInStudent ||
  !studentAuthUser
) {

  recordingStatus.textContent =
    "Please sign in before submitting.";

  return;

}


const studentId =
  currentLoggedInStudent.id;

const studentName =
  currentLoggedInStudent.name;

const classId =
  currentLoggedInStudent.classId;

    // Student must choose their name



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

                submission_type:
                  selectedBandLevelSubmission
                    ? "Band Level"
                    : null,

                level_id:
                  selectedBandLevelSubmission?.levelId || null,

                requirement_id:
                  selectedBandLevelSubmission?.requirementId || null,

                requirement_name:
                  selectedBandLevelSubmission?.requirementName || null,

              storage_path:
                uploadData.path,

              status:
                "Pending",

              submitter_uid:
                studentAuthUser.id
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

      setTimeout(() => {

        closeRecorderModal();

        }, 1200);


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


  // ============================================================
// STUDENT FEEDBACK / RECENT RECORDINGS
// ============================================================

async function loadStudentFeedback() {

  const list =
    document.getElementById(
      "student-feedback-list"
    );

  if (!list) return;


  const user =
    studentAuthUser;


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

// ============================================================
// BAND LEVEL DASHBOARD - FIRST VERSION
// ============================================================

function populateBandLevelStudentSelect() {

  const select =
    document.getElementById(
      "bandLevelStudentSelect"
    );

  if (!select) return;


  select.innerHTML = `
    <option value="">
      Select a 5th grade student…
    </option>
  `;


  // C004 = 5th Grade Band
  const fifthGradeStudents =
    allStudents
      .filter(
        student =>
          student.classId === "C004"
      )
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name)
      );


  fifthGradeStudents.forEach(
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


// ------------------------------------------------------------
// Get only levels that currently have requirements
// ------------------------------------------------------------

function getConfiguredBandLevels() {

  const configuredLevelIds =
    new Set(
      allBandLevelRequirements.map(
        requirement =>
          requirement.levelId
      )
    );


  return allBandLevels.filter(
    level =>
      configuredLevelIds.has(
        level.id
      )
  );

}


// ------------------------------------------------------------
// Render Band Level journey
// FIRST VERSION:
// No progress loaded yet.
// Level 1 is current.
// Levels after Level 1 are locked.
// ------------------------------------------------------------

async function renderBandLevelDashboard(
  studentId
) {

  const profile =
    document.getElementById(
      "bandLevelStudentProfile"
    );

  const nameElement =
    document.getElementById(
      "bandLevelStudentName"
    );

  const journey =
    document.getElementById(
      "bandLevelJourney"
    );

  const currentLevelNumber =
    document.getElementById(
      "currentBandLevelNumber"
    );

  const currentLevelProgress =
    document.getElementById(
      "currentBandLevelProgress"
    );


  if (
    !profile ||
    !nameElement ||
    !journey
  ) {
    return;
  }


  const student =
    allStudents.find(
      item =>
        item.id === studentId
    );


  if (!student) {

    profile.classList.add(
      "hidden"
    );

    return;

  }


  profile.classList.remove(
    "hidden"
  );


  nameElement.textContent =
    student.name;


  const levels =
    getConfiguredBandLevels();


  if (!levels.length) {

    journey.innerHTML =
      "<p>No Band Levels configured.</p>";

    return;

  }


  // --------------------------------------------------------
  // Load this student's completed requirements
  // --------------------------------------------------------

  currentBandLevelProgress =
    await loadBandLevelProgressForStudent(
      studentId
    );


  const completedRequirementIds =
    new Set(
      currentBandLevelProgress.map(
        progress =>
          progress.requirement_id
      )
    );


  // --------------------------------------------------------
  // Determine each level's status
  // --------------------------------------------------------

  const levelStates =
    levels.map(
      level => {

        const requirements =
          allBandLevelRequirements
            .filter(
              requirement =>
                requirement.levelId ===
                level.id
            )
            .sort(
              (a, b) =>
                a.order - b.order
            );


        const completedCount =
          requirements.filter(
            requirement =>
              completedRequirementIds.has(
                requirement.id
              )
          ).length;


        const isCompleted =
          requirements.length > 0 &&
          completedCount ===
          requirements.length;


        return {
          level,
          requirements,
          completedCount,
          isCompleted
        };

      }
    );


  // --------------------------------------------------------
  // Find the first incomplete level.
  // That becomes the current unlocked level.
  // --------------------------------------------------------

  let currentLevelIndex =
    levelStates.findIndex(
      state =>
        !state.isCompleted
    );


  // If every configured level is complete
  if (currentLevelIndex === -1) {

    currentLevelIndex =
      levelStates.length - 1;

  }


  const activeState =
  levelStates[
    currentLevelIndex
  ];


// The student's earned/current Band Level is the
// previous completed level.
// If they're working on Level 1, their current level is 0.

const earnedLevelNumber =
  currentLevelIndex === 0
    ? 0
    : levelStates[
        currentLevelIndex - 1
      ].level.number;


const targetLevelNumber =
  activeState.level.number;


currentLevelNumber.textContent =
  earnedLevelNumber === 0
    ? "Starting Band Levels"
    : `Level ${earnedLevelNumber}`;


currentLevelProgress.textContent =
  `${activeState.completedCount} / ${activeState.requirements.length} requirements complete toward Level ${targetLevelNumber}`;


  journey.innerHTML = "";


  // --------------------------------------------------------
  // Render each level
  // --------------------------------------------------------

  levelStates.forEach(
    (state, index) => {

      const {
        level,
        requirements,
        completedCount,
        isCompleted
      } = state;


      const isCurrent =
        index === currentLevelIndex &&
        !isCompleted;


      const isLocked =
        index > currentLevelIndex;


      const levelElement =
        document.createElement(
          "div"
        );


      levelElement.className =
        "band-level-item";


      if (isCompleted) {

        levelElement.classList.add(
          "completed"
        );

      }

      else if (isCurrent) {

        levelElement.classList.add(
          "current"
        );

      }

      else if (isLocked) {

        levelElement.classList.add(
          "locked"
        );

      }


      let statusText = "";
      let statusClass = "";


      if (isCompleted) {

        statusText =
          "Completed";

        statusClass =
          "completed";

      }

      else if (isCurrent) {

        statusText =
          "Current";

        statusClass =
          "current";

      }

      else {

        statusText =
          "Locked";

        statusClass =
          "locked";

      }


      const requirementsHtml =
        requirements
          .map(
            requirement => {

              const requirementComplete =
                completedRequirementIds.has(
                  requirement.id
                );


              const icon =
                requirementComplete
                  ? "✓"
                  : "○";


              const recordButton =
                !isLocked &&
                !requirementComplete
                  ? `
                    <button
                      type="button"
                      class="band-level-record-button"
                      data-student-id="${escapeHtml(student.id)}"
                      data-student-name="${escapeHtml(student.name)}"
                      data-class-id="${escapeHtml(student.classId || "")}"
                      data-level-id="${escapeHtml(level.id)}"
                      data-level-name="${escapeHtml(level.name)}"
                      data-requirement-id="${escapeHtml(requirement.id)}"
                      data-requirement-name="${escapeHtml(requirement.name)}"
                    >
                      🎙 Submit Recording
                    </button>
                  `
                  : "";


              return `

                <div class="band-level-requirement">

                  <span class="requirement-icon">
                    ${icon}
                  </span>

                  <span class="requirement-name">
                    ${escapeHtml(
                      requirement.name
                    )}
                  </span>

                  ${recordButton}

                </div>

              `;

            }
          )
          .join("");


      const levelLockIcon =
        isLocked
          ? "🔒 "
          : "";


      levelElement.innerHTML = `

        <div class="band-level-item-header">

          <div class="band-level-item-title">
            ${levelLockIcon}${escapeHtml(
              level.name
            )}
          </div>

          <div
            class="band-level-status ${statusClass}"
          >
            ${statusText}
          </div>

        </div>


        <div class="band-level-requirements">

          ${requirementsHtml}

        </div>

      `;


      journey.appendChild(
        levelElement
      );

    }
  );

}


  

// ------------------------------------------------------------
// Student selector change
// ------------------------------------------------------------

document.addEventListener(
  "change",
  event => {

    if (
      event.target.id !==
      "bandLevelStudentSelect"
    ) {
      return;
    }


    const studentId =
      event.target.value;


    if (!studentId) {

      document
        .getElementById(
          "bandLevelStudentProfile"
        )
        ?.classList
        .add("hidden");

      return;

    }


    renderBandLevelDashboard(
      studentId
    );

  }
);

// ============================================================
// BAND LEVEL RECORDING BUTTONS
// ============================================================

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        ".band-level-record-button"
      );

    if (!button) return;

    if (!currentLoggedInStudent) {

  alert(
    "Please sign in before submitting a recording."
  );

  return;

}


    selectedBandLevelSubmission = {

      studentId:
        currentLoggedInStudent.id,

      studentName:
        currentLoggedInStudent.name,

      classId:
        currentLoggedInStudent.classId,

      levelId:
        button.dataset.levelId,

      levelName:
        button.dataset.levelName,

      requirementId:
        button.dataset.requirementId,

      requirementName:
        button.dataset.requirementName

    };



// Show exactly what the student is submitting
const recordingTarget =
  document.getElementById(
    "recording-target"
  );

if (recordingTarget) {

  recordingTarget.textContent =
    `${selectedBandLevelSubmission.requirementName} for ${selectedBandLevelSubmission.levelName}`;

}


        const recorderOverlay =
        document.getElementById(
          "recorder-overlay"
        );

      const recorderPanel =
        document.getElementById(
          "recorder-panel"
        );


      recorderOverlay?.classList.remove(
        "hidden"
      );

      recorderPanel?.classList.remove(
        "hidden"
      );

      document.body.classList.add(
        "recorder-open"
      );

      startRecordingBtn?.classList.remove(
         "hidden"
      );

stopRecordingBtn?.classList.add(
  "hidden"
);

  }

  
);

// ============================================================
// LOAD BAND LEVEL PROGRESS FOR SELECTED STUDENT
// ============================================================

async function loadBandLevelProgressForStudent(studentId) {

  const user =
    studentAuthUser;

  if (!user) {
    return [];
  }

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("band_level_progress")
        .select(
          "student_id, requirement_id, completed_at"
        )
        .eq(
          "student_id",
          studentId
        );

    if (error) {
      throw error;
    }

    return data || [];

  }

  catch (error) {

    console.error(
      "Could not load Band Level progress:",
      error
    );

    return [];

  }

}

// ============================================================
// RECORDER MODAL CLOSE
// ============================================================

function closeRecorderModal() {

  const overlay =
    document.getElementById(
      "recorder-overlay"
    );

  overlay?.classList.add(
    "hidden"
  );

  document.body.classList.remove(
    "recorder-open"
  );

}


document
  .getElementById(
    "closeRecorderBtn"
  )
  ?.addEventListener(
    "click",
    closeRecorderModal
  );


document
  .getElementById(
    "recorder-overlay"
  )
  ?.addEventListener(
    "click",
    event => {

      if (
        event.target.id ===
        "recorder-overlay"
      ) {

        closeRecorderModal();

      }

    }
  );

  // ============================================================
// STUDENT ACCOUNT LOGIN
// ============================================================

async function loginStudentAccount(
  username,
  password
) {

  const normalizedUsername =
    username
      .trim()
      .toLowerCase();


  const internalEmail =
    `${normalizedUsername}@bandcards.local`;


  const {
    data,
    error
  } =
    await supabaseClient.auth
      .signInWithPassword({
        email: internalEmail,
        password: password
      });


  if (error) {
    throw error;
  }


  const authUser =
    data.user;


  const {
    data: account,
    error: accountError
  } =
    await supabaseClient
      .from("student_accounts")
      .select(
        "student_id, username, active"
      )
      .eq(
        "auth_user_id",
        authUser.id
      )
      .single();


  if (accountError) {
    throw accountError;
  }


  if (!account.active) {
    throw new Error(
      "This student account is inactive."
    );
  }


  return {
    authUser,
    account
  };

}

document
  .getElementById(
    "student-login-form"
  )
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const username =
        document
          .getElementById(
            "student-username"
          )
          .value;


      const password =
        document
          .getElementById(
            "student-password"
          )
          .value;


      const message =
        document.getElementById(
          "student-login-message"
        );


      message.textContent =
        "Signing in...";


      try {

      const {
        authUser,
        account
      } =
        await loginStudentAccount(
          username,
          password
        );


        message.textContent = "";


        console.log(
          "Student account mapping:",
          account
        );


        const loggedInStudent =
          allStudents.find(
            student =>
              student.id ===
              account.student_id
          );


        if (!loggedInStudent) {

          throw new Error(
            "Student profile could not be found."
          );

        }

        currentStudentAccount =
          account;

        currentLoggedInStudent =
          loggedInStudent;

        studentAuthUser =
          authUser;

        showLoggedInStudentView(
          loggedInStudent
        );


        renderBandLevelDashboard(
          loggedInStudent.id
        );

              }


      catch (error) {

        console.error(
          "Student login failed:",
          error
        );


        message.textContent =
          "Could not sign in. Check your username and password.";

      }

    }
  );

  // ============================================================
// STUDENT AUTH VIEW STATE
// ============================================================

function showLoggedOutStudentView() {

  document
    .getElementById(
      "student-login-section"
    )
    ?.classList
    .remove("hidden");


  document
    .getElementById(
      "student-account-section"
    )
    ?.classList
    .add("hidden");


  document
    .getElementById(
      "band-level-dashboard-section"
    )
    ?.classList
    .add("hidden");

}


function showLoggedInStudentView(
  student
) {

  document
    .getElementById(
      "student-login-section"
    )
    ?.classList
    .add("hidden");


  document
    .getElementById(
      "student-account-section"
    )
    ?.classList
    .remove("hidden");


  document
    .getElementById(
      "band-level-dashboard-section"
    )
    ?.classList
    .remove("hidden");


  const nameElement =
    document.getElementById(
      "logged-in-student-name"
    );


  if (nameElement) {

    nameElement.textContent =
      student.name;

  }

}

document
  .getElementById(
    "student-logout-button"
  )
  ?.addEventListener(
    "click",
    async () => {

      await supabaseClient.auth
        .signOut();

      currentStudentAccount =
        null;

      currentLoggedInStudent =
        null;

      studentAuthUser =
        null;  


      selectedBandLevelSubmission =
        null;


      showLoggedOutStudentView();

    }
  );

  // ============================================================
// RESTORE EXISTING STUDENT LOGIN
// ============================================================

async function restoreStudentLogin() {

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


    const session =
      sessionData.session;


    // No student is signed in.
    // Keep the normal public website visible.
    if (!session?.user) {

      showLoggedOutStudentView();

      return;
    }


    const authUser =
      session.user;


    // Look for a student account attached to this Auth user.
    const {
      data: account,
      error: accountError
    } =
      await supabaseClient
        .from("student_accounts")
        .select(
          "student_id, username, active"
        )
        .eq(
          "auth_user_id",
          authUser.id
        )
        .maybeSingle();


    // A valid Supabase session may exist that is NOT a student
    // account. Don't treat that as a student login.
    if (
      accountError ||
      !account ||
      !account.active
    ) {

      showLoggedOutStudentView();

      return;
    }


    const student =
      allStudents.find(
        item =>
          item.id ===
          account.student_id
      );


    if (!student) {

      console.error(
        "Logged-in student was not found in Students data."
      );

      showLoggedOutStudentView();

      return;
    }


    currentStudentAccount =
      account;

    currentLoggedInStudent =
      student;

    studentAuthUser =
      authUser;


    showLoggedInStudentView(
      student
    );


    renderBandLevelDashboard(
      student.id
    );


    loadStudentFeedback();

  }

  catch (error) {

    console.error(
      "Could not restore student login:",
      error
    );


    showLoggedOutStudentView();

  }

}
