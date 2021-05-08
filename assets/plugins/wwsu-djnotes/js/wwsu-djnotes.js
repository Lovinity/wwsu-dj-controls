"use strict";

/* global WWSUdb */

// This class manages DJ notes from WWSU.

class WWSUdjnotes extends WWSUdb {
	/**
	 * Construct the class
	 *
	 * @param {WWSUmodules} manager The modules class which initiated this module
	 * @param {object} options Options to be passed to this module
	 */
	constructor(manager, options) {
		super(); // Create the db

		this.manager = manager;

		this.endpoints = {
			get: "/djnotes/get",
			add: "/djnotes/add",
			edit: "/djnotes/edit",
			remove: "/djnotes/remove"
		};
		this.data = {
			get: {}
		};

		this.assignSocketEvent("djnotes", this.manager.socket);
	}

	// Initialize connection. Call this on socket connect event.
	init() {
		this.replaceData(
			this.manager.get("hostReq"),
			this.endpoints.get,
			this.data.get
		);
	}
}
