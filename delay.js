"use strict";

var port;
let statusCheck;

let encoder = new TextEncoder();
let decoder = new TextDecoder();

/**
 * Convert hexadecimal value to binary
 *
 * @param {string} hex Hex value
 * @returns {string} Binary value
 */
function hex2bin(hex) {
	return parseInt(hex, 16).toString(2).padStart(8, "0");
}

/**
 * Initialize a connection to the delay system serial port
 */
async function connectSerial() {
	if (port) return;
	try {
		// Get the delay system port we should connect to via Electron custom event in index.js
		// (Assigns to the global port variable via the main process)
		await window.ipc.getDelayPort();

		// Error if there is no port
		if (port === "" || !port)
			throw new Error(
				"A serial port was not selected. Please choose the delay system serial port under DJ Controls serial port settings."
			);

		port.addEventListener("disconnect", (event) => {
			window.ipc.renderer.console([
				"log",
				`Delay: ${port} DISCONNECTED! Re-connecting in 10 seconds...`,
			]);
			console.log(`${port} DISCONNECTED! Re-connecting in 10 seconds...`);
		});

		window.ipc.renderer.console(["log", `Delay: Connecting to serial port...`]);
		console.log(`Connecting to serial port...`);

		// Wait for the serial port to open.
		await port.open({ baudRate: 38400 });

		window.ipc.renderer.console(["log", `Delay: Serial port opened.`]);
		console.log(`Serial port opened.`);

		// Construct status checking interval every 15 seconds
		clearInterval(statusCheck);
		setInterval(async () => {
			requestStatus();
		}, 15000);

		// Add readable
		delayReadable();
	} catch (e) {
		window.ipc.renderer.console(["error", e]);
		console.error(e);
		setTimeout(() => {
			port = undefined;
			connectSerial().then(() => {
				// READY
				window.ipc.renderer.console(["log", "Delay: Process is ready"]);
				console.log(`Process is ready`);
				window.ipc.renderer.delayReady([]);
			});
		}, 10000);
	}
}

/**
 * Create a readable stream on the port object for the delay system; monitor for and report status when returned.
 */
async function delayReadable() {
	let delayData;
	let delayTimer;

	console.log(`Delay readable started`);

	while (port && port.readable) {
		const reader = port.readable.getReader();

		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) {
					break;
				}
				if (value) {
					delayData += uInt8ArrayToHexString(value);

					console.log(`Data received: ${uInt8ArrayToHexString(value)}`);
					window.ipc.renderer.console([
						"log",
						`Delay: data received... ${uInt8ArrayToHexString(value)}`,
					]);

					clearTimeout(delayTimer);
					delayTimer = setTimeout(() => {
						// Delay status
						if (delayData.includes("000c")) {
							let index = delayData.indexOf("000c");
							let seconds =
								parseInt(delayData.substring(index + 6, index + 8), 16) / 10;
							let bypass = hex2bin(delayData.substring(index + 16, index + 18));
							bypass = parseInt(bypass.substring(7, 8)) === 1;
							window.ipc.renderer.console("console", [
								"log",
								`Delay: There is ${seconds} seconds of delay, bypass = ${bypass}`,
							]);
							console.log(
								`There is ${seconds} seconds of delay, bypass = ${bypass}`
							);
							window.ipc.renderer.delay([seconds, bypass]);
						}
						delayData = ``;
					}, 1000);
				}
			}
			console.log(`No longer true for readable`);
		} catch (error) {
			window.ipc.renderer.console(["error", e]);
			console.error(e);
		} finally {
			reader.releaseLock();
		}
	}

	// If the loop was broken, assume the serial port was closed. This is an error, so wait 10 seconds and re-connect.

	try {
		await port.close();
	} catch (e) {}
	port = undefined;

	window.ipc.renderer.console([
		"error",
		new Error("Delay port was closed! Re-connecting in 10 seconds..."),
	]);
	console.error(
		new Error("Delay port was closed! Re-connecting in 10 seconds...")
	);

	setTimeout(() => {
		connectSerial().then(() => {
			// READY
			window.ipc.renderer.console(["log", "Delay: Process is ready"]);
			console.log(`Process is ready`);
			window.ipc.renderer.delayReady([]);
		});
	}, 10000);
}

/**
 * Send data to the delay system.
 *
 * @param {ArrayBuffer} data Data to send
 */
async function sendSerial(data) {
	console.log(`Sending ${data}`);
	window.ipc.renderer.console("console", ["log", `Delay: sending ${data}`]);

	console.dir(data);

	if (port && port.writable) {
		const writer = port.writable.getWriter();

		try {
			await writer.write(data);
			console.log(`Written`);
		} catch (e) {
			window.ipc.renderer.console([
				"error",
				new Error("Error sending data to delay system"),
			]);
			console.error(e);
		}

		writer.releaseLock();
	} else {
		window.ipc.renderer.console([
			"error",
			new Error("Error sending data to delay system (not writable)"),
		]);
		console.error(
			new Error("Error sending data to delay system (not writable)")
		);
	}
}

/**
 * Disconnect the current serial port.
 */
async function disconnectSerial() {
	if (port) await port.close();
	port = undefined;
}

/**
 * Request current delay system status
 */
async function requestStatus() {
	await sendSerial(new Uint8Array([0xFB, 0xFF, 0x00, 0x02, 0x11, 0xED]));
}

/**
 * Convert a hex string to an ArrayBuffer.
 *
 * @param {string} hexString - hex representation of bytes
 * @return {Uint8Array}
 */
function hexStringToUint8Array(hexString) {
	// remove the leading 0x
	hexString = hexString.replace(/^0x/, "");

	// ensure even number of characters
	if (hexString.length % 2 != 0) {
		console.log(
			"WARNING: expecting an even number of characters in the hexString"
		);
	}

	// check for some non-hex characters
	var bad = hexString.match(/[G-Z\s]/i);
	if (bad) {
		console.log("WARNING: found non-hex characters", bad);
	}

	// split the string into pairs of octets
	var pairs = hexString.match(/[\dA-F]{2}/gi);

	// convert the octets to integers
	var integers = pairs.map(function (s) {
		return parseInt(s, 16);
	});

	var array = new Uint8Array(integers);

	return array;
}

/**
 * Convert ArrayBuffer to hex string
 *
 * @param {Uint8Array} buffer The buffer to convert
 */
function uInt8ArrayToHexString(uint8) {
	return Buffer.from(uint8).toString("hex");
}

// Connect to the delay system immediately
connectSerial().then(() => {
	// READY
	window.ipc.renderer.console(["log", "Delay: Process is ready"]);
	console.log(`Process is ready`);
	window.ipc.renderer.delayReady([]);
});

// Request to dump
window.ipc.on.dump(() => {
	window.ipc.renderer.console(["log", "Delay: Received request to dump"]);
	console.log(`Received request to dump`);

	(async () => {
		// First, deactivate bypass if activated
		await sendSerial("FBFF000391006C");

		// Next, activate dump
		await sendSerial("FBFF0003900865");

		// Wait 250 milliseconds before continuing
		setTimeout(async () => {
			// Activate start button to re-build delay
			await sendSerial("FBFF000390026B");

			// Deactivate all buttons
			await sendSerial("FBFF000390006D");

			// Request status
			await requestStatus();
		}, 250);
	})();
});
