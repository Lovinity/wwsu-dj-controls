/**
 * This class manages climaCell weather data from the WWSU API.
 * NOTE: This class uses this.events for events outside the class, and WWSUdb events for internal operations.
 *
 * @requires $ jQuery
 * @requires WWSUdb WWSU TAFFYdb wrapper
 */
class WWSUclimacell extends WWSUdb {
  /**
   * The class constructor.
   *
   * @param {sails.io} socket The sails.io socket connected to the WWSU API.
   * @param {WWSUreq} hostReq Request with no authorization
   */
  constructor(socket, noReq) {
    super();

    this.endpoints = {
      get: "/climacell/get",
    };
    this.data = {
      get: {},
    };
    this.requests = {
      no: noReq,
    };

    this.assignSocketEvent("climacell", socket);

    this.events = new EventEmitter();

    this.animations = new WWSUanimations();

    // Data operations
    super.on("insert", (query) => {
      this.updateData(query);
    });
    super.on("update", (query) => {
      this.updateData(query);
    });
    super.on("remove", (query) => {
      var record = this.find({ ID: query }, true);
      if (record) {
        this.updateData({ dataClass: record.dataClass, data: `???` });
      }
    });
    super.on("replace", (db) => {
      db.get().forEach((record) => {
        this.updateData(record);
      });
    });
  }

  // Initialize connection. Call this on socket connect event.
  init() {
    this.replaceData(this.requests.no, this.endpoints.get, this.data.get);
  }

  /**
   * Add an event listener.
   *
   * @param {string} event Event triggered: insert(data, db), update(data, db), remove(data, db), or replace(db)
   * @param {function} fn Function to call when this event is triggered
   */
  on(event, fn) {
    this.events.on(event, fn);
  }

  /**
   * Update a piece of text data by div class.
   *
   * @param {object} query climacell weather record that contains at least dataClass and data.
   */
  updateData(query) {
    this.animations.add(`update-climacell-${query.dataClass}`, () => {
      $(`.climacell-${query.dataClass}`).html(query.data);
      if (query.dataClass === "realtime-wind-direction") {
        $(`.climacell-realtime-wind-direction-code`).html(
          this.degToCard(query.data.split(" ")[0])
        );
      }
    });
  }

  /**
   * Utility function to convert wind direction degrees to cardinal direction.
   *
   * @param {number} d Degrees
   * @returns {string} cardinal direction
   */
  degToCard(d) {
    if (11.25 <= d && d < 33.75) {
      return "NNE";
    } else if (33.75 <= d && d < 56.25) {
      return "NE";
    } else if (56.25 <= d && d < 78.75) {
      return "ENE";
    } else if (78.75 <= d && d < 101.25) {
      return "E";
    } else if (101.25 <= d && d < 123.75) {
      return "ESE";
    } else if (123.75 <= d && d < 146.25) {
      return "SE";
    } else if (146.25 <= d && d < 168.75) {
      return "SSE";
    } else if (168.75 <= d && d < 191.25) {
      return "S";
    } else if (191.25 <= d && d < 213.75) {
      return "SSW";
    } else if (213.75 <= d && d < 236.25) {
      return "SW";
    } else if (236.25 <= d && d < 258.75) {
      return "WSW";
    } else if (258.75 <= d && d < 281.25) {
      return "W";
    } else if (281.25 <= d && d < 303.75) {
      return "WNW";
    } else if (303.75 <= d && d < 326.25) {
      return "NW";
    } else if (326.25 <= d && d < 348.75) {
      return "NNW";
    } else {
      return "N";
    }
  }
}
