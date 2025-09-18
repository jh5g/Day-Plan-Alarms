import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as path from "path";
import * as fs from "fs";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	 alarmFile: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	alarmFile: "mixkit-vintage-warning-alarm-990.wav"
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	private currentAlarm: HTMLAudioElement | null = null;
	public scheduledAlarms: { timeoutId: ReturnType<typeof setTimeout>, timeStr: string }[] = [];

	async onload() {
		await this.loadSettings();
        this.addSettingTab(new DayPlanAlarmsSettingsTab(this.app, this));
        this.addCommand({
            id: "schedule-alarms",
            name: "Schedule alarms in Active Note",
			callback: () => this.scheduleAlarms(),
		});
		console.log('Added Command Schedule Alarms in Active Note');
	}

	onunload() {
        console.log("Unloading Alarm Plugin");
	}
	async scheduleAlarms() {
		// Cancel all existing alarms before scheduling new ones
		this.cancelAllAlarms();
		const file = this.app.workspace.getActiveFile();
		if (!file) return;

		const content = await this.app.vault.read(file);

		// Step 1: Extract times from the markdown
		const times = this.extractTimes(content);

		// Step 2: Schedule alarms
		times.forEach((time) => this.setAlarm(time));
	}

	extractTimes(content: string): string[] {
		const regex = /\b((?:[01]?\d|2[0-3]):[0-5]\d(?:\s?(?:AM|PM))?)\b/gi;
		return [...content.matchAll(regex)].map(match => match[1]);
	}

	setAlarm(timeStr: string) {
		const now = new Date();
		const target = new Date();

		let hours: number;
		let minutes: number;

		// Check for 12-hour format with AM/PM
		const twelveHourMatch = timeStr.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
		if (twelveHourMatch) {
			hours = parseInt(twelveHourMatch[1], 10);
			minutes = parseInt(twelveHourMatch[2], 10);
			const ampm = twelveHourMatch[3].toUpperCase();

			if (ampm === "PM" && hours < 12) hours += 12;
			if (ampm === "AM" && hours === 12) hours = 0;
		} else {
			// Assume 24-hour format
			const [h, m] = timeStr.split(":").map(Number);
			hours = h;
			minutes = m;
		}

		target.setHours(hours, minutes, 0, 0);

		// If the time has already passed today, skip
		if (target < now) {
			console.log(`Skipping past time: ${timeStr}`);
			return;
		}

		// Prevent duplicate alarms for the same time
		if (this.scheduledAlarms.some(a => a.timeStr === timeStr)) {
			console.log(`Alarm for ${timeStr} already scheduled. Skipping duplicate.`);
			return;
		}

		const delay = target.getTime() - now.getTime();

		const timeoutId = setTimeout(() => {
			this.playAlarm(false);
			new AlarmModal(this.app, this).open();
			// Remove this alarm from scheduledAlarms after it fires
			this.scheduledAlarms = this.scheduledAlarms.filter(a => a.timeoutId !== timeoutId);
		}, delay);

		this.scheduledAlarms.push({ timeoutId, timeStr });
		console.log(`Alarm set for ${timeStr} (${delay / 1000} seconds from now)`);
	}

	   public cancelAllAlarms() {
		   this.scheduledAlarms.forEach(({ timeoutId }) => clearTimeout(timeoutId));
		   this.scheduledAlarms = [];
		   console.log("All pending alarms cancelled.");
	   }

	   public cancelAlarmByIndex(idx: number) {
		   if (this.scheduledAlarms[idx]) {
			   clearTimeout(this.scheduledAlarms[idx].timeoutId);
			   this.scheduledAlarms.splice(idx, 1);
		   }
    }

	playAlarm(testing: boolean) {
		// Path relative to plugin install directory
		const path = this.app.vault.adapter.getResourcePath(this.app.vault.configDir +'/plugins/' + this.manifest.id + '/' + this.settings.alarmFile);
		console.log(path);

		const audio = new Audio(path);
		audio.loop = true;
		
		audio.play();

		this.currentAlarm = audio;
		console.log("Alarm playing from", path);
	}
	
	stopAlarm() {
		if (this.currentAlarm) {
			this.currentAlarm.pause();
			this.currentAlarm.currentTime = 0;
			this.currentAlarm = null;
			new Notice("✅ Alarm dismissed");
		}
	}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }	
}
class AlarmModal extends Modal {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "⏰ Alarm ringing!" });
        const btn = contentEl.createEl("button", { text: "Dismiss" });
        btn.addEventListener("click", () => {
            this.plugin.stopAlarm();
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class DayPlanAlarmsSettingsTab extends PluginSettingTab{
	plugin: MyPlugin;
	alarmFile: string; // just the filename

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Day Plan Alarms Settings" });

		// Sound file selection
		const fs = require("fs");
		const pathLoc = path.join(
			(this.app.vault.adapter as any).basePath,
			".obsidian",
			"plugins",
			this.plugin.manifest.id
		);
		const files: string[] = fs.readdirSync(pathLoc)
			.filter((f: string) => f.match(/\.(wav|mp3|ogg)$/i)) as string[];

		new Setting(containerEl)
			.setName('Sound File')
			.setDesc('Choose Sound File')
			.addDropdown(drop => {
				files.forEach(file => drop.addOption(file, file));
				drop.setValue(this.plugin.settings.alarmFile);
				drop.onChange(async value => {
					this.plugin.settings.alarmFile = value;
					await this.plugin.saveSettings();
				});
			});

		// Pending alarms management
		containerEl.createEl("h3", { text: "Pending Alarms" });
		if (this.plugin.scheduledAlarms.length === 0) {
			containerEl.createEl("div", { text: "No pending alarms." });
		} else {
			this.plugin.scheduledAlarms.forEach((alarm, idx) => {
				const alarmDiv = containerEl.createDiv();
				alarmDiv.createSpan({ text: `Alarm for: ${alarm.timeStr}` });
				const cancelBtn = alarmDiv.createEl("button", { text: "Cancel" });
				cancelBtn.onclick = () => {
					this.plugin.cancelAlarmByIndex(idx);
					this.display(); // Refresh UI
				};
			});
			// Cancel all button
			const cancelAllBtn = containerEl.createEl("button", { text: "Cancel All Alarms" });
			cancelAllBtn.onclick = () => {
				this.plugin.cancelAllAlarms();
				this.display();
			};
		}
	}
}
		