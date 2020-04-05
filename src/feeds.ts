import * as vscode from 'vscode';
import { Fetcher } from './fetcher';
import { Content } from './content';


export class FeedList implements vscode.TreeDataProvider<Feed> {
    private _onDidChangeTreeData: vscode.EventEmitter<Feed | undefined> = new vscode.EventEmitter<Feed | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Feed | undefined> = this._onDidChangeTreeData.event;
    private is_update: boolean = false;
    private update_feed: string | undefined = undefined;

    constructor(
        private fetcher: Fetcher,
    ) {}

    refresh(is_update: boolean): void {
        this.is_update = is_update;
        this.update_feed = undefined;
        this._onDidChangeTreeData.fire();
    }

    update(feed: string): void {
        this.is_update = false;
        this.update_feed = feed;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(ele: Feed): vscode.TreeItem {
        return ele;
    }

    async getChildren(element?: Feed): Promise<Feed[]> {
        if (element) return [];

        const cfg = vscode.workspace.getConfiguration('rss');
        return await Promise.all(cfg.feeds.map(async (feed: string) => {
            const content = await this.fetcher.fetch(feed, this.is_update || this.update_feed == feed);
            return new Feed(feed, content);
        }))
    }
}

export class Feed extends vscode.TreeItem {
    constructor(
        public feed: string,
        public content: Content,
    ) {
        super(content.title);
        this.command = {command: 'rss.articles', title: 'articles', arguments: [feed, content]};
        if (content.entries.length > 0 && content.entries.map(entry => !entry.read).reduce((a, b) => a || b))
            this.iconPath = new vscode.ThemeIcon('circle-filled')
    }
}
