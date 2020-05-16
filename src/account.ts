import * as vscode from 'vscode';
import { App } from './app';

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
        return Object.keys(App.instance.collections).map(key => new Account(key));
    }
}

export class Account extends vscode.TreeItem {
    constructor(public key: string) {
        super(App.instance.collections[key].name);
        this.command = {command: 'rss.select', title: 'select', arguments: [key]};
    }
}