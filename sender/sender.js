const SUPABASE_URL =
  "https://spkgcythuogunkqsmhqp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_Svmi15-_UY2CxEwLfHm-Lw_ZXOGRPAC";

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storageKey:
          "band-cards-student-auth"
      }
    }
  );


async function checkStudentLogin() {

  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getSession();

  if (error) {
    console.error(
      "Could not check student login:",
      error
    );

    return;
  }

  const session =
    data.session;

  if (!session) {
    return;
  }

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

let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let recordingStream = null;


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

const recordingPlayback =
  document.getElementById(
    "recording-playback"
  );


function getPreferredRecordingMimeType() {

  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];

  for (const type of preferredTypes) {

    if (
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }

  }

  return "";

}


async function startRecording() {

  try {

    recordingStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });


    const mimeType =
      getPreferredRecordingMimeType();


    const recorderOptions = {
      audioBitsPerSecond: 96000
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


    recordedChunks = [];
    recordedBlob = null;


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

        const finalMimeType =
          mediaRecorder.mimeType ||
          mimeType ||
          "audio/webm";


        recordedBlob =
          new Blob(
            recordedChunks,
            {
              type: finalMimeType
            }
          );


        const recordingUrl =
          URL.createObjectURL(
            recordedBlob
          );


        recordingPlayback.src =
          recordingUrl;

        recordingPlayback.hidden =
          false;


        recordingStatus.textContent =
          "Recording complete. You can play it back below.";


        startRecordingButton.disabled =
          false;

        stopRecordingButton.disabled =
          true;


        if (recordingStream) {

          recordingStream
            .getTracks()
            .forEach(
              track => track.stop()
            );

        }

      }
    );


    mediaRecorder.start();


    recordingStatus.textContent =
      "Recording...";


    startRecordingButton.disabled =
      true;

    stopRecordingButton.disabled =
      false;

    recordingPlayback.hidden =
      true;

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