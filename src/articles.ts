import * as vscode from 'vscode';
import { Abstract } from './content';
import { Fetcher } from './fetcher';

export class ArticleList implements vscode.TreeDataProvider<Article> {
    private _onDidChangeTreeData: vscode.EventEmitter<Article | undefined> = new vscode.EventEmitter<Article | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Article | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(ele: Article): vscode.TreeItem {
        return ele;
    }

    getChildren(element?: Article): Article[] {
        if (element) {return [];}
        return this.catelog.map(link => new Article(Fetcher.getInstance().getAbstract(link)));
    }

    public catelog: string[] = [];
    setCatelog(catelog: string[]): void{
        this.catelog = catelog;
        this.refresh();
    }
}

export class Article extends vscode.TreeItem {
    constructor(
        public abstract: Abstract
    ) {
        super(abstract.title);

        this.contextValue = "article";
        this.description = new Date(abstract.date).toLocaleString();
        this.command = {command: 'rss.read', title: 'Read', arguments: [abstract]};
        if (!abstract.read) {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
        }
    }
}
