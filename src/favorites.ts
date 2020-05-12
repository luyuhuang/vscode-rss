import * as vscode from 'vscode';
import { Fetcher } from './fetcher';
import { Article } from './articles';
import { Abstract } from './content';

export class FavoritesList implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<Article | undefined> = new vscode.EventEmitter<Article | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Article | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(ele: vscode.TreeItem) {
        return ele;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        const cfg = vscode.workspace.getConfiguration('rss');
        if (element) {
            const favorites = element as Favorites;
            const list: string[] = cfg.favorites[favorites.index].list;
            const items: Item[] = [];
            for (const link of list) {
                const abstract = Fetcher.getInstance().getAbstract(link);
                if (abstract) {
                    items.push(new Item(abstract, favorites.index));
                }
            }
            return items;
        } else {
            return cfg.favorites.map((e: any, i: number) => new Favorites(e.name, i));
        }
    }
}

class Favorites extends vscode.TreeItem {
    constructor(
        public name: string,
        public index: number
    ) {
        super(name, index === 0 ?
            vscode.TreeItemCollapsibleState.Expanded :
            vscode.TreeItemCollapsibleState.Collapsed);
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
