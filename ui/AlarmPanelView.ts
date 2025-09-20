import { ItemView, WorkspaceLeaf, ButtonComponent } from "obsidian";
import type DayPlanAlarmsPlugin from "../main";

export const ALARM_PANEL_VIEW_TYPE = "alarm-panel-view";

export class AlarmPanelView extends ItemView {
	plugin: DayPlanAlarmsPlugin;
	private alarmListEl: HTMLElement;
	private refreshHandler: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: DayPlanAlarmsPlugin) {
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
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("alarm-updated", this.refreshHandler)
		);
	}

	async onClose() {
		// Remove event listener
		this.plugin.app.workspace.off("alarm-updated", this.refreshHandler);
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
				this.plugin.app.workspace.trigger("alarm-updated");
			});
		});
	}
}
