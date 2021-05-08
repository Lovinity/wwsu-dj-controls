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
			8000: "Thunderstorms",

			// Custom
			8100: "Light Thunderstorms",
			8101: "Heavy Thunderstorms"
		};

		// Map precipitation type to string
		this.precipitationTypeString = {
			0: "N/A",
			1: "Rain",
			2: "Snow",
			3: "Freezing Rain",
			4: "Ice Pellets"
		};

		// Map epaHealthConcern to string
		this.epaHealthConcernString = {
			0: "Good [-----]",
			1: "Moderate [+----]",
			2: "Unhealthy for Sensitive Groups [++---]",
			3: "Unhealthy [+++--]",
			4: "Very Unhealthy [++++-]",
			5: "Hazardous [+++++]"
		};

		this.chart;

		this.manager = manager;

		this.endpoints = {
			get: "/climacell/get"
		};
		this.data = {
			get: {}
		};

		this.assignSocketEvent("climacell", this.manager.socket);

		this.ncTimer;

		// Data operations
		super.on("insert", "WWSUclimacell", query => {
			clearTimeout(this.ncTimer);
			this.ncTimer = setTimeout(() => {
				this.updateClock();
				this.updateData();
				this.recalculateNowcast();
			}, 1000);
		});
		super.on("update", "WWSUclimacell", query => {
			clearTimeout(this.ncTimer);
			this.ncTimer = setTimeout(() => {
				this.updateClock();
				this.updateData();
				this.recalculateNowcast();
			}, 1000);
		});
		super.on("remove", "WWSUclimacell", query => {
			let record = this.find({ ID: query }, true);
			clearTimeout(this.ncTimer);
			this.ncTimer = setTimeout(() => {
				this.updateClock();
				this.updateData();
				this.recalculateNowcast();
			}, 1000);
		});
		super.on("replace", "WWSUclimacell", db => {
			clearTimeout(this.ncTimer);
			this.ncTimer = setTimeout(() => {
				this.updateClock();
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
	 * Initialize the donut for the 12-hour forecast
	 *
	 * @param {string} canvas DOM query string of the canvas to use for the donut.
	 */
	initClockForecast(canvas) {
		let chartCanvas = $(canvas)
			.get(0)
			.getContext("2d");

		this.chart = new Chart(chartCanvas, {
			type: "doughnut",
			data: {
				labels: ["Not Yet Loaded"],
				datasets: [
					{
						data: [720],
						backgroundColor: ["#000000"]
					}
				]
			},
			options: {
				maintainAspectRatio: false,
				responsive: true,
				cutoutPercentage: 80,
				legend: {
					display: false
				},
				animation: {
					animateRotate: false,
					animateScale: false
				},
				elements: {
					arc: {
						borderWidth: 0
					}
				}
			}
		});
	}

	/**
	 * Update the Donut 12-hour forecast
	 */
	updateClock() {
		this.manager.get("WWSUanimations").add("climacell-forecast-update", () => {
		let segments = [];

		// Initialize segments array
		for (let i = 0; i < 720; i++) {
			segments[i] = {};
		}

		let updateClockwheel = (weather, start, length) => {
			while (length > 0) {
				length--;
				start++;
				segments[start] = weather;
				if (start >= 720) {
					start -= 720;
				}
			}
		};

		// Determine what the exact date/time is for the "12" (start of the doughnut chart) on the clock
		let topOfClock = moment
			.parseZone(this.manager.get("WWSUMeta").meta.time)
			.startOf("day")
			.add(1, "days");
		if (moment.parseZone(this.manager.get("WWSUMeta").meta.time).hours() < 12) {
			topOfClock = moment.parseZone(topOfClock).subtract(12, "hours");
		}

		// Determine number of minutes from current time to topOfClock
		let untilTopOfClock = moment(topOfClock).diff(
			moment(this.manager.get("WWSUMeta").meta.time),
			"minutes"
		);

		// Function to determine what weather condition we will use (sometimes we modify what tomorrow.io uses)
		const modWeatherCode = (weatherCode, precipIntensity = 0) => {
			// Tomorrow.io does not have light/heavy thunderstorm designations. Determine based on precip intensity.
			if (weatherCode === 8000) {
				if (precipIntensity < 0.1) return 8100;
				if (precipIntensity > 0.5) return 8101;
			}

			// Mostly Clear = Clear
			if (weatherCode === 1100) return 1000;

			// Mostly Cloudy = Partly CLoudy
			if (weatherCode === 1102) return 1101;

			// Fog = Cloudy
			if (weatherCode === 2000 || weatherCode === 2100) return 1001;

			// Drizzle = Light Rain
			if (weatherCode === 4000) return 4200;

			// Flurries = Light Snow
			if (weatherCode === 5001) return 5100;

			// Freezing Drizzle = Light Ice Pellets
			if (weatherCode === 6000) return 7102;

			// Freezing Rain = Ice Pellets
			if (weatherCode === 6001) return 7000;

			// Light Freezing Rain = Light Ice Pellets
			if (weatherCode === 6200) return 7102;

			// Heavy Freezing Rain = Heavy Ice Pellets
			if (weatherCode === 6201) return 7101;

			// At this point, no modification. Return actual code.
			return weatherCode;
		};

		// Initialize variables for tracking when the weather changes
		let weatherCode = 0;
		let weatherData = {};
		let totalLength = 0;
		let startTime = moment();

		// Initialize the above with current conditions
		let currently = this.db({ dataClass: "current-0" }).first();
		if (currently) {
			startTime = currently.dataTime;
			weatherCode = modWeatherCode(
				currently.data.weatherCode,
				currently.data.precipitationIntensity
			);
		}

		// Now process every record sorted by dataTime
		let currentTime = this.manager.get("WWSUMeta").meta.time;
		let shortTerm = this.db()
			.get()
			.sort((a, b) => {
				if (!a.dataTime) return 1;
				if (!b.dataTime) return -1;
				if (moment(a.dataTime).isBefore(moment(b.dataTime))) return -1;
				if (moment(b.dataTime).isBefore(moment(a.dataTime))) return 1;
				return 0;
			})
			.map(record => {
				// Modify the weather code as necessary using our customized codes
				record.data.weatherCode = modWeatherCode(
					record.data.weatherCode,
					record.data.precipitationIntensity
				);

				// If the dataTime is before our current time...
				if (
					moment(record.dataTime).isSameOrBefore(moment(currentTime), "minutes")
				) {
					weatherCode = record.data.weatherCode;
					weatherData = record.data;
					startTime = currentTime;

					// If weatherCode changed, create a new segment on the chart
				} else if (weatherCode !== record.data.weatherCode) {
					// Calculate segment length and start
					let length = moment(record.dataTime).diff(startTime, "minutes");
					let start =
						720 -
						untilTopOfClock +
						moment(startTime).diff(currentTime, "minutes");

					// Correct length if it goes beyond 12 hours
					if (
						moment(record.dataTime).isAfter(
							moment.parseZone(currentTime).add(12, "hours"),
							"minutes"
						)
					) {
						let correction = moment(record.dataTime).diff(
							moment.parseZone(currentTime).add(12, "hours"),
							"minutes"
						);
						length -= correction;
					}

					if (start >= 720) {
						start -= 720;
					}

					// Add segment
					updateClockwheel(weatherData, start, length);

					// Update memory info
					startTime = record.dataTime;
					weatherCode = record.data.weatherCode;
					weatherData = record.data;
					totalLength += length;
				}
			});

		// Now, begin updating clockwheel
		let clockwheelDonutData = {
			labels: [],
			datasets: [
				{
					data: [],
					backgroundColor: []
				},
				{
					data: [],
					backgroundColor: []
				}
			]
		};

		// Process donut segments
		let currentSegment = { weatherCode: null, minutes: 0 };
		segments.map(segment => {
			// If we have a new id at this minute, create a new segment
			if (segment.weatherCode !== currentSegment.weatherCode) {
				clockwheelDonutData.labels.push(
					this.weatherCodeString[currentSegment.weatherCode]
				);
				clockwheelDonutData.datasets[0].data.push(currentSegment.minutes);
				clockwheelDonutData.datasets[0].backgroundColor.push("#00ff00");
				clockwheelDonutData.datasets[1].data.push(0);
				clockwheelDonutData.datasets[1].backgroundColor.push(`#ffffff`);
				currentSegment = Object.assign({ minutes: 1 }, segment);
			} else {
				currentSegment.minutes++;
			}
		});
		// Push the last remaining segment into data
		clockwheelDonutData.labels.push(
			this.weatherCodeString[currentSegment.weatherCode]
		);
		clockwheelDonutData.datasets[0].data.push(currentSegment.minutes);
		clockwheelDonutData.datasets[0].backgroundColor.push("#00ff00");
		clockwheelDonutData.datasets[1].data.push(0);
		clockwheelDonutData.datasets[1].backgroundColor.push(`#ffffff`);

		// Update the donut
		this.chart.data = clockwheelDonutData;
		this.chart.update();
		});
	}

	/**
	 * Refresh all data on DOM.
	 */
	updateData() {
		this.manager.get("WWSUanimations").add(`update-climacell`, () => {
			this.db()
				.get()
				.map(query => {
					for (let value in query.data) {
						if (!Object.prototype.hasOwnProperty.call(query.data, value))
							return;

						$(`.climacell-${query.dataClass}-${value}`).html(query.data[value]);
						if (value === "windDirection") {
							$(`.climacell-${query.dataClass}-${value}-card`).html(
								this.degToCard(parseInt(query.data[value]))
							);
						}
						if (value === "weatherCode") {
							$(`.climacell-${query.dataClass}-${value}-string`).html(
								this.weatherCodeString[query.data[value]]
							);
						}
						if (value === "precipitationType") {
							$(`.climacell-${query.dataClass}-${value}-string`).html(
								this.precipitationTypeString[query.data[value]]
							);
						}
						if (value === "epaHealthConcern") {
							$(`.climacell-${query.dataClass}-${value}-string`).html(
								this.epaHealthConcernString[query.data[value]]
							);
						}
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
			.filter(record => record.dataClass.startsWith("5m-"))
			.map(record => {
				let splits = record.dataClass.split("-");
				let ncNumber = parseInt(splits[1]);
				if (typeof precip[ncNumber] === "undefined") {
					precip[ncNumber] = { type: null, rate: null, time: null };
				}

				for (let value in record.data) {
					if (!Object.prototype.hasOwnProperty.call(record.data, value)) return;

					if (value === "precipitationType") {
						precip[ncNumber].type = record.data[value];
						precip[ncNumber].time = record.dataTime;
					}
					if (value === "precipitationIntensity") {
						precip[ncNumber].rate = record.data[value];
					}
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
		let precipExpected = precip.find(record => record.rate);
		let realtimePrecipType = this.db({
			dataClass: `current-0-precipitationType`
		}).first();
		let realtimePrecipIntensity = this.db({
			dataClass: `current-0-precipitationIntensity`
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
			let precipEnd = precip.find(record => !record.rate);
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
