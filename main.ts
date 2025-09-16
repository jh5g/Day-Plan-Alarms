import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	private currentAlarm: HTMLAudioElement | null = null;
	async onload() {
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

		const delay = target.getTime() - now.getTime();

		setTimeout(() => {
			this.playAlarm();
			new AlarmModal(this.app, this).open();
		}, delay);

		console.log(`Alarm set for ${timeStr} (${delay / 1000} seconds from now)`);
    }

	playAlarm() {
		// Path relative to plugin install directory
		const path = this.app.vault.adapter.getResourcePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}/mixkit-vintage-warning-alarm-990.wav`);
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