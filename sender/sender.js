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


const startRecordingButton =
  document.getElementById(
    "start-recording-button"
  );

const stopRecordingButton =
  document.getElementById(
    "stop-recording-button"
  );

const recordingStatus =
  document.getElementById(
    "recording-status"
  );

const savedRecordingsContainer =
  document.getElementById(
    "saved-recordings"
  );

const publicRecordingForm =
  document.getElementById(
    "public-recording-form"
  );

const sendRecordingsButton =
  document.getElementById(
    "send-recordings-button"
  );


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
// START RECORDING
// ============================================================

async function startRecording() {

  if (
    savedRecordings.length >=
    MAX_RECORDINGS
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
      finishRecording
    );


    mediaRecorder.start();


    recordingStatus.textContent =
      "Recording...";


    startRecordingButton.disabled =
      true;

    stopRecordingButton.disabled =
      false;

  }
  catch (error) {

    console.error(
      "Could not start recording:",
      error
    );


    recordingStatus.textContent =
      "Microphone access could not be started.";

  }

}


// ============================================================
// STOP RECORDING
// ============================================================

function stopRecording() {

  if (
    !mediaRecorder ||
    mediaRecorder.state !==
      "recording"
  ) {
    return;
  }


  mediaRecorder.stop();


  recordingStatus.textContent =
    "Finishing recording...";

}


// ============================================================
// FINISH / SAVE RECORDING
// ============================================================

function finishRecording() {

  const finalMimeType =
    mediaRecorder.mimeType ||
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


  renderSavedRecordings();


  recordingStatus.textContent =
    savedRecordings.length <
      MAX_RECORDINGS
      ? "Recording saved. You can record another or send your recordings."
      : "Three recordings saved. You're ready to send.";


  stopRecordingButton.disabled =
    true;


  updateRecorderButtons();

}


// ============================================================
// DISPLAY SAVED RECORDINGS
// ============================================================

function renderSavedRecordings() {

  if (
    !savedRecordingsContainer
  ) {
    return;
  }


  savedRecordingsContainer
    .innerHTML =
      "";


  savedRecordings
    .forEach(
      (
        recording,
        index
      ) => {

        const card =
          document.createElement(
            "div"
          );


        card.className =
          "saved-recording-card";


        card.innerHTML = `
          <div class="saved-recording-header">

            <strong>
              Recording ${index + 1}
            </strong>

            <button
              type="button"
              class="delete-recording-button"
              data-recording-id="${recording.id}"
            >
              Delete
            </button>

          </div>

          <audio
            controls
            src="${recording.url}"
            class="saved-recording-audio"
          ></audio>
        `;


        savedRecordingsContainer
          .appendChild(
            card
          );

      }
    );


  const deleteButtons =
    savedRecordingsContainer
      .querySelectorAll(
        ".delete-recording-button"
      );


  deleteButtons
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            deleteRecording(
              button.dataset
                .recordingId
            );

          }
        );

      }
    );


  updateSendButtonState();

}


// ============================================================
// DELETE RECORDING
// ============================================================

function deleteRecording(
  recordingId
) {

  const recording =
    savedRecordings.find(
      item =>
        item.id ===
        recordingId
    );


  if (recording) {

    URL.revokeObjectURL(
      recording.url
    );

  }


  savedRecordings =
    savedRecordings.filter(
      item =>
        item.id !==
        recordingId
    );


  renderSavedRecordings();


  recordingStatus.textContent =
    savedRecordings.length
      ? "Recording deleted. You can record another or send your recordings."
      : "Ready to record.";


  updateRecorderButtons();

}


// ============================================================
// BUTTON STATES
// ============================================================

function updateRecorderButtons() {

  if (
    !startRecordingButton
  ) {
    return;
  }


  startRecordingButton.disabled =
    savedRecordings.length >=
    MAX_RECORDINGS;

}


function updateSendButtonState() {

  if (
    !sendRecordingsButton
  ) {
    return;
  }


  sendRecordingsButton.disabled =
    savedRecordings.length ===
    0;

}


// ============================================================
// RECORDER BUTTON EVENTS
// ============================================================

if (
  startRecordingButton &&
  stopRecordingButton
) {

  startRecordingButton
    .addEventListener(
      "click",
      startRecording
    );


  stopRecordingButton
    .addEventListener(
      "click",
      stopRecording
    );

}


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
// SEND ALL RECORDINGS
// ============================================================

if (publicRecordingForm) {

  publicRecordingForm
    .addEventListener(
      "submit",
      async (event) => {

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


        const comment =
          document
            .getElementById(
              "sender-comment"
            )
            ?.value
            .trim() || "";


        if (!studentName) {

          recordingStatus.textContent =
            "Please enter your name.";

          return;
        }


        sendRecordingsButton.disabled =
          true;

        startRecordingButton.disabled =
          true;

        sendRecordingsButton.textContent =
          "Sending...";


        try {

          for (
            let index = 0;
            index <
              savedRecordings.length;
            index++
          ) {

            recordingStatus.textContent =
              `Sending recording ${index + 1} of ${savedRecordings.length}...`;


            await uploadRecording(
              savedRecordings[index],
              studentName,
              comment
            );

          }


          savedRecordings
            .forEach(
              recording => {

                URL.revokeObjectURL(
                  recording.url
                );

              }
            );


          savedRecordings =
            [];


          renderSavedRecordings();


          recordingStatus.textContent =
            "Your recordings were sent successfully!";


          sendRecordingsButton.textContent =
            "Sent";


          startRecordingButton.disabled =
            false;

        }
        catch (error) {

          console.error(
            "Could not send recordings:",
            error
          );


          recordingStatus.textContent =
            error.message ||
            "Could not send recordings.";


          sendRecordingsButton.textContent =
            "Send Recordings";


          updateRecorderButtons();
          updateSendButtonState();

        }

      }
    );

}


updateSendButtonState();