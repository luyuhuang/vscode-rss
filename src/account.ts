import * as vscode from 'vscode';
import { App } from './app';
import { Collection } from './collection';

export class AccountList implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<Account | undefined> = new vscode.EventEmitter<Account | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Account | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(ele: vscode.TreeItem) {
        return ele;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (element) {
            return [];
        }
        return Object.values(App.instance.collections).map(c => new Account(c));
    }
}

export class Account extends vscode.TreeItem {
    public readonly key: string;
    public readonly type: string;
    constructor(collection: Collection) {
        super(collection.name);
        this.key = collection.account;
        this.type = collection.type;
        this.contextValue = this.type;
        this.command = {command: 'rss.select', title: 'select', arguments: [this.key]};

        const links = collection.getArticleList();
        const unread_num = links.length === 0 ? 0
            : links.map(link => Number(!collection.getAbstract(link)?.read))
            .reduce((a, b) => a + b);

        if (unread_num > 0) {
            this.label += ` (${unread_num})`;
            this.iconPath = new vscode.ThemeIcon('rss');
        }
    }
}
