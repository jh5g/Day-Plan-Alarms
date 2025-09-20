import { ItemView, WorkspaceLeaf, ButtonComponent } from "obsidian";
import type MyPlugin from "../main";

export const ALARM_PANEL_VIEW_TYPE = "alarm-panel-view";

export class AlarmPanelView extends ItemView {
	plugin: MyPlugin;
	private alarmListEl: HTMLElement;
	private refreshHandler: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return ALARM_PANEL_VIEW_TYPE;
	}

	getDisplayText() {
		return "Alarms";
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Scheduled Alarms" });
		this.alarmListEl = contentEl.createDiv();
		this.renderAlarms();

		// Listen for alarm changes only while panel is open
		this.refreshHandler = () => this.renderAlarms();
		window.addEventListener("alarm-updated", this.refreshHandler);
	}

	async onClose() {
		// Remove event listener
		window.removeEventListener("alarm-updated", this.refreshHandler);
	}

	renderAlarms() {
		this.alarmListEl.empty();
		const alarms = this.plugin.scheduledAlarms;
		if (alarms.length === 0) {
			this.alarmListEl.createSpan({ text: "No alarms scheduled." });
			return;
		}
		alarms.forEach((alarm, idx) => {
			const row = this.alarmListEl.createDiv({ cls: "alarm-row" });
			row.createSpan({ text: alarm.timeStr });
			const cancelBtn = new ButtonComponent(row);
			cancelBtn.setButtonText("Cancel").onClick(() => {
				this.plugin.cancelAlarmByIndex(idx);
				window.dispatchEvent(new Event("alarm-updated"));
			});
		});
	}
}
