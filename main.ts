import { App, ItemView, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

const NOTE_LIST_VIEW_TYPE = 'NOTE-LIST'

class NoteListView extends ItemView {
	getViewType(): string {
		return NOTE_LIST_VIEW_TYPE
	}

	getDisplayText(): string {
		return 'Note list'
	}

	async onOpen(): Promise<void> {

	}

	getIcon(): string {
		return 'files'
	}
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async openFileTreeLeaf(showAfterAttach: boolean): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(NOTE_LIST_VIEW_TYPE);
		if (leaves.length == 0) {
			const leaf = this.app.workspace.getLeftLeaf(false);
			await leaf.setViewState({ type: NOTE_LIST_VIEW_TYPE });
			if (showAfterAttach) this.app.workspace.revealLeaf(leaf);
		} else {
			leaves.forEach((leaf) => this.app.workspace.revealLeaf(leaf));
		}
	}

	async onload() {
		await this.loadSettings();

		this.registerView(NOTE_LIST_VIEW_TYPE, leaf => new NoteListView(leaf))

        this.app.workspace.onLayoutReady(async () => {
			await this.openFileTreeLeaf(true);
        });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
