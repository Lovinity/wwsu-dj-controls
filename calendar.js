"use strict";
window.addEventListener("DOMContentLoaded", () => {
  window.ipc.renderer.send("console", ["log", "Calendar: Process is ready"]);

  /**
   *  Update the clockwheel
   *  TODO: Find a better calculation method
   *
   *  @var {array} arg[0] Array of calendar events (WWSUcalendar.getEvents) between 24 hours before now and 24 hours after now.
   *  @var {object} arg[1] WWSUMeta.meta
   */
  window.ipc.on("update-clockwheel", (event, arg) => {
    console.dir(arg);
    var events = arg[0];
    var meta = arg[1];
    var outer = [];
    var inner = [];

    // Initialize inner array
    for (let i = 0; i < 720; i++) {
      inner[i] = {
        id: "0",
        label: "Default Rotation",
        color: "#ffffff",
        priority: -2,
      };
    }

    if (events.length > 0) {
      // Determine what the exact date/time is for the "12" (start of the doughnut chart) on the clock
      var topOfClock = moment
        .parseZone(meta.time)
        .startOf("day")
        .add(1, "days");
      if (moment.parseZone(meta.time).hours() < 12) {
        topOfClock = moment.parseZone(topOfClock).subtract(12, "hours");
      }

      // Determine number of minutes from current time to topOfClock
      var untilTopOfClock = moment(topOfClock).diff(
        moment(meta.time),
        "minutes"
      );

      // Populate inner ring array with events
      events
        .filter(
          (event) =>
            moment(event.end).isAfter(moment(meta.time), "minutes") &&
            moment(event.start).isSameOrBefore(
              moment.parseZone(meta.time).add(12, "hours"),
              "minutes"
            ) &&
            [
              "show",
              "remote",
              "sports",
              "prerecord",
              "playlist",
              "genre",
            ].indexOf(event.type) !== -1 &&
            ["canceled", "canceled-system", "canceled-updated"].indexOf(
              event.scheduleType
            ) === -1
        )
        .map((event) => {
          // Function for updating inner clockwheel minutes
          let updateClockwheel = (start, length) => {
            while (length > 0) {
              if (inner[start].priority < event.priority) {
                inner[start] = {
                  id: event.unique,
                  label: `${event.type}: ${event.hosts} - ${event.name}`,
                  color: event.color,
                  priority: event.priority,
                };
              }
              length--;
              start++;
              if (start >= 720) {
                start -= 720;
              }
            }
          };

          // If the event is in progress, length needs to be remaining time, not total time.
          if (
            moment(event.start).isSameOrBefore(moment(meta.time), "minutes")
          ) {
            let length = moment(event.end).diff(moment(meta.time), "minutes");

            let start = 720 - untilTopOfClock;
            if (start >= 720) {
              start -= 720;
            }

            updateClockwheel(start, length);
          } else {
            // Event is not yet in progress
            let length = moment(event.end).diff(moment(event.start), "minutes");
            let start =
              720 -
              untilTopOfClock +
              moment(event.start).diff(moment(meta.time), "minutes");

            // Correct length if it goes beyond 12 hours
            if (
              moment(event.end).isAfter(
                moment.parseZone(meta.time).add(12, "hours"),
                "minutes"
              )
            ) {
              var correction = moment(event.end).diff(
                moment.parseZone(meta.time).add(12, "hours"),
                "minutes"
              );
              length -= correction;
            }

            if (start >= 720) {
              start -= 720;
            }

            updateClockwheel(start, length);
          }
        });
    }

    // Now, begin updating clockwheel
    let clockwheelDonutData = {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [],
        },
        {
          data: [],
          backgroundColor: [],
        },
      ],
    };

    // Start with outer ring
    var currentSegment = {
      id: ``,
      minutes: 0,
      backgroundColor: `#000000`,
      label: `None`,
    };
    outer.map((segment) => {
      // If we have a new id at this minute, create a new segment
      if (segment.id !== currentSegment.id) {
        clockwheelDonutData.labels.push(currentSegment.label);
        clockwheelDonutData.datasets[0].data.push(currentSegment.minutes);
        clockwheelDonutData.datasets[0].backgroundColor.push(
          currentSegment.backgroundColor
        );
        clockwheelDonutData.datasets[1].data.push(0);
        clockwheelDonutData.datasets[1].backgroundColor.push(`#ffffff`);
        currentSegment = {
          id: segment.id,
          minutes: 1,
          backgroundColor: segment.color,
          label: segment.label,
        };
      } else {
        currentSegment.minutes++;
      }
    });
    // Push the last remaining segment into data
    clockwheelDonutData.labels.push(currentSegment.label);
    clockwheelDonutData.datasets[0].data.push(currentSegment.minutes);
    clockwheelDonutData.datasets[0].backgroundColor.push(
      currentSegment.backgroundColor
    );
    clockwheelDonutData.datasets[1].data.push(0);
    clockwheelDonutData.datasets[1].backgroundColor.push(`#ffffff`);

    // Now do the inner ring
    currentSegment = {
      id: ``,
      minutes: 0,
      backgroundColor: `#000000`,
      label: `None`,
    };
    inner.map((segment) => {
      // If we have a new id at this minute, create a new segment
      if (segment.id !== currentSegment.id) {
        clockwheelDonutData.labels.push(currentSegment.label);
        clockwheelDonutData.datasets[1].data.push(currentSegment.minutes);
        clockwheelDonutData.datasets[1].backgroundColor.push(
          currentSegment.backgroundColor
        );
        clockwheelDonutData.datasets[0].data.push(0);
        clockwheelDonutData.datasets[0].backgroundColor.push(`#ffffff`);
        currentSegment = {
          id: segment.id,
          minutes: 1,
          backgroundColor: segment.color,
          label: segment.label,
        };
      } else {
        currentSegment.minutes++;
      }
    });
    // Push the last remaining segment into data
    clockwheelDonutData.labels.push(currentSegment.label);
    clockwheelDonutData.datasets[1].data.push(currentSegment.minutes);
    clockwheelDonutData.datasets[1].backgroundColor.push(
      currentSegment.backgroundColor
    );
    clockwheelDonutData.datasets[0].data.push(0);
    clockwheelDonutData.datasets[0].backgroundColor.push(`#ffffff`);

    // Finally, send this data back to renderer
    window.ipc.renderer.send("update-clockwheel", [clockwheelDonutData]);
  });
});
