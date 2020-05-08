import * as vscode from 'vscode';
import { Entry, Abstract } from './content';

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
        const list = [];
        for (const article of this.articles) {
            list.push(new Article(article));
        }
        return list;
    }

    public articles: Abstract[] = [];
    setArticles(articles: Abstract[]): void{
        this.articles = articles;
        this.refresh();
    }
}

export class Article extends vscode.TreeItem {
    constructor(
        public abstract: Abstract
    ) {
        super(abstract.title);

        this.description = new Date(abstract.date).toLocaleString();
        this.command = {command: 'rss.read', title: 'Read', arguments: [abstract]};
        if (!abstract.read) {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
        }
    }
}
