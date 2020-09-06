"use strict";
window.addEventListener("DOMContentLoaded", () => {
  // Initialize the recorder
  var recorder = new WWSUrecorder("assets/plugins/webaudiorecorder/");
  recorder.initRecorder();
  recorder.on("recorderReady", "recorder", () => {
    window.ipc.renderer.send("console", ["log", "Recorder: Process is ready"]);
    window.ipc.renderer.send("recorderReady", []);
  });

  // Pass volume info to main process to be passed to renderer
  recorder.audio.on(
    "audioVolume",
    "recorder",
    (volume, clipping, maxVolume) => {
      window.ipc.renderer.send("recorderVolume", [volume, clipping, maxVolume]);
    }
  );

  // Pass buffer info to main process to be saved
  recorder.on("recorderBuffer", "recorder", (file, buffer) => {
    window.ipc.main.send("recorderBuffer", [file, buffer]);
  });

  // Listen for device change requests
  window.ipc.on("recorderChangeDevice", (device) => {
    recorder.audio.changeDevice(device);
  });

  // listen for audio recordings saved
  window.ipc.on("recorderSaved", (file) => {
    console.log(`Audio file saved: ${file}`);
  });

  // Start a new recording
  window.ipc.on("recorderStart", (file) => {
    recorder.newRecording(file, window.settings.delay);
  });
});
