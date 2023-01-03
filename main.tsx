import {
	App,
	ItemView,
	MetadataCache,
	Plugin,
	PluginSettingTab,
	Setting,
	Vault,
	WorkspaceLeaf,
} from "obsidian";
import React, { FC, useEffect, useState } from "react";
import { createRoot, Root } from "react-dom/client";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

const NoteList: FC<{ vault: Vault; metadataCache: MetadataCache }> = ({
	vault,
	metadataCache,
}) => {
	const [files, setFiles] = useState(vault.getMarkdownFiles());
	const [tags, setTags] = useState([] as string[]);

	useEffect(() => {
		vault.on("create", () => setFiles(vault.getMarkdownFiles()));
		vault.on("delete", () => setFiles(vault.getMarkdownFiles()));
		vault.on("rename", () => setFiles(vault.getMarkdownFiles()));
	}, []);

	useEffect(() => {
		setTags(
			files.flatMap(
				(file) =>
					metadataCache
						.getFileCache(file)
						?.tags?.map((tag) => tag.tag) ?? []
			)
		);
	}, [files]);

	return (
		<>
			<ul>
				{files.map((file) => (
					<li key={file.path}>{file.basename}</li>
				))}
			</ul>
			<ul>
				{tags.map((tag) => (
					<li key={tag}>{tag}</li>
				))}
			</ul>
		</>
	);
};

const NOTE_LIST_VIEW_TYPE = "NOTE-LIST";

class NoteListView extends ItemView {
	root?: Root;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return NOTE_LIST_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Note list";
	}

	async onOpen(): Promise<void> {
		this.root = createRoot(this.containerEl.children[1]);
		this.root.render(
			<NoteList
				vault={this.app.vault}
				metadataCache={this.app.metadataCache}
			/>
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
	}

	getIcon(): string {
		return "files";
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

		this.registerView(
			NOTE_LIST_VIEW_TYPE,
			(leaf) => new NoteListView(leaf)
		);

		this.app.workspace.onLayoutReady(async () => {
			await this.openFileTreeLeaf(true);
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
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
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						console.log("Secret: " + value);
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
