import {
	App,
	ItemView,
	MetadataCache,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	Vault,
	WorkspaceLeaf,
} from "obsidian";
import React, { FC, useEffect, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { Map } from "immutable";

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
	const [filter, setFilter] = useState<string | undefined>();

	useEffect(() => {
		vault.on("create", () => setFiles(vault.getMarkdownFiles()));
		vault.on("delete", () => setFiles(vault.getMarkdownFiles()));
		vault.on("rename", () => setFiles(vault.getMarkdownFiles()));
	}, []);

	function handleFilterEvent(event: Event) {
		if (event instanceof CustomEvent) {
			setFilter(event.detail);
		}
	}

	useEffect(() => {
		document.addEventListener(
			"obsidian-note-list:set-filter",
			handleFilterEvent
		);

		return () =>
			document.removeEventListener(
				"obsidian-note-list:set-filter",
				handleFilterEvent
			);
	});

	const filteredFiles = !filter
		? files
		: files.filter((file) =>
				metadataCache
					.getFileCache(file)
					?.tags?.some((tag) => tag.tag === filter)
		  );

	return (
		<>
			<ul>
				{filteredFiles.map((file) => (
					<li key={file.path}>{file.basename}</li>
				))}
			</ul>
		</>
	);
};

const TagList: FC<{
	vault: Vault;
	metadataCache: MetadataCache;
}> = ({ vault, metadataCache }) => {
	const [filter, setFilter] = useState<string | undefined>();

	const [tags, setTags] = useState(
		Map<TFile, string[]>(
			vault
				.getMarkdownFiles()
				.map((file) => [
					file,
					(metadataCache.getFileCache(file)?.tags ?? []).map(
						(tag) => tag.tag
					),
				])
		)
	);

	useEffect(() => {
		const event = new CustomEvent("obsidian-note-list:set-filter", {
			detail: filter,
		});
		document.dispatchEvent(event);
	}, [filter]);

	useEffect(() => {
		metadataCache.on("changed", (file, data, cache) => {
			setTags((tags) =>
				tags.set(
					file,
					(cache.tags ?? []).map((tag) => tag.tag)
				)
			);
		});
	}, []);

	return (
		<ul>
			{tags.valueSeq().flatMap((tags) =>
				tags.map((tag) => (
					<li key={tag}>
						<button
							onClick={() =>
								setFilter(filter === tag ? undefined : tag)
							}
						>
							{filter === tag ? <strong>{tag}</strong> : tag}
						</button>
					</li>
				))
			)}
		</ul>
	);
};

const NOTE_LIST_VIEW_TYPE = "NOTE-LIST";

class NoteListView extends ItemView {
	root?: Root;
	setFilter?: (filter: string) => void;

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

const TAG_LIST_VIEW_TYPE = "TAG-LIST";

class TagListView extends ItemView {
	root?: Root;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return NOTE_LIST_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Tag list";
	}

	async onOpen(): Promise<void> {
		this.root = createRoot(this.containerEl.children[1]);
		this.root.render(
			<TagList
				vault={this.app.vault}
				metadataCache={this.app.metadataCache}
			/>
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
	}

	getIcon(): string {
		return "hash";
	}
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async openLeaf(type: string, showAfterAttach: boolean): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(type);
		if (leaves.length == 0) {
			const leaf = this.app.workspace.getLeftLeaf(false);
			await leaf.setViewState({ type });
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

		this.registerView(TAG_LIST_VIEW_TYPE, (leaf) => new TagListView(leaf));

		this.app.workspace.onLayoutReady(async () => {
			await this.openLeaf(NOTE_LIST_VIEW_TYPE, true);
			await this.openLeaf(TAG_LIST_VIEW_TYPE, true);
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
