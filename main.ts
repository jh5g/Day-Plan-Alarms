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

	async onload() {
        this.addCommand({
            id: "schedule-alarms",
            name: "Schedule alarms from table",
            callback: () => this.scheduleAlarms(),
        });
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
        const regex = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g; // matches HH:MM
        return [...content.matchAll(regex)].map(match => match[0]);
    }

    setAlarm(timeStr: string) {
        const [hours, minutes] = timeStr.split(":").map(Number);
        const now = new Date();
        const target = new Date();

        target.setHours(hours, minutes, 0, 0);

        // If the time has already passed today, skip
        if (target < now) return;

        const delay = target.getTime() - now.getTime();

        setTimeout(() => {
            this.playAlarm();
            new Notice(`⏰ Alarm for ${timeStr}`);
        }, delay);
    }

    playAlarm() {
        const audio = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
        audio.play();
    }
}
