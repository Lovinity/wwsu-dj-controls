window.addEventListener("DOMContentLoaded", () => {
    window.ipc.renderer.send("console", ["log", "Skyway: Process is ready"]);
});