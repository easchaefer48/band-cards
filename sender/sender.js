const SUPABASE_URL =
  "https://spkgcythuogunkqsmhqp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_Svmi15-_UY2CxEwLfHm-Lw_ZXOGRPAC";

const STUDENT_AUTH_STORAGE_KEY =
  "band-cards-student-auth";

const MAX_RECORDINGS =
  3;


const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storageKey:
          STUDENT_AUTH_STORAGE_KEY
      }
    }
  );


// ============================================================
// CHECK FOR EXISTING STUDENT LOGIN
// ============================================================

async function checkStudentLogin() {

  try {

    const storedSessionText =
      localStorage.getItem(
        STUDENT_AUTH_STORAGE_KEY
      );


    if (!storedSessionText) {
      return;
    }


    const storedSession =
      JSON.parse(
        storedSessionText
      );


    if (
      !storedSession?.access_token ||
      !storedSession?.refresh_token
    ) {
      return;
    }


    const {
      data,
      error
    } =
      await supabaseClient.auth
        .setSession({
          access_token:
            storedSession.access_token,

          refresh_token:
            storedSession.refresh_token
        });


    if (error) {

      console.error(
        "Could not restore student session:",
        error
      );

      return;
    }


    if (!data.session?.user) {
      return;
    }


    showLoggedInSenderState();

  }
  catch (error) {

    console.error(
      "Could not check student login:",
      error
    );

  }

}


function showLoggedInSenderState() {

  const senderPanel =
    document.querySelector(
      ".sender-panel"
    );


  if (!senderPanel) {
    return;
  }


  senderPanel.innerHTML = `
    <div class="sender-intro">

      <h1>You're Signed In</h1>

      <p>
        Your account-based recording sender
        is coming soon.
      </p>

    </div>
  `;

}


checkStudentLogin();


// ============================================================
// RECORDER
// ============================================================

let mediaRecorder =
  null;

let recordedChunks =
  [];

let recordingStream =
  null;

let savedRecordings =
  [];

let currentRecordingNumber =
  1;

let recordingDotsInterval =
  null;

let recordingDotCount =
  1;


const recordingCardsContainer =
  document.getElementById(
    "recording-cards"
  );

const addAnotherRecordingButton =
  document.getElementById(
    "add-another-recording-button"
  );

const publicRecordingForm =
  document.getElementById(
    "public-recording-form"
  );

const sendRecordingsButton =
  document.getElementById(
    "send-recordings-button"
  );


// ============================================================
// MIME TYPE
// ============================================================

function getPreferredRecordingMimeType() {

  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];


  for (
    const type
    of preferredTypes
  ) {

    if (
      MediaRecorder
        .isTypeSupported(type)
    ) {
      return type;
    }

  }


  return "";

}


// ============================================================
// CREATE RECORDING CARD
// ============================================================

function createRecordingCard(
  recordingNumber
) {

  const card =
    document.createElement(
      "div"
    );


  card.className =
    "recording-card active-recording-card";


  card.dataset
    .recordingNumber =
      recordingNumber;


  card.innerHTML = `
    <div class="recording-card-header">

      <h3>
        Recording ${recordingNumber}
      </h3>

    </div>


    <div class="recording-card-controls">

      <button
        type="button"
        class="recorder-button start-recording-button"
      >
        ${
          recordingNumber === 1
            ? "Start Recording"
            : "Start Recording"
        }
      </button>


      <button
        type="button"
        class="recorder-button pause-recording-button"
        hidden
      >
        Pause
      </button>


      <button
        type="button"
        class="recorder-button end-recording-button"
        hidden
      >
        End Recording
      </button>

    </div>


    <p
      class="recording-status"
    >
      Ready to record.
    </p>


    <div
      class="recording-playback-area"
      hidden
    >

      <audio
        controls
        class="recording-playback"
      ></audio>


      <button
        type="button"
        class="delete-recording-button"
      >
        Delete Recording
      </button>

    </div>
  `;


  wireRecordingCard(
    card
  );


  return card;

}


// ============================================================
// WIRE RECORDING CARD
// ============================================================

function wireRecordingCard(
  card
) {

  const startButton =
    card.querySelector(
      ".start-recording-button"
    );

  const pauseButton =
    card.querySelector(
      ".pause-recording-button"
    );

  const endButton =
    card.querySelector(
      ".end-recording-button"
    );

  const deleteButton =
    card.querySelector(
      ".delete-recording-button"
    );


  if (startButton) {

    startButton
      .addEventListener(
        "click",
        () => {

          startRecording(
            card
          );

        }
      );

  }


  if (pauseButton) {

    pauseButton
      .addEventListener(
        "click",
        () => {

          togglePauseRecording(
            card
          );

        }
      );

  }


  if (endButton) {

    endButton
      .addEventListener(
        "click",
        () => {

          endRecording(
            card
          );

        }
      );

  }


  if (deleteButton) {

    deleteButton
      .addEventListener(
        "click",
        () => {

          deleteRecordingCard(
            card
          );

        }
      );

  }

}


// ============================================================
// START RECORDING
// ============================================================

async function startRecording(
  card
) {

  if (
    mediaRecorder &&
    (
      mediaRecorder.state ===
        "recording" ||
      mediaRecorder.state ===
        "paused"
    )
  ) {
    return;
  }


  try {

    recordingStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation:
              false,

            noiseSuppression:
              false,

            autoGainControl:
              false
          }
        });


    const mimeType =
      getPreferredRecordingMimeType();


    const recorderOptions = {
      audioBitsPerSecond:
        96000
    };


    if (mimeType) {

      recorderOptions.mimeType =
        mimeType;

    }


    mediaRecorder =
      new MediaRecorder(
        recordingStream,
        recorderOptions
      );


    recordedChunks =
      [];


    mediaRecorder.addEventListener(
      "dataavailable",
      (event) => {

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


    mediaRecorder.addEventListener(
      "stop",
      () => {

        finishRecording(
          card
        );

      }
    );


    mediaRecorder.start();


    const startButton =
      card.querySelector(
        ".start-recording-button"
      );

    const pauseButton =
      card.querySelector(
        ".pause-recording-button"
      );

    const endButton =
      card.querySelector(
        ".end-recording-button"
      );

    const status =
      card.querySelector(
        ".recording-status"
      );


    if (startButton) {

      startButton.classList.add(
        "recording-active"
      );

      startButton.disabled =
        true;

    }


    if (pauseButton) {

      pauseButton.hidden =
        false;

    }


    if (endButton) {

      endButton.hidden =
        false;

    }


    if (status) {

      status.textContent =
        "Recording in progress.";

    }


    startRecordingDots(
      startButton
    );

  }
  catch (error) {

    console.error(
      "Could not start recording:",
      error
    );


    const status =
      card.querySelector(
        ".recording-status"
      );


    if (status) {

      status.textContent =
        "Microphone access could not be started.";

    }

  }

}


// ============================================================
// RECORDING DOT ANIMATION
// ============================================================

function startRecordingDots(
  button
) {

  stopRecordingDots();


  recordingDotCount =
    1;


  updateRecordingDots(
    button
  );


  recordingDotsInterval =
    setInterval(
      () => {

        recordingDotCount++;


        if (
          recordingDotCount > 3
        ) {

          recordingDotCount =
            1;

        }


        updateRecordingDots(
          button
        );

      },
      500
    );

}


function updateRecordingDots(
  button
) {

  if (!button) {
    return;
  }


  button.innerHTML = `
    <span class="recording-label">
      Recording
    </span><span class="recording-dots">${".".repeat(recordingDotCount)}</span>
  `;

}


function stopRecordingDots() {

  if (
    recordingDotsInterval
  ) {

    clearInterval(
      recordingDotsInterval
    );


    recordingDotsInterval =
      null;

  }

}


// ============================================================
// PAUSE / RESUME RECORDING
// ============================================================

function togglePauseRecording(
  card
) {

  if (!mediaRecorder) {
    return;
  }


  const startButton =
    card.querySelector(
      ".start-recording-button"
    );

  const pauseButton =
    card.querySelector(
      ".pause-recording-button"
    );

  const status =
    card.querySelector(
      ".recording-status"
    );


  if (
    mediaRecorder.state ===
      "recording"
  ) {

    mediaRecorder.pause();


    stopRecordingDots();


    if (startButton) {

      startButton.textContent =
        "Paused";

      startButton.classList.remove(
        "recording-active"
      );

      startButton.classList.add(
        "recording-paused"
      );

    }


    if (pauseButton) {

      pauseButton.textContent =
        "Resume";

      pauseButton.classList.add(
        "resume-active"
      );

    }


    if (status) {

      status.textContent =
        "Recording paused.";

    }


    return;
  }


  if (
    mediaRecorder.state ===
      "paused"
  ) {

    mediaRecorder.resume();


    if (startButton) {

      startButton.classList.remove(
        "recording-paused"
      );

      startButton.classList.add(
        "recording-active"
      );

    }


    if (pauseButton) {

      pauseButton.textContent =
        "Pause";

      pauseButton.classList.remove(
        "resume-active"
      );

    }


    if (status) {

      status.textContent =
        "Recording in progress.";

    }


    startRecordingDots(
      startButton
    );

  }

}


// ============================================================
// END RECORDING
// ============================================================

function endRecording(
  card
) {

  if (!mediaRecorder) {
    return;
  }


  if (
    mediaRecorder.state !==
      "recording" &&
    mediaRecorder.state !==
      "paused"
  ) {
    return;
  }


  stopRecordingDots();


  const status =
    card.querySelector(
      ".recording-status"
    );


  if (status) {

    status.textContent =
      "Finishing recording...";

  }


  mediaRecorder.stop();

}


// ============================================================
// FINISH RECORDING
// ============================================================

function finishRecording(
  card
) {

  const finalMimeType =
    mediaRecorder?.mimeType ||
    "audio/webm";


  const blob =
    new Blob(
      recordedChunks,
      {
        type:
          finalMimeType
      }
    );


  const recording = {
    id:
      crypto.randomUUID(),

    blob:
      blob,

    url:
      URL.createObjectURL(
        blob
      ),

    recordingNumber:
      Number(
        card.dataset
          .recordingNumber
      )
  };


  savedRecordings.push(
    recording
  );


  if (recordingStream) {

    recordingStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  recordingStream =
    null;

  mediaRecorder =
    null;

  recordedChunks =
    [];


  finalizeRecordingCard(
    card,
    recording
  );


  updateSendButtonState();


  if (
    savedRecordings.length <
    MAX_RECORDINGS
  ) {

    addAnotherRecordingButton.hidden =
      false;

  }
  else {

    addAnotherRecordingButton.hidden =
      true;

  }

}


// ============================================================
// FINALIZE CARD
// ============================================================

function finalizeRecordingCard(
  card,
  recording
) {

  const controls =
    card.querySelector(
      ".recording-card-controls"
    );

  const status =
    card.querySelector(
      ".recording-status"
    );

  const playbackArea =
    card.querySelector(
      ".recording-playback-area"
    );

  const audio =
    card.querySelector(
      ".recording-playback"
    );


  if (controls) {

    controls.hidden =
      true;

  }


  if (status) {

    status.textContent =
      "Recording complete.";

  }


  if (audio) {

    audio.src =
      recording.url;

  }


  if (playbackArea) {

    playbackArea.hidden =
      false;

  }


  card.classList.remove(
    "active-recording-card"
  );


  card.classList.add(
    "finished-recording-card"
  );

}


// ============================================================
// ADD ANOTHER RECORDING
// ============================================================

function addAnotherRecording() {

  if (
    savedRecordings.length >=
    MAX_RECORDINGS
  ) {
    return;
  }


  addAnotherRecordingButton.hidden =
    true;


  currentRecordingNumber =
    savedRecordings.length +
    1;


  const card =
    createRecordingCard(
      currentRecordingNumber
    );


  recordingCardsContainer
    .appendChild(
      card
    );


  card.scrollIntoView({
    behavior:
      "smooth",

    block:
      "nearest"
  });

}


// ============================================================
// DELETE RECORDING CARD
// ============================================================

function deleteRecordingCard(
  card
) {

  const recordingNumber =
    Number(
      card.dataset
        .recordingNumber
    );


  const recording =
    savedRecordings.find(
      item =>
        item.recordingNumber ===
        recordingNumber
    );


  if (recording) {

    URL.revokeObjectURL(
      recording.url
    );

  }


  savedRecordings =
    savedRecordings.filter(
      item =>
        item.recordingNumber !==
        recordingNumber
    );


  card.remove();


  renumberRecordingCards();


  updateSendButtonState();


  if (
    savedRecordings.length <
    MAX_RECORDINGS &&
    savedRecordings.length > 0
  ) {

    addAnotherRecordingButton.hidden =
      false;

  }


  if (
    savedRecordings.length ===
    0
  ) {

    resetRecorderCards();

  }

}


// ============================================================
// RENUMBER CARDS
// ============================================================

function renumberRecordingCards() {

  const cards =
    recordingCardsContainer
      .querySelectorAll(
        ".recording-card"
      );


  cards.forEach(
    (
      card,
      index
    ) => {

      const newNumber =
        index + 1;


      card.dataset
        .recordingNumber =
          newNumber;


      const heading =
        card.querySelector(
          ".recording-card-header h3"
        );


      if (heading) {

        heading.textContent =
          `Recording ${newNumber}`;

      }

    }
  );


  savedRecordings.forEach(
    (
      recording,
      index
    ) => {

      recording.recordingNumber =
        index + 1;

    }
  );

}


// ============================================================
// RESET RECORDER CARDS
// ============================================================

function resetRecorderCards() {

  recordingCardsContainer
    .innerHTML =
      "";


  const firstCard =
    createRecordingCard(
      1
    );


  recordingCardsContainer
    .appendChild(
      firstCard
    );


  currentRecordingNumber =
    1;


  addAnotherRecordingButton.hidden =
    true;


  updateSendButtonState();

}


// ============================================================
// SEND BUTTON STATE
// ============================================================

function updateSendButtonState() {

  if (
    !sendRecordingsButton
  ) {
    return;
  }


  const count =
    savedRecordings.length;


  sendRecordingsButton.disabled =
    count === 0;


  if (count === 1) {

    sendRecordingsButton.textContent =
      "Send Recording";

  }
  else if (count > 1) {

    sendRecordingsButton.textContent =
      `Send ${count} Recordings`;

  }
  else {

    sendRecordingsButton.textContent =
      "Send Recording";

  }

}


// ============================================================
// ADD-ANOTHER BUTTON EVENT
// ============================================================

if (
  addAnotherRecordingButton
) {

  addAnotherRecordingButton
    .addEventListener(
      "click",
      addAnotherRecording
    );

}


// ============================================================
// WIRE FIRST HTML CARD
// ============================================================

const initialRecordingCard =
  document.querySelector(
    ".recording-card"
  );


if (
  initialRecordingCard
) {

  wireRecordingCard(
    initialRecordingCard
  );

}


updateSendButtonState();

// ============================================================
// UPLOAD ONE RECORDING
// ============================================================

async function uploadRecording(
  recording,
  studentName,
  comment
) {

  const formData =
    new FormData();


  formData.append(
    "studentName",
    studentName
  );


  formData.append(
    "comment",
    comment
  );


  const extension =
    recording.blob.type
      .includes("mp4")
      ? "mp4"
      : "webm";


  const recordingFile =
    new File(
      [
        recording.blob
      ],
      `recording.${extension}`,
      {
        type:
          recording.blob.type
      }
    );


  formData.append(
    "recording",
    recordingFile
  );


  const response =
    await fetch(
      `${SUPABASE_URL}/functions/v1/submit-public-recording`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
        },

        body:
          formData
      }
    );


  const result =
    await response.json();


  if (!response.ok) {

    throw new Error(
      result.error ||
      "Could not send recording."
    );

  }


  return result;

}


// ============================================================
// SUBMISSION CONFIRMATION
// ============================================================

const submissionConfirmation =
  document.getElementById(
    "submission-confirmation"
  );

const submissionConfirmationMessage =
  document.getElementById(
    "submission-confirmation-message"
  );

const cancelSubmissionButton =
  document.getElementById(
    "cancel-submission-button"
  );

const confirmSubmissionButton =
  document.getElementById(
    "confirm-submission-button"
  );

const submissionSuccess =
  document.getElementById(
    "submission-success"
  );


let pendingSubmissionData =
  null;


// ============================================================
// SHOW CONFIRMATION
// ============================================================

function showSubmissionConfirmation(
  studentName,
  comment
) {

  const count =
    savedRecordings.length;


  if (count === 0) {
    return;
  }


  pendingSubmissionData = {
    studentName,
    comment
  };


  if (
    submissionConfirmationMessage
  ) {

    if (count === 1) {

      submissionConfirmationMessage
        .textContent =
          "Are you sure you want to submit this recording?";

    }
    else if (count === 2) {

      submissionConfirmationMessage
        .textContent =
          "Are you sure you want to submit these two recordings?";

    }
    else {

      submissionConfirmationMessage
        .textContent =
          `Are you sure you want to submit these ${count} recordings?`;

    }

  }


  if (
    submissionConfirmation
  ) {

    submissionConfirmation.hidden =
      false;

  }

}


// ============================================================
// HIDE CONFIRMATION
// ============================================================

function hideSubmissionConfirmation() {

  if (
    submissionConfirmation
  ) {

    submissionConfirmation.hidden =
      true;

  }


  pendingSubmissionData =
    null;

}


// ============================================================
// FORM SUBMIT
// ============================================================

if (publicRecordingForm) {

  publicRecordingForm
    .addEventListener(
      "submit",
      (event) => {

        event.preventDefault();


        if (
          savedRecordings.length ===
          0
        ) {
          return;
        }


        const studentName =
          document
            .getElementById(
              "sender-name"
            )
            ?.value
            .trim() || "";

        if (!studentName) {

          const nameRequiredModal =
            document.getElementById(
              "name-required-modal"
            );

          if (nameRequiredModal) {
            nameRequiredModal.hidden = false;
          }

          return;
        }  

        const comment =
          document
            .getElementById(
              "sender-comment"
            )
            ?.value
            .trim() || "";


        if (!studentName) {

          const firstStatus =
            document.querySelector(
              ".recording-status"
            );


          if (firstStatus) {

            firstStatus.textContent =
              "Please enter your name.";

          }


          return;
        }


        showSubmissionConfirmation(
          studentName,
          comment
        );

      }
    );

}


// ============================================================
// CANCEL CONFIRMATION
// ============================================================

if (
  cancelSubmissionButton
) {

  cancelSubmissionButton
    .addEventListener(
      "click",
      hideSubmissionConfirmation
    );

}


// ============================================================
// CONFIRM SUBMISSION
// ============================================================

if (
  confirmSubmissionButton
) {

  confirmSubmissionButton
    .addEventListener(
      "click",
      async () => {

        if (
          !pendingSubmissionData ||
          savedRecordings.length === 0
        ) {
          return;
        }


        const {
          studentName,
          comment
        } =
          pendingSubmissionData;


        submissionConfirmation.hidden =
          true;


        confirmSubmissionButton.disabled =
          true;

        cancelSubmissionButton.disabled =
          true;

        sendRecordingsButton.disabled =
          true;

        addAnotherRecordingButton.disabled =
          true;


        try {

          while (
            savedRecordings.length >
            0
          ) {

            const recording =
              savedRecordings[0];


            const totalRemaining =
              savedRecordings.length;


            sendRecordingsButton.textContent =
              totalRemaining === 1
                ? "Sending Recording..."
                : `Sending ${totalRemaining} Recordings...`;


            await uploadRecording(
              recording,
              studentName,
              comment
            );


            URL.revokeObjectURL(
              recording.url
            );


            savedRecordings.shift();


            const matchingCard =
              recordingCardsContainer
                .querySelector(
                  `[data-recording-number="${recording.recordingNumber}"]`
                );


            if (matchingCard) {

              matchingCard.remove();

            }


            renumberRecordingCards();

          }


          pendingSubmissionData =
            null;


          showSubmissionSuccess();

        }
        catch (error) {

          console.error(
            "Could not send recordings:",
            error
          );


          alert(
            error.message ||
            "Could not send recordings."
          );


          confirmSubmissionButton.disabled =
            false;

          cancelSubmissionButton.disabled =
            false;

          addAnotherRecordingButton.disabled =
            false;


          updateSendButtonState();

        }

      }
    );

}


// ============================================================
// SUCCESS STATE
// ============================================================

function showSubmissionSuccess() {

  if (
    submissionSuccess
  ) {

    submissionSuccess.hidden =
      false;

  }


  if (
    publicRecordingForm
  ) {

    publicRecordingForm.hidden =
      true;

  }


  setTimeout(
    () => {

      resetPublicSender();

    },
    1800
  );

}

const nameRequiredModal =
  document.getElementById(
    "name-required-modal"
  );

const nameRequiredOkButton =
  document.getElementById(
    "name-required-ok-button"
  );

if (nameRequiredOkButton) {

  nameRequiredOkButton.addEventListener(
    "click",
    () => {

      if (nameRequiredModal) {
        nameRequiredModal.hidden = true;
      }

      const nameInput =
        document.getElementById(
          "sender-name"
        );

      if (nameInput) {
        nameInput.focus();
      }

    }
  );

}


// ============================================================
// RESET FULL SENDER
// ============================================================

function resetPublicSender() {

  const senderName =
    document.getElementById(
      "sender-name"
    );

  const senderComment =
    document.getElementById(
      "sender-comment"
    );


  if (senderName) {

    senderName.value =
      "";

  }


  if (senderComment) {

    senderComment.value =
      "";

  }


  savedRecordings.forEach(
    recording => {

      URL.revokeObjectURL(
        recording.url
      );

    }
  );


  savedRecordings =
    [];


  pendingSubmissionData =
    null;


  if (
    submissionSuccess
  ) {

    submissionSuccess.hidden =
      true;

  }


  if (
    submissionConfirmation
  ) {

    submissionConfirmation.hidden =
      true;

  }


  if (
    publicRecordingForm
  ) {

    publicRecordingForm.hidden =
      false;

  }


  confirmSubmissionButton.disabled =
    false;

  cancelSubmissionButton.disabled =
    false;

  addAnotherRecordingButton.disabled =
    false;


  resetRecorderCards();


  window.scrollTo({
    top:
      0,

    behavior:
      "smooth"
  });

}