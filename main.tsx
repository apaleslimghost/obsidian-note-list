import {
	App,
	ItemView,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
	moment,
	Events,
	EventRef,
} from "obsidian";
import React, {
	createContext,
	DependencyList,
	FC,
	useContext,
	useEffect,
	useState,
} from "react";
import { createRoot, Root } from "react-dom/client";
import stripMarkdown from "strip-markdown-oneline";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

const AppContext = createContext<App | undefined>(undefined);

const useEventRef = (source: Events, init: (source: Events) => EventRef) =>
	useEffect(() => {
		const eventRef = init(source);
		return () => source.offref(eventRef);
	}, []);

function useAsync<T>(
	func: () => Promise<T>,
	deps?: DependencyList
): [T | null, Error | null, boolean] {
	const [value, setValue] = useState<T | null>(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);

	async function run() {
		try {
			setLoading(true);
			setValue(await func());
		} catch (error) {
			setError(error);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		run();
	}, deps);

	return [value, error, loading];
}

const Note: FC<{
	file: TFile;
}> = ({ file }) => {
	const { vault, workspace } = useContext(AppContext)!;
	const [mtime, setMtime] = useState(file.stat.mtime);

	const [content, error, loading] = useAsync(
		async () => vault.cachedRead(file),
		[mtime]
	);

	useEventRef(vault, () =>
		vault.on("modify", (f) => {
			if (f === file) {
				setMtime(file.stat.mtime);
			}
		})
	);

	const modified = moment(mtime);

	return (
		<a
			className="note"
			onClick={() => workspace.openLinkText(file.basename, file.path)}
		>
			<h3>{file.basename}</h3>
			<time dateTime={modified.toISOString()} title={modified.calendar()}>
				{modified.fromNow()}
			</time>
			<p className="note-summary">
				{!(loading || error) &&
					content &&
					stripMarkdown(content.replace(/\n+/g, "\n\n"))}
			</p>
		</a>
	);
};

const NoteList = () => {
	const { vault, metadataCache } = useContext(AppContext)!;
	const [files, setFiles] = useState(vault.getMarkdownFiles());
	const [filter, setFilter] = useState<string | undefined>();

	useEventRef(vault, () =>
		vault.on("create", () => setFiles(vault.getMarkdownFiles()))
	);
	useEventRef(vault, () =>
		vault.on("delete", () => setFiles(vault.getMarkdownFiles()))
	);
	useEventRef(vault, () =>
		vault.on("rename", () => setFiles(vault.getMarkdownFiles()))
	);

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
			{filter && <h2>Notes tagged {filter}</h2>}
			<ul className="note-list">
				{filteredFiles.map((file) => (
					<li key={file.path}>
						<Note file={file} />
					</li>
				))}
			</ul>
		</>
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
			<AppContext.Provider value={this.app}>
				<NoteList />
			</AppContext.Provider>
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
	}

	getIcon(): string {
		return "files";
	}
}

type FunctionArgs<T> = T extends (...args: infer A) => unknown ? A : unknown;

function onDocument(...args: FunctionArgs<Document["on"]>) {
	document.on(...args);
	return () => document.off(...args);
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

	handleTagClick = (event: Event) => {
		if (!(event.target instanceof HTMLElement)) return;
		event.stopImmediatePropagation();

		const tagItem = event.target.closest(".tag-pane-tag")!;
		const text = tagItem.querySelector(".tag-pane-tag-text")!;

		const tag = "#" + text.textContent;

		document.dispatchEvent(
			new CustomEvent("obsidian-note-list:set-filter", {
				detail: tag,
			})
		);
	};

	async onload() {
		await this.loadSettings();

		this.registerView(
			NOTE_LIST_VIEW_TYPE,
			(leaf) => new NoteListView(leaf)
		);

		this.register(
			onDocument(
				"click",
				".tag-pane-tag",
				(event) => this.handleTagClick(event),
				{
					capture: true,
				}
			)
		);

		this.app.workspace.onLayoutReady(async () => {
			await this.openLeaf(NOTE_LIST_VIEW_TYPE, true);
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
