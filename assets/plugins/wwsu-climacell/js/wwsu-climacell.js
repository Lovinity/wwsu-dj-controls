"use strict";

/**
 * This class manages climaCell weather data from the WWSU API.
 *
 * @requires $ jQuery
 * @requires WWSUdb WWSU TAFFYdb wrapper
 * @requires WWSUanimations WWSU animations management
 * @requires moment moment.js time/date library
 */

// REQUIRES these WWSUmodules: noReq (WWSUreq), WWSUMeta, WWSUanimations
class WWSUclimacell extends WWSUdb {
	/**
	 * The class constructor.
	 *
	 * @param {WWSUmodules} manager The modules class which initiated this module
	 * @param {object} options Options to be passed to this module
	 */
	constructor(manager, options) {
		super();

		// Map weather code to condition string
		this.weatherCodeString = {
			0: "Unknown",
			1000: "Clear",
			1001: "Cloudy",
			1100: "Mostly Clear",
			1101: "Partly Cloudy",
			1102: "Mostly Cloudy",
			2000: "Fog",
			2100: "Light Fog",
			3000: "Light Wind",
			3001: "Wind",
			3002: "Strong Wind",
			4000: "Drizzle",
			4001: "Rain",
			4200: "Light Rain",
			4201: "Heavy Rain",
			5000: "Snow",
			5001: "Flurries",
			5100: "Light Snow",
			5101: "Heavy Snow",
			6000: "Freezing Drizzle",
			6001: "Freezing Rain",
			6200: "Light Freezing Rain",
			6201: "Heavy Freezing Rain",
			7000: "Ice Pellets",
			7101: "Heavy Ice Pellets",
			7102: "Light Ice Pellets",
			8000: "Thunderstorm",
		};

		// Map precipitation type to string
		this.precipitationTypeString = {
			0: "N/A",
			1: "Rain",
			2: "Snow",
			3: "Freezing Rain",
			4: "Ice Pellets",
		};

		// Map epaHealthConcern to string
		this.epaHealthConcernString = {
			0: "Good [-----]",
			1: "Moderate [+----]",
			2: "Unhealthy for Sensitive Groups [++---]",
			3: "Unhealthy [+++--]",
			4: "Very Unhealthy [++++-]",
			5: "Hazardous [+++++]",
		};

		this.manager = manager;

		this.endpoints = {
			get: "/climacell/get",
		};
		this.data = {
			get: {},
		};

		this.assignSocketEvent("climacell", this.manager.socket);

		this.ncTimer;

		// Data operations
		super.on("insert", "WWSUclimacell", (query) => {
			clearTimeout(this.ncTimer);
			this.ncTimer = setTimeout(() => {
				this.updateData();
				this.recalculateNowcast();
			}, 1000);
		});
		super.on("update", "WWSUclimacell", (query) => {
			clearTimeout(this.ncTimer);
			this.ncTimer = setTimeout(() => {
				this.updateData();
				this.recalculateNowcast();
			}, 1000);
		});
		super.on("remove", "WWSUclimacell", (query) => {
			let record = this.find({ ID: query }, true);
			clearTimeout(this.ncTimer);
			this.ncTimer = setTimeout(() => {
				this.updateData();
				this.recalculateNowcast();
			}, 1000);
		});
		super.on("replace", "WWSUclimacell", (db) => {
			clearTimeout(this.ncTimer);
			this.ncTimer = setTimeout(() => {
				this.updateData();
				this.recalculateNowcast();
			}, 1000);
		});
	}

	// Initialize connection. Call this on socket connect event.
	init() {
		this.replaceData(
			this.manager.get("noReq"),
			this.endpoints.get,
			this.data.get
		);
	}

	/**
	 * Refresh all data on DOM.
	 */
	updateData() {
		this.manager.get("WWSUanimations").add(`update-climacell`, () => {
			this.db()
				.get()
				.map((query) => {
					$(`.climacell-${query.dataClass}`).html(query.data);
					if (query.dataClass.endsWith("windDirection")) {
						$(`.climacell-${query.dataClass}-card`).html(
							this.degToCard(query.data.split(" ")[0])
						);
					}
					if (query.dataClass.endsWith("weatherCode")) {
						$(`.climacell-${query.dataClass}-string`).html(
							this.weatherCodeString[query.data]
						);
					}
					if (query.dataClass.endsWith("precipitationType")) {
						$(`.climacell-${query.dataClass}-string`).html(
							this.precipitationTypeString[query.data]
						);
					}
					if (query.dataClass.endsWith("epaHealthConcern")) {
						$(`.climacell-${query.dataClass}-string`).html(
							this.epaHealthConcernString[query.data]
						);
					}
				});
		});
	}

	// Recalculate when precipitation is expected
	recalculateNowcast() {
		let precip = [];

		// Populate precip
		this.db()
			.get()
			.filter((record) => record.dataClass.startsWith("5m-"))
			.map((record) => {
				let splits = record.dataClass.split("-");
				let ncNumber = parseInt(splits[1]);
				if (typeof precip[ncNumber] === "undefined") {
					precip[ncNumber] = { type: null, rate: null, time: null };
				}

				if (record.dataClass.endsWith("precipitationType")) {
					precip[ncNumber].type = record.data;
					precip[ncNumber].time = record.dataTime;
				}
				if (record.dataClass.endsWith("precipitationIntensity")) {
					precip[ncNumber].rate = parseInt(record.data);
				}
			});

		// sort precip by observation time
		precip.sort((a, b) => {
			if (!a.time) return 1;
			if (!b.time) return -1;
			if (moment(a.time).isBefore(moment(b.time))) return -1;
			if (moment(b.time).isBefore(moment(a.time))) return 1;
			return 0;
		});

		// Figure out the next chance of precipitation, and update cards
		let precipExpected = precip.find((record) => record.rate);
		let realtimePrecipType = this.db({
			dataClass: `current-0-precipitationType`,
		}).first();
		let realtimePrecipIntensity = this.db({
			dataClass: `current-0-precipitationIntensity`,
		}).first();
		if (
			precipExpected &&
			(!realtimePrecipType ||
				!realtimePrecipType.data ||
				!realtimePrecipIntensity ||
				!realtimePrecipIntensity.data ||
				!parseInt(realtimePrecipIntensity.data))
		) {
			$(".climacell-nowcast-color").removeClass(`bg-gray`);
			$(".climacell-nowcast-color").removeClass(`bg-danger`);
			$(".climacell-nowcast-color").removeClass(`bg-success`);
			$(".climacell-nowcast-color").addClass(`bg-warning`);
			$(".climacell-nowcast-time").html(
				moment
					.tz(
						precipExpected.time,
						this.manager.get("WWSUMeta")
							? this.manager.get("WWSUMeta").meta.timezone
							: moment.tz.guess()
					)
					.format("h:mm A")
			);
			$(".climacell-nowcast-text").html(
				`${this.precipitationTypeString[precipExpected.type]} possible`
			);
		} else if (!precipExpected) {
			$(".climacell-nowcast-color").removeClass(`bg-gray`);
			$(".climacell-nowcast-color").removeClass(`bg-danger`);
			$(".climacell-nowcast-color").removeClass(`bg-warning`);
			$(".climacell-nowcast-color").addClass(`bg-success`);
			$(".climacell-nowcast-time").html(`None`);
			$(".climacell-nowcast-text").html(`No Precip Next 6 Hours`);
		} else {
			$(".climacell-nowcast-color").removeClass(`bg-gray`);
			$(".climacell-nowcast-color").removeClass(`bg-success`);
			$(".climacell-nowcast-color").removeClass(`bg-warning`);
			$(".climacell-nowcast-color").addClass(`bg-danger`);

			// Determine when the precip is expected to end
			let precipEnd = precip.find((record) => !record.rate);
			$(".climacell-nowcast-time").html(
				precipEnd
					? moment
							.tz(
								precipEnd.time,
								this.manager.get("WWSUMeta")
									? this.manager.get("WWSUMeta").meta.timezone
									: moment.tz.guess()
							)
							.format("h:mm A")
					: `Next >6 Hours`
			);
			$(".climacell-nowcast-text").html(
				`${
					realtimePrecipType
						? this.precipitationTypeString[realtimePrecipType.data] ||
						  `Unknown Precip`
						: `Unknown Precip`
				} ending`
			);
		}
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
