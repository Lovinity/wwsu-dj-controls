"use strict";
import path = require("path");
import { app, Menu, MenuItemConstructorOptions, shell } from "electron";
import {
	aboutMenuItem,
	appMenu,
	debugInfo,
	is,
	openNewGitHubIssue,
	openUrlMenuItem,
} from "electron-util";
import { config } from "./config";

const showPreferences = () => {
	// Show the app's preferences here
};

const helpSubmenu = [
	openUrlMenuItem({
		label: "Website",
		url: "https://github.com/Lovinity/wwsu-dj-controls",
	}),
	openUrlMenuItem({
		label: "Source Code",
		url: "https://github.com/Lovinity/wwsu-dj-controls",
	}),
	{
		label: "Report an Issue…",
		click() {
			const body = `
<!-- Below, please describe what you were doing leading up to the issue (steps to reproduce) -->

<!-- Below, please explain what you expected to happen -->

<!-- Below, please explain what actually happened, including relevant error messages -->

---
The following is auto-generated information about the app version you are using and the OS you are running.

${debugInfo()}`;

			openNewGitHubIssue({
				user: "Lovinity",
				repo: "wwsu-dj-controls",
				body,
			});
		},
	},
];

if (!is.macos) {
	helpSubmenu.push(
		{
			type: "separator",
		},
		aboutMenuItem({
			icon: path.join(__dirname, "static", "icon.png"),
			text: "Created by Patrick Schmalstig",
		})
	);
}

const debugSubmenu: Array<MenuItemConstructorOptions> = [
	{
		label: "Show Settings",
		click() {
			config.openInEditor();
		},
	},
	{
		label: "Show App Data",
		click() {
			shell.openPath(app.getPath("userData"));
		},
	},
	{
		type: "separator",
	},
	{
		label: "Delete Settings",
		click() {
			config.clear();
			app.relaunch();
			app.quit();
		},
	},
	{
		label: "Delete App Data",
		click() {
			shell.moveItemToTrash(app.getPath("userData"));
			app.relaunch();
			app.quit();
		},
	},
];

const macosTemplate: Array<MenuItemConstructorOptions> = [
	appMenu([
		{
			label: "Preferences…",
			accelerator: "Command+,",
			click() {
				showPreferences();
			},
		},
	]),
	{
		role: "fileMenu",
		submenu: [
			{
				label: "Custom",
			},
			{
				type: "separator",
			},
			{
				role: "close",
			},
		],
	},
	{
		role: "editMenu",
	},
	{
		role: "viewMenu",
	},
	{
		role: "windowMenu",
	},
	{
		role: "help",
		submenu: helpSubmenu,
	},
];

// Linux and Windows
const otherTemplate: Array<MenuItemConstructorOptions> = [
	{
		role: "fileMenu",
		submenu: [
			{
				label: "Custom",
			},
			{
				type: "separator",
			},
			{
				label: "Settings",
				accelerator: "Control+,",
				click() {
					showPreferences();
				},
			},
			{
				type: "separator",
			},
			{
				role: "quit",
			},
		],
	},
	{
		role: "editMenu",
	},
	{
		role: "viewMenu",
	},
	{
		role: "help",
		submenu: helpSubmenu,
	},
];

const template = process.platform === "darwin" ? macosTemplate : otherTemplate;

if (is.development) {
	template.push({
		label: "Debug",
		submenu: debugSubmenu,
	});
}

let menu: Menu = Menu.buildFromTemplate(template);

export { menu };
