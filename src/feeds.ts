import * as vscode from 'vscode';
import { Summary } from './content';
import { App } from './app';

export class FeedList implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(ele: vscode.TreeItem): vscode.TreeItem {
        return ele;
    }

    private buildTree(tree: FeedTree): [vscode.TreeItem[], number] {
        const collection = App.instance.currCollection();
        const list: vscode.TreeItem[] = [];
        let unread_sum = 0;
        for (const item of tree) {
            if (typeof(item) === 'string') {
                const summary = collection.getSummary(item);
                if (summary === undefined) {
                    continue;
                }
                const unread_num = summary.catelog.length ? summary.catelog.map((id): number => {
                    const abstract = collection.getAbstract(id);
                    return abstract && !abstract.read ? 1 : 0;
                }).reduce((a, b) => a + b) : 0;
                unread_sum += unread_num;
                list.push(new Feed(item, summary, unread_num));
            } else {
                const [tree, unread_num] = this.buildTree(item.list);
                unread_sum += unread_num;
                list.push(new Folder(item, tree, unread_num));
            }
        }
        return [list, unread_sum];
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (element) {
            if (element instanceof Folder) {
                return element.list;
            } else {
                return [];
            }
        } else {
            const [list, unread_num] = this.buildTree(App.instance.currCollection().getFeedList());
            if (unread_num > 0) {
                list.unshift(new Unread(unread_num));
            }
            return list;
        }
    }
}

export class Feed extends vscode.TreeItem {
    constructor(
        public feed: string,
        public summary: Summary,
        unread_num: number,
    ) {
        super(summary.title);
        this.command = {command: 'rss.articles', title: 'articles', arguments: [feed]};
        this.contextValue = 'feed';

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

class Unread extends vscode.TreeItem {
    constructor(unread_num: number)  {
        super(`You have ${unread_num} unread article${unread_num > 1 ? 's' : ''}`);
        this.command = {command: 'rss.articles', title: 'articles', arguments: ['<unread>']};
        this.contextValue = 'unread';
        this.iconPath = new vscode.ThemeIcon('bell-dot');
    }
}

class Folder extends vscode.TreeItem {
    constructor(
        public category: Category,
        public list: vscode.TreeItem[],
        unread_num: number,
    ) {
        super(category.name, vscode.TreeItemCollapsibleState.Expanded);
        if (unread_num > 0) {
            this.label += ` (${unread_num})`;
            this.contextValue = 'folder';
            this.iconPath = new vscode.ThemeIcon('circle-filled');
        }
    }
}
