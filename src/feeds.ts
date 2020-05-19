import * as vscode from 'vscode';
import { Summary } from './content';
import { App } from './app';

export class FeedList implements vscode.TreeDataProvider<Feed> {
    private _onDidChangeTreeData: vscode.EventEmitter<Feed | undefined> = new vscode.EventEmitter<Feed | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Feed | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(ele: Feed): vscode.TreeItem {
        return ele;
    }

    getChildren(element?: Feed): Feed[] {
        if (element) {
            return [];
        }

        const collection = App.instance.currCollection();
        return collection.getFeedList().map(feed => {
            const summary = collection.getSummary(feed)!;
            return new Feed(feed, summary);
        });
    }
}

export class Feed extends vscode.TreeItem {
    constructor(
        public feed: string,
        public summary: Summary,
    ) {
        super(summary.title);
        this.command = {command: 'rss.articles', title: 'articles', arguments: [feed]};

        const unread_num = summary.catelog.length === 0 ? 0
            : summary.catelog.map(link => Number(!App.instance.currCollection().getAbstract(link)?.read))
            .reduce((a, b) => a + b);

        if (unread_num > 0) {
            this.label += ` (${unread_num})`;
        }
        if (!summary.ok) {
            this.iconPath = new vscode.ThemeIcon('error');
        } else if (unread_num > 0) {
            this.iconPath = new vscode.ThemeIcon('circle-filled');
        }
    }
}
