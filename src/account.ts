import * as vscode from 'vscode';
import * as sqlite from 'sqlite';
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
        return Object.keys(App.instance.collections).map(name => new Account(name));
    }
}

export class Account extends vscode.TreeItem {
    constructor(public name: string) {
        super(name);
        this.command = {command: 'rss.select', title: 'select', arguments: [name]};
    }
}