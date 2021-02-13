import * as vscode from 'vscode';
import { Article } from './articles';
import { Abstract } from './content';
import { App } from './app';

export class FavoritesList implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<Article | undefined> = new vscode.EventEmitter<Article | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Article | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(ele: vscode.TreeItem) {
        return ele;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (element) {
            return [];
        }
        return App.instance.currFavorites().map((a, i) => new Item(a, i));
    }
}

export class Item extends Article {
    constructor(
        public abstract: Abstract,
        public index: number
    ) {
        super(abstract);
    }
}
