"use strict";
window.addEventListener("DOMContentLoaded", () => {
  window.ipc.on.notificationData((event, data) => {

    // Create card notification content
    $(".main-content").html(`<div class="card bg-${data.bg}">
        <div class="card-header">
          <h3 class="card-title">${data.header}</h3>
        </div>
        <div class="card-body">
          ${data.body}
        </div>
      </div>`);

    // Flash notification if specified
    if (data.flash) {
      let flashState = 0;
      setInterval(() => {
        flashState++;
        if (flashState >= 10) flashState = 0;
        if (!flashState) {
          $(".card").removeClass(`bg-${data.bg}`);
          $(".card").addClass(`bg-black`);
        } else {
          $(".card").removeClass(`bg-black`);
          $(".card").addClass(`bg-${data.bg}`);
        }
      }, 200);
    }
  });
});
