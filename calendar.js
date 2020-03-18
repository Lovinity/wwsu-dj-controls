/* global moment */

var { ipcRenderer } = require('electron')

// Define hexrgb constants
var hexChars = 'a-f\\d'
var match3or4Hex = `#?[${hexChars}]{3}[${hexChars}]?`
var match6or8Hex = `#?[${hexChars}]{6}([${hexChars}]{2})?`

var nonHexChars = new RegExp(`[^#${hexChars}]`, 'gi')
var validHexSize = new RegExp(`^${match3or4Hex}$|^${match6or8Hex}$`, 'i')

var calendar = [] // Contains calendar events for the next 24 hours

var calendardb = new CalendarDb();

var clockwheel = {
  size: 140,
  smallSize: 70,
  start: 0, // angle to rotate pie chart by
  sectors: [], // start (angle from start), size (amount of angle to cover), label, color
  smallSectors: [],
  processed: { normal: [], small: [] }
}

var isRunning = false

ipcRenderer.send('main-log', `Calendar/Darksky: Renderer is ready.`)

function checkCalendar (meta, cal) {
  isRunning = true
  try {
    // Prepare the calendar variables

    // Erase the clockwheel
    clockwheel.sectors = []
    clockwheel.smallSectors = []
    clockwheel.processed = { normal: [], small: [] }

    // Declare empty temp variables for cal
    var calPriorityN = -2
    var calTypeN = ''
    var calHostN = ''
    var calShowN = ''
    var calTopicN = ``
    var calStartsN = null

    var events = calendardb.getEvents();

    calendar = []

    // Run through every event in memory, sorted by the comparison function, and add appropriate ones into our formatted calendar variable.
    if (events.length > 0) {
      cal.now = null
      events
        .filter(event => [ 'genre', 'playlist', 'onair-booking', 'prod-booking', 'office-hours', 'task' ].indexOf(event.type) === -1 && moment(event.end).isAfter(moment()))
        .map(event => {
          try {

            if ((meta.show === `${event.hosts} - ${event.name}` || (event.type === 'sports' && meta.show.startsWith(event.name))) && moment(event.end).isAfter(moment(meta.time))) { cal.now = `${event.hosts} - ${event.name}` }

            // Does this event start within the next 12 hours, and has not yet ended? Add it to our formatted array.
            if (moment(meta.time).add(12, 'hours').isAfter(moment(event.start)) && moment(meta.time).isBefore(moment(event.end))) {
              calendar.push(event)
            }

            // Sports broadcasts. Check for broadcasts scheduled to start within the next 5 minutes. Skip any scheduled to end in 10 minutes.
            if ([ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) === -1 && event.type === 'sports' && moment(meta.time).add(5, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(10, 'minutes').isAfter(moment(meta.time)) && calPriorityN < event.priority) {
              calPriorityN = event.priority
              calTypeN = 'Sports'
              calHostN = event.hosts
              calShowN = event.name
              calShowN = calShowN.split(' vs.')[ 0 ]
              calTopicN = truncateText(event.description, 256, `...`)
              calStartsN = event.start
            }

            // Remote broadcasts. Check for broadcasts scheduled to start within the next 10 minutes. Skip any scheduled to end in 10 minutes.
            if ([ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) === -1 && event.type === 'remote' && moment(meta.time).add(5, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(10, 'minutes').isAfter(moment(meta.time)) && calPriorityN < event.priority) {

              calPriorityN = event.priority
              calTypeN = 'Remote'
              calHostN = event.hosts
              calShowN = event.name
              calTopicN = truncateText(event.description, 256, `...`)
              calStartsN = event.start
            }

            // Radio shows. Check for broadcasts scheduled to start within the next 10 minutes. Skip any scheduled to end in 10 minutes.
            if ([ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) === -1 && event.type === 'show' && moment(meta.time).add(5, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(10, 'minutes').isAfter(moment(meta.time)) && calPriorityN < event.priority) {

              calPriorityN = event.priority
              calTypeN = 'Show'
              calHostN = event.hosts
              calShowN = event.name
              calTopicN = truncateText(event.description, 256, `...`)
              calStartsN = event.start
            }

            // Prerecords. Check for broadcasts scheduled to start within the next 5 minutes. Skip any scheduled to end in 10 minutes.
            if ([ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) === -1 && event.type === 'prerecord' && moment(meta.time).add(5, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(10, 'minutes').isAfter(moment(meta.time)) && calPriorityN < event.priority) {

              calPriorityN = event.priority
              calTypeN = 'Prerecord'
              calHostN = event.hosts
              calShowN = event.name
              calTopicN = truncateText(event.description, 256, `...`)
              calStartsN = event.start
            }

            // OnAir Studio Prerecord Bookings.
            if ([ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) === -1 && event.type === 'onair-bookings' && moment(meta.time).add(5, 'minutes').isAfter(moment(event.start)) && moment(event.end).isAfter(moment(meta.time)) && calPriorityN < -1) {
              calPriorityN = -1
              calTypeN = 'Booking'
              calHostN = event.hosts
              calShowN = event.name
              calStartsN = event.start
            }
          } catch (e) {
            isRunning = false
            console.error(e)
          }
        })
    }

    // Check for changes in determined upcoming scheduled event compared to what is stored in memory
    if (calTypeN !== cal.type || calHostN !== cal.host || calShowN !== cal.show || calStartsN !== cal.starts || calPriorityN !== cal.priority) {
      cal.notified = false
      cal.type = calTypeN
      cal.host = calHostN
      cal.show = calShowN
      cal.topic = calTopicN
      cal.starts = calStartsN
      cal.priority = calPriorityN
      cal.hint = false
      // Cancel any active tutorials
      /*
            if (trip)
            {
                trip.stop();
                trip = null;
            }
            */
    }

    // Display tutorials when shows are upcoming
    if ((meta.state.startsWith('automation_') || meta.state.startsWith('prerecord_')) && !cal.hint) {
      cal.hint = true
      /*
             if (calType === "Show")
             {
             setTimeout(function () {
             trip = new Trip([
             {
             sel: $("#btn-golive"),
             content: `Welcome, ${calHost}! To begin your show, click "Live". To skip the tutorial, click the x on this window.`,
             expose: true,
             position: "e",
             nextClickSelector: $("#btn-golive")
             },
             {
             sel: $("#go-live-modal"),
             content: `I filled in your DJ and show names automatically.<br />
             Write a show topic if you like, which will display on the website and display signs. <br />
             If desired, uncheck "enable website chat" to prevent others from messaging you.<br />
             <strong>Click "Go Live" when ready.</strong> This will start a countdown until you're live.`,
             expose: true,
             position: "n",
             nextClickSelector: $("#live-go")
             },
             {
             sel: $("#operations"),
             content: `This box will now show how much time until you are live (click anywhere inside to continue the tutorial, or x to stop the tutorial).<br />
             If you need more time, click +15-second PSA or +30-second PSA.<br />
             <strong>Show intros and other music queued after the IDs do not count in the queue countdown.</strong>`,
             expose: true,
             position: "s",
             nextClickSelector: $("#operations")
             }
             ], {delay: -1, showCloseBox: true, onTripClose: (tripIndex, tripObject) => {
             trip = null;
             console.log("trip closed");
             }});
             trip.start();
             }, 5000);
             }

             // Remote broadcasts
             if (calType === "Remote")
             {
             setTimeout(function () {
             trip = new Trip([
             {
             sel: $("#btn-goremote"),
             content: `Hello! To begin the scheduled remote broadcast ${calHost} - ${calShow}, click "Remote". To skip the tutorial, click the x on this window.`,
             expose: true,
             position: "e",
             nextClickSelector: $("#btn-goremote")
             },
             {
             sel: $("#go-remote-modal"),
             content: `I filled in your host and show names automatically.<br />
             Write a topic if you like, which will display on the website and display signs.<br />
             If desired, uncheck "enable website chat" to prevent others from messaging you.<br />
             Ensure your remote encoder is connected and streaming audio to the remote server, and then <strong>Click "Go Remote" when ready.</strong> This will start a countdown until you're live.`,
             expose: true,
             position: "n",
             nextClickSelector: $("#remote-go")
             },
             {
             sel: $("#operations"),
             content: `This box will now show how much time until your remote broadcast starts (click anywhere inside to continue the tutorial, or x to stop the tutorial).<br />
             If you need more time, click +15-second PSA or +30-second PSA.<br />
             <strong>Intros and other music queued after the IDs do not count in the queue countdown.</strong> A separate countdown will start after this one finishes so you know how much time is left in the intros / music.`,
             expose: true,
             position: "s",
             nextClickSelector: $("#operations")
             }
             ], {delay: -1, showCloseBox: true, onTripClose: (tripIndex, tripObject) => {
             trip = null;
             console.log("trip closed");
             }});
             trip.start();
             }, 5000);
             }

             // Sports broadcasts
             if (calType === "Sports")
             {
             setTimeout(function () {
             trip = new Trip([
             {
             sel: $("#btn-gosports"),
             content: `Hello! To begin the scheduled sports broadcast ${calShow}, click "Sports". To skip the tutorial, click the x on this window.`,
             expose: true,
             position: "e",
             nextClickSelector: $("#btn-gosports")
             },
             {
             sel: $("#go-sports-modal"),
             content: `I selected the scheduled sport automatically.<br />
             If desired, uncheck "enable website chat" to prevent others from messaging you.<br />
             If this broadcast is being done remotely (no OnAir Studio producer), check "Remote Sports Broadcast" and ensure you are streaming audio to the remote stream on the encoder before clicking Go Sports.<br />
             <strong>Click "Go Sports" when ready.</strong> This will start a countdown until you're live.`,
             expose: true,
             position: "n",
             nextClickSelector: $("#sports-go")
             },
             {
             sel: $("#operations"),
             content: `This box will now show how much time until your sports broadcast starts (click anywhere inside to continue the tutorial, or x to stop the tutorial).<br />
             If you need more time, click +15-second PSA or +30-second PSA.<br />
             <strong>Intros and other music queued after the IDs do not count in the queue countdown.</strong> A separate countdown will start after this one finishes so you know how much time is left in the intros / music.`,
             expose: true,
             position: "s",
             nextClickSelector: $("#operations")
             }
             ], {delay: -1, showCloseBox: true, onTripClose: (tripIndex, tripObject) => {
             trip = null;
             console.log("trip closed");
             }});
             trip.start();
             }, 5000);
             }
             */
    }

    // Clear current list of events
    // TODO: Make renderer handle this via a message sent from this worker
    // document.querySelector('#calendar-events').innerHTML = '';

    // Prepare some variables
    var timeLeft = 1000000
    var timeLeft2 = 1000000
    var doLabel = null
    var doColor = 0
    var currentStart = moment()
    var currentEnd = moment()
    var html = { events: ``, title: `` }

    // Add in our new list, and include in clockwheel
    if (calendar.length > 0) {
      calendar.map(event => {
        // If we are not doing a show, proceed with a 12-hour clockwheel and events list
        if (meta.state.startsWith('automation_') || meta.state.startsWith('prerecord_')) {
          var finalColor = (typeof event.color !== 'undefined' && /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(event.color)) ? hexRgb(event.color) : hexRgb('#787878')
          if ([ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) !== -1) { finalColor = hexRgb('#161616') }
          finalColor.red = Math.round(finalColor.red)
          finalColor.green = Math.round(finalColor.green)
          finalColor.blue = Math.round(finalColor.blue)
          html.events += ` <div class="m-1 bs-callout bs-callout-default shadow-2" style="border-color: rgb(${finalColor.red}, ${finalColor.green}, ${finalColor.blue}); background: rgb(${parseInt(finalColor.red / 2)}, ${parseInt(finalColor.green / 2)}, ${parseInt(finalColor.blue / 2)});">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(event.start).format('hh:mm A')} - ${moment(event.end).format('hh:mm A')}
                                            </div>
                                            <div class="col-8">
                                                ${event.hosts} - ${event.name}
                                                ${[ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) !== -1 ? `<br /><strong>CANCELED</strong>` : ``}
                                            </div>
                                        </div>
                                    </div></div>`
          // Add upcoming shows to the clockwheel shading
          if ([ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) === -1) {
            if ([ 'show', 'sports', 'prerecord', 'remote' ].indexOf(event.type) !== -1) {
              if (moment.utc(event.end).diff(moment.utc(meta.time), 'seconds') < (12 * 60 * 60)) {
                if (moment(event.start).isAfter(moment(meta.time))) {
                  clockwheel.sectors.push({
                    label: `${event.hosts} - ${event.name}`,
                    start: ((moment.utc(event.start).diff(moment.utc(meta.time), 'seconds') / (12 * 60 * 60)) * 360) + 0.5,
                    size: ((moment.utc(event.end).diff(moment.utc(event.start), 'seconds') / (12 * 60 * 60)) * 360) - 0.5,
                    color: event.color || '#787878'
                  })
                } else {
                  clockwheel.sectors.push({
                    label: `${event.hosts} - ${event.name}`,
                    start: 0.5,
                    size: ((moment.utc(event.end).diff(moment.utc(meta.time), 'seconds') / (12 * 60 * 60)) * 360) - 0.5,
                    color: event.color || '#787878'
                  })
                }
              } else if (moment.utc(event.start).diff(moment.utc(meta.time), 'seconds') < (12 * 60 * 60)) {
                if (moment(event.start).isAfter(moment(meta.time))) {
                  var start = ((moment.utc(event.start).diff(moment.utc(meta.time), 'seconds') / (12 * 60 * 60)) * 360)
                  clockwheel.sectors.push({
                    label: `${event.hosts} - ${event.name}`,
                    start: start + 0.5,
                    size: 360 - start,
                    color: event.color || '#787878'
                  })
                } else {
                  clockwheel.sectors.push({
                    label: `${event.hosts} - ${event.name}`,
                    start: 0,
                    size: 360,
                    color: event.color || '#787878'
                  })
                }
              }
            } else {
              if (moment.utc(event.end).diff(moment.utc(meta.time), 'seconds') < (12 * 60 * 60)) {
                if (moment(event.start).isAfter(moment(meta.time))) {
                  clockwheel.smallSectors.push({
                    label: `${event.hosts} - ${event.name}`,
                    start: ((moment.utc(event.start).diff(moment.utc(meta.time), 'seconds') / (12 * 60 * 60)) * 360) + 0.5,
                    size: ((moment.utc(event.end).diff(moment.utc(event.start), 'seconds') / (12 * 60 * 60)) * 360) - 0.5,
                    color: event.color || '#787878'
                  })
                } else {
                  clockwheel.smallSectors.push({
                    label: `${event.hosts} - ${event.name}`,
                    start: 0.5,
                    size: ((moment.utc(event.end).diff(moment.utc(meta.time), 'seconds') / (12 * 60 * 60)) * 360) - 0.5,
                    color: event.color || '#787878'
                  })
                }
              } else if (moment.utc(event.start).diff(moment.utc(meta.time), 'seconds') < (12 * 60 * 60)) {
                if (moment(event.start).isAfter(moment(meta.time))) {
                  start = ((moment.utc(event.start).diff(moment.utc(meta.time), 'seconds') / (12 * 60 * 60)) * 360)
                  clockwheel.smallSectors.push({
                    label: `${event.hosts} - ${event.name}`,
                    start: start + 0.5,
                    size: 360 - start,
                    color: event.color || '#787878'
                  })
                } else {
                  clockwheel.smallSectors.push({
                    label: `${event.hosts} - ${event.name}`,
                    start: 0,
                    size: 360,
                    color: event.color || '#787878'
                  })
                }
              }
            }
          }
          // If we are doing a show, do a 1-hour clockwheel
        } else {
          if ([ 'show', 'sports', 'remote' ].indexOf(event.type) !== -1 && [ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) === -1) {
            var stripped = `${event.hosts} - ${event.name}`;
            if (event.type === 'sports') { stripped = event.name.split(' vs.')[ 0 ] }
            // If the event we are processing is what is on the air right now, and the event has not yet ended...
            if (meta.show === stripped && moment(event.end).isAfter(moment(meta.time))) {
              // Calculate base remaining time
              timeLeft = moment.utc(event.end).diff(moment.utc(meta.time), 'minutes')
              // If there is less than 1 hour remaining in the show, only shade the clock for the portion of the hour remaining in the show
              if (moment.utc(event.end).diff(moment.utc(meta.time), 'minutes') < 60) {
                if (moment(event.start).isAfter(moment(meta.time))) {
                  doLabel = `${event.hosts} - ${event.name}`
                  doColor = event.color || '#787878'
                  currentStart = moment(event.start)
                  currentEnd = moment(event.end)
                } else {
                  var theSize = ((moment.utc(event.end).diff(moment.utc(meta.time), 'seconds') / (60 * 60)) * 360)
                  doLabel = `${event.hosts} - ${event.name}`
                  doColor = event.color || '#787878'
                  currentStart = moment(event.start)
                  currentEnd = moment(event.end)
                }
                // Otherwise, shade the entire hour, if the event has already started via the scheduled start time
              } else if (moment(event.start).isBefore(moment(meta.time))) {
                doLabel = `${event.hosts} - ${event.name}`
                doColor = event.color || '#787878'
                currentStart = moment(event.start)
                currentEnd = moment(event.end)
              }
              // If the event being process is not what is live, but the end time is after the current time...
            } else if (moment(event.end).isAfter(moment(meta.time))) {
              // Do a check to see if this event will intercept the currently live event
              timeLeft2 = moment.utc(event.start).diff(moment.utc(meta.time), 'minutes')
              if (timeLeft2 < 0) { timeLeft2 = 0 }
              // If timeLeft2 is less than timeleft, that means the currently live show needs to end earlier than the scheduled time.
              if (timeLeft2 < timeLeft) {
                timeLeft = timeLeft2
                currentEnd = moment(event.start)
                if (moment(currentEnd).isBefore(moment(meta.time))) {
                  currentEnd = moment(meta.time)
                  timeLeft = 0
                }
              }
              if (timeLeft < 0) { timeLeft = 0 }
              // If the event being processed starts in less than 1 hour, add it to the hour clockwheel as a black shaded event
              if (event.active > 0) {
                if (moment.utc(event.start).diff(moment.utc(meta.time), 'minutes') < 60) {
                  if (moment(event.start).isAfter(moment(meta.time))) {
                    var theStart = ((moment.utc(event.start).diff(moment.utc(meta.time), 'seconds') / (60 * 60)) * 360)
                    theSize = ((moment.utc(event.end).diff(moment.utc(event.start), 'seconds') / (60 * 60)) * 360)
                    if ((theSize + theStart) > 360) { theSize = 360 - theStart }
                    clockwheel.sectors.push({
                      label: `${event.hosts} - ${event.name}`,
                      start: theStart,
                      size: theSize,
                      color: '#000000'
                    })
                  } else {
                    clockwheel.sectors.push({
                      label: `${event.hosts} - ${event.name}`,
                      start: 0,
                      size: ((moment.utc(event.end).diff(moment.utc(meta.time), 'seconds') / (60 * 60)) * 360),
                      color: '#000000'
                    })
                  }
                }
              }
            }
          }
          // Add the event to the list on the right of the clock
          if (moment(meta.time).add(1, 'hours').isAfter(moment(event.start)) && moment(meta.time).isBefore(moment(event.end))) {
            finalColor = (typeof event.color !== 'undefined' && /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(event.color)) ? hexRgb(event.color) : hexRgb('#787878')
            if ([ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) !== -1) { finalColor = hexRgb('#161616') }
            finalColor.red = Math.round(finalColor.red)
            finalColor.green = Math.round(finalColor.green)
            finalColor.blue = Math.round(finalColor.blue)
            stripped = `${event.hosts} - ${event.name}`
            if (event.type === 'sports') { stripped = event.name.split(" vs.")[ 0 ] }
            if (meta.show !== stripped) {
              html.events += `  <div class="m-1 bs-callout bs-callout-default shadow-2" style="border-color: rgb(${finalColor.red}, ${finalColor.green}, ${finalColor.blue}); background: rgb(${parseInt(finalColor.red / 2)}, ${parseInt(finalColor.green / 2)}, ${parseInt(finalColor.blue / 2)});">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(event.start).format('hh:mm A')} - ${moment(event.end).format('hh:mm A')}
                                            </div>
                                            <div class="col-8">
                                                ${event.hosts} - ${event.name}
                                                ${[ 'canceled', 'canceled-system', 'canceled-changed' ].indexOf(event.scheduleType) !== -1 ? `<strong>CANCELED</strong>` : ``}
                                            </div>
                                        </div>
                                    </div></div>`
            }
          }
        }
      })
    }

    // In automation, shade the clock in 12-hour format for upcoming shows
    if (meta.state.startsWith('automation_') || meta.state.startsWith('prerecord_')) {
      html.title = 'Clockwheel (next 12 hours)'
      var start = moment(meta.time).startOf('day')
      if (moment(meta.time).hour() >= 12) { start.add(12, 'hours') }
      var diff = moment.utc(meta.time).diff(moment.utc(start), 'seconds')
      clockwheel.start = (360 / 12 / 60 / 60) * diff

      // Show an indicator on the clock for the current hour (extra visual to show 12-hour clock mode)
      clockwheel.sectors.push({
        label: 'current hour',
        start: -1,
        size: 2,
        color: '#000000'
      })

      // During shows, use a 1-hour clockwheel
    } else {
      html.title = 'Clockwheel (next hour)'
      start = moment(meta.time).startOf('hour')
      diff = moment.utc(meta.time).diff(moment.utc(start), 'seconds')
      clockwheel.start = (360 / 60 / 60) * diff

      if (meta.queueFinish !== null) {
        html.events = `  <div class="m-1 bs-callout bs-callout-default shadow-2">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(meta.queueFinish).format('hh:mm:ss A')}
                                            </div>
                                            <div class="col-8">
                                                RadioDJ Queue
                                            </div>
                                        </div>
                                    </div></div>` + html.events
      }

      if (doLabel !== null) {
        var doTopOfHour = false
        if (!moment(meta.lastID).add(10, 'minutes').startOf('hour').isSame(moment(meta.time).startOf('hour')) && moment(meta.time).diff(moment(meta.time).startOf('hour'), 'minutes') < 10) {
          var topOfHour = moment(meta.time).startOf('hour')
          // This happens when the DJ has not yet taken their top of the hour break; keep the time in the events list the same until they take the break.
          if (moment(currentEnd).subtract(10, 'minutes').isAfter(moment(topOfHour))) {
            doTopOfHour = true
            html.events = `  <div class="m-1 bs-callout bs-callout-warning shadow-2">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(topOfHour).format('hh:mm A')}
                                            </div>
                                            <div class="col-8">
                                                Mandatory Top-of-Hour Break
                                            </div>
                                        </div>
                                    </div></div>` + html.events
          }
        } else {
          topOfHour = moment(meta.time).add(1, 'hours').startOf('hour')
          // If the DJ is expected to do a top of the hour break at the next top of hour, show so on the clock and in the events list
          if (moment(currentEnd).subtract(10, 'minutes').isAfter(moment(topOfHour))) {
            doTopOfHour = true
            html.events = `  <div class="m-1 bs-callout bs-callout-warning shadow-2">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(topOfHour).format('hh:mm A')}
                                            </div>
                                            <div class="col-8">
                                                Mandatory Top-of-Hour Break
                                            </div>
                                        </div>
                                    </div></div>` + html.events
          }
        }

        // First in the list of events, show the current show and how much time remains based on the schedule and whether or not something else will mandate this show
        // ends early.
        var finalColor = (typeof doColor !== 'undefined' && /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(doColor)) ? hexRgb(doColor) : hexRgb('#787878')
        finalColor.red = Math.round(finalColor.red)
        finalColor.green = Math.round(finalColor.green)
        finalColor.blue = Math.round(finalColor.blue)
        html.events = `  <div class="m-1 bs-callout bs-callout-default shadow-2" style="border-color: rgb(${finalColor.red}, ${finalColor.green}, ${finalColor.blue}); background: rgb(${parseInt(finalColor.red / 2)}, ${parseInt(finalColor.green / 2)}, ${parseInt(finalColor.blue / 2)});">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment.duration(moment(currentEnd).diff(moment(meta.time), 'minutes'), 'minutes').format('h [hrs], m [mins]')} Left
                                            </div>
                                            <div class="col-8">
                                                ${doLabel}
                                            </div>
                                        </div>
                                    </div></div>` + html.events
        if (moment.utc(currentEnd).diff(moment.utc(meta.time), 'minutes') < 60) {
          if (moment(currentStart).isAfter(moment(meta.time))) {
            var theStart = ((moment.utc(currentStart).diff(moment.utc(meta.time), 'seconds') / (60 * 60)) * 360)
            var theSize = ((moment.utc(currentEnd).diff(moment.utc(currentStart), 'seconds') / (60 * 60)) * 360)
            clockwheel.sectors.push({
              label: doLabel,
              start: theStart,
              size: theSize,
              color: doColor
            })
          } else {
            theSize = ((moment.utc(currentEnd).diff(moment.utc(meta.time), 'seconds') / (60 * 60)) * 360)
            clockwheel.sectors.push({
              label: doLabel,
              start: 0,
              size: theSize,
              color: doColor
            })
          }
        } else if (moment.utc(currentStart).isBefore(moment.utc(meta.time))) {
          clockwheel.sectors.push({
            label: doLabel,
            start: 0,
            size: 360,
            color: doColor
          })
        } else {
          theStart = ((moment.utc(currentStart).diff(moment.utc(meta.time), 'seconds') / (60 * 60)) * 360)
          if (theStart < 360) {
            clockwheel.sectors.push({
              label: doLabel,
              start: theStart,
              size: 360 - theStart,
              color: doColor
            })
          }
        }

        // Then, shade the top of hour ID break on the clock if required
        if (doTopOfHour) {
          if (moment(meta.lastID).add(10, 'minutes').startOf('hour') !== moment(meta.time).startOf('hour') && moment.utc(meta.time).diff(moment.utc(meta.time).startOf('hour'), 'minutes') < 5) {
            start = moment(meta.time).startOf('hour').subtract(5, 'minutes')
            diff = moment.utc(meta.time).diff(moment.utc(start), 'seconds')
            clockwheel.sectors.push({
              label: 'current minute',
              start: 360 - (diff * (360 / 60 / 60)),
              size: 60,
              color: '#FFEB3B'
            })
          } else {
            start = moment(meta.time).add(1, 'hours').startOf('hour').subtract(5, 'minutes')
            diff = moment.utc(start).diff(moment.utc(meta.time), 'seconds')
            clockwheel.sectors.push({
              label: 'current minute',
              start: ((360 / 60 / 60) * diff),
              size: 60,
              color: '#FFEB3B'
            })
          }
        }
      }

      // Finally, show an indicator on the clock for the current minute (extra visual to show 1-hour clock mode)
      clockwheel.sectors.push({
        label: 'current minute',
        start: 0,
        size: 2,
        color: '#000000'
      })

      // Shade in queue time on the clockwheel
      if (meta.queueFinish !== null) {
        diff = moment(meta.queueFinish).diff(moment(meta.time), 'seconds')

        if (diff < (60 * 60)) {
          clockwheel.sectors.push({
            label: 'queue time',
            start: 0,
            size: diff * 0.1,
            color: '#0000ff'
          })
        } else {
          clockwheel.sectors.push({
            label: 'queue time',
            start: 0,
            size: 360,
            color: '#0000ff'
          })
        }
      }
    }

    clockwheel.processed = calculateSectors(clockwheel)

    isRunning = false
    var response = { events: html.events, title: html.title, clockwheel: clockwheel, cal: cal }
    ipcRenderer.send('processed-calendar', [ response, events ])
  } catch (e) {
    isRunning = false
    console.error(e)
  }
}

function calculateSectors (data) {
  var sectors = []
  var smallSectors = []

  var l = data.size / 2
  var l2 = data.smallSize / 2
  var a = 0 // Angle
  var aRad = 0 // Angle in Rad
  var z = 0 // Size z
  var x = 0 // Side x
  var y = 0 // Side y
  var X = 0 // SVG X coordinate
  var Y = 0 // SVG Y coordinate
  var aCalc
  var arcSweep

  data.sectors.map(function (item2) {
    var doIt = function (item) {
      a = item.size
      if ((item.start + item.size) > 360) { a = 360 - item.start }
      aCalc = (a > 180) ? 180 : a
      aRad = aCalc * Math.PI / 180
      z = Math.sqrt(2 * l * l - (2 * l * l * Math.cos(aRad)))
      if (aCalc <= 90) {
        x = l * Math.sin(aRad)
      } else {
        x = l * Math.sin((180 - aCalc) * Math.PI / 180)
      }

      y = Math.sqrt(z * z - x * x)
      Y = y

      if (a <= 180) {
        X = l + x
        arcSweep = 0
      } else {
        X = l - x
        arcSweep = 1
      }

      sectors.push({
        label: item.label,
        color: item.color,
        arcSweep: arcSweep,
        L: l,
        X: X,
        Y: Y,
        R: item.start
      })

      if (a > 180) {
        var temp = {
          label: item.label,
          size: 180 - (360 - a),
          start: 180 + item.start,
          color: item.color
        }
        doIt(temp)
      }
    }

    doIt(item2)
  })

  data.smallSectors.map(function (item2) {
    var doIt2 = function (item) {
      a = item.size
      if ((item.start + item.size) > 360) { a = 360 - item.start }
      aCalc = (a > 180) ? 180 : a
      aRad = aCalc * Math.PI / 180
      z = Math.sqrt(2 * l2 * l2 - (2 * l2 * l2 * Math.cos(aRad)))
      if (aCalc <= 90) {
        x = l2 * Math.sin(aRad)
      } else {
        x = l2 * Math.sin((180 - aCalc) * Math.PI / 180)
      }

      y = Math.sqrt(z * z - x * x)
      Y = y

      if (a <= 180) {
        X = l2 + x
        arcSweep = 0
      } else {
        X = l2 - x
        arcSweep = 1
      }

      smallSectors.push({
        label: item.label,
        color: item.color,
        arcSweep: arcSweep,
        L: l2,
        X: X,
        Y: Y,
        R: item.start
      })

      if (a > 180) {
        var temp = {
          label: item.label,
          size: 180 - (360 - a),
          start: 180 + item.start,
          color: item.color
        }
        doIt2(temp)
      }
    }

    doIt2(item2)
  })

  return { normal: sectors, small: smallSectors }
}

function hexRgb (hex, options = {}) {
  try {
    if (typeof hex !== 'string' || nonHexChars.test(hex) || !validHexSize.test(hex)) {
      throw new TypeError('Expected a valid hex string')
    }

    hex = hex.replace(/^#/, '')
    let alpha = 255

    if (hex.length === 8) {
      alpha = parseInt(hex.slice(6, 8), 16) / 255
      hex = hex.substring(0, 6)
    }

    if (hex.length === 4) {
      alpha = parseInt(hex.slice(3, 4).repeat(2), 16) / 255
      hex = hex.substring(0, 3)
    }

    if (hex.length === 3) {
      hex = hex[ 0 ] + hex[ 0 ] + hex[ 1 ] + hex[ 1 ] + hex[ 2 ] + hex[ 2 ]
    }

    const num = parseInt(hex, 16)
    const red = num >> 16
    const green = (num >> 8) & 255
    const blue = num & 255

    return options.format === 'array'
      ? [ red, green, blue, alpha ]
      : { red, green, blue, alpha }
  } catch (e) {
    isRunning = false
    console.error(e)
  }
}

ipcRenderer.on('process-calendar', (event, arg) => {
  if (arg[ 0 ] === 'calendar' || arg[ 0 ] === 'schedule')
    calendardb.query(arg[ 0 ], arg[ 1 ], arg[ 2 ])
  checkCalendar(arg[ 3 ], arg[ 4 ])
})

ipcRenderer.on('process-darksky', (event, arg) => {
  processDarksky(arg[ 0 ], arg[ 1 ])
})

function truncateText (str, strLength = 256, ending = `...`) {
  if (str === null) return '';
  if (str.length > strLength) {
    return str.substring(0, strLength - ending.length) + ending
  } else {
    return str
  }
}

function processDarksky (db, time) {
  db.map((item) => {
    try {
      var precipStart = 61
      var precipEnd = 61
      var precipType = `precipitation`

      var currentWeather = ``
      var weatherMessages = ``

      // Current conditions
      currentWeather = `
            <i style="font-size: 48px;"class="fas ${getConditionIcon(item.currently.icon)}"></i> ${item.currently.temperature}°F`

      // Determine when precipitation is going to fall

      item.minutely.data.map((data, index) => {
        if (data.precipType && data.precipProbability >= 0.3) {
          if (precipStart > index) {
            precipStart = index
            precipType = data.precipType
          }
        } else {
          if (precipEnd > index) { precipEnd = index }
        }
      })

      if (item.currently.precipType) {
        if (precipStart === 0 && precipEnd >= 59) {
          weatherMessages += `<i style="font-size: 16px;"class="fas fa-umbrella"></i> ${item.currently.precipType || `precipitation`} falling; ${item.currently.precipIntensity} fluid inches per hour.<br />`
        } else if (precipStart === 0) {
          weatherMessages += `<i style="font-size: 16px;"class="fas fa-umbrella"></i> ${item.currently.precipType || `precipitation`} falling; ${item.currently.precipIntensity} fluid inches per hour; ending at ${moment(time).add(precipEnd, 'minutes').format('h:mmA')}.<br />`
        } else if (precipStart < 61) {
          weatherMessages += `<i style="font-size: 16px;"class="fas fa-umbrella"></i> ${item.currently.precipType || `precipitation`} is possible starting at ${moment(time).add(precipStart, 'minutes').format('h:mmA')}.<br />`
        }
      } else {
        if (precipStart < 61) {
          weatherMessages += `<i style="font-size: 16px;"class="fas fa-umbrella"></i> ${precipType || `precipitation`} is possible starting at ${moment(time).add(precipStart, 'minutes').format('h:mmA')}.<br />`
        }
      }

      // Is it windy?
      if (item.currently.windSpeed >= 73 || item.currently.windGust >= 73) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-wind"></i> <strong>Destructive winds!</strong> ${item.currently.windSpeed}mph, gusts to ${item.currently.windGust}mph.<br />`
      } else if (item.currently.windSpeed >= 55 || item.currently.windGust >= 55) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-wind"></i> <strong>Gale force winds!</strong> ${item.currently.windSpeed}mph, gusts to ${item.currently.windGust}mph.<br />`
      } else if (item.currently.windSpeed >= 39 || item.currently.windGust >= 39) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-wind"></i> Windy! ${item.currently.windSpeed}mph, gusts to ${item.currently.windGust}mph.<br />`
      } else if (item.currently.windSpeed >= 25 || item.currently.windGust >= 25) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-wind"></i> Breezy. ${item.currently.windSpeed}mph, gusts to ${item.currently.windGust}mph.<br />`
      }

      // UV index
      if (item.currently.uvIndex > 10) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-sun"></i> <strong>Extreme UV Index!</strong><br />`
      } else if (item.currently.uvIndex >= 8) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-sun"></i> <strong>Severe UV Index!</strong><br />`
      } else if (item.currently.uvIndex >= 6) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-sun"></i> High UV Index!<br />`
      }

      // Visibility
      if (item.currently.visibility <= 0.25) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-car"></i> <strong>Dangerous Visibility!</strong> ${item.currently.visibility} miles.<br />`
      } else if (item.currently.visibility <= 1) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-car"></i> <strong>Very low Visibility!</strong> ${item.currently.visibility} miles.<br />`
      } else if (item.currently.visibility <= 3) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-car"></i> Low Visibility. ${item.currently.visibility} miles.<br />`
      }

      // Apparent temperature, cold
      if (item.currently.apparentTemperature <= -35) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-temperature-low"></i> <strong>Dangerous Wind Chill!</strong> ${item.currently.apparentTemperature}°F<br />`
      } else if (item.currently.apparentTemperature <= -20) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-temperature-low"></i> <strong>Very Low Wind Chill!</strong> ${item.currently.apparentTemperature}°F<br />`
      } else if (item.currently.apparentTemperature <= -5) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-temperature-low"></i> Low Wind Chill. ${item.currently.apparentTemperature}°F<br />`
      }

      // Apparent temperature, hot
      if (item.currently.apparentTemperature >= 120) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-temperature-high"></i> <strong>Dangerous Heat Index!</strong> ${item.currently.apparentTemperature}°F<br />`
      } else if (item.currently.apparentTemperature >= 110) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-temperature-high"></i> <strong>Very High Index!</strong> ${item.currently.apparentTemperature}°F<br />`
      } else if (item.currently.apparentTemperature >= 100) {
        weatherMessages += `<i style="font-size: 16px;"class="fas fa-temperature-high"></i> High Heat Index. ${item.currently.apparentTemperature}°F<br />`
      }

      ipcRenderer.send('processed-darksky', [ currentWeather, weatherMessages ])
    } catch (e) {
      console.error(e)
    }
  })
};

function getConditionIcon (condition) {
  switch (condition) {
    case 'clear-day':
      return 'fa-sun'
    case 'clear-night':
      return 'fa-moon'
    case 'rain':
      return 'fa-cloud-showers-heavy'
    case 'snow':
      return 'fa-snowflake'
    case 'sleet':
      return 'fa-cloud-meatball'
    case 'wind':
      return 'fa-wind'
    case 'fog':
      return 'fa-smog'
    case 'cloudy':
      return 'fa-cloud'
    case 'partly-cloudy-day':
      return 'fa-cloud-sun'
    case 'partly-cloudy-night':
      return 'fa-cloud-moon'
    case 'thunderstorm':
      return 'fa-bolt'
    case 'showers-day':
      return 'fa-cloud-sun-rain'
    case 'showers-night':
      return 'fa-cloud-moon-rain'
    default:
      return 'fa-rainbow'
  }
}
