import * as vscode from 'vscode';
import { Fetcher } from './fetcher';
import { Content } from './content';


export class FeedList implements vscode.TreeDataProvider<Feed> {
    private _onDidChangeTreeData: vscode.EventEmitter<Feed | undefined> = new vscode.EventEmitter<Feed | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Feed | undefined> = this._onDidChangeTreeData.event;
    public contents: {[key: string]: Content} = {};

    constructor(
        private fetcher: Fetcher,
    ) {}

    async fetch_one(feed: string, update: boolean) {
        const content = await this.fetcher.fetch(feed, update);
        this.contents[feed] = content;
    }

    async fetch(update: boolean) {
        const cfg = vscode.workspace.getConfiguration('rss');
        await Promise.all(cfg.feeds.map((feed: string) => this.fetch_one(feed, update)));
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getContent(feed: string): Content {
        return this.contents[feed];
    }

    getTreeItem(ele: Feed): vscode.TreeItem {
        return ele;
    }

    getChildren(element?: Feed): Feed[] {
        if (element) {
            return [];
        }

        const cfg = vscode.workspace.getConfiguration('rss');
        return cfg.feeds.map((feed: string) => {
            const content = this.contents[feed];
            return new Feed(feed, content);
        });
    }
}

export class Feed extends vscode.TreeItem {
    constructor(
        public feed: string,
        content: Content,
    ) {
        super(content.title);
        this.command = {command: 'rss.articles', title: 'articles', arguments: [feed]};

        const unread_num = content.abstracts.length === 0 ?
            0 : content.abstracts.map(abstract => Number(!abstract.read)).reduce((a, b) => a + b);

        if (unread_num > 0) {
            this.label += ` (${unread_num})`;
        }
        if (!content.ok) {
            this.iconPath = new vscode.ThemeIcon('error');
        } else if (unread_num > 0) {
            this.iconPath = new vscode.ThemeIcon('circle-filled');
        }
    }
}
