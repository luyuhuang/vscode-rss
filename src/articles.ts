import * as vscode from 'vscode';

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
        if (element) return [];
        const list = [];
        for (const article of this.articles) {
            list.push(new Article(article.title, article.content));
        }
        return list;
    }

    private articles: any[] = [];
    setArticles(articles: any[]): void{
        this.articles = articles;
        this.refresh();
    }
}

class Article extends vscode.TreeItem {
    constructor(
        private title: string,
        private content: string
    ) {
        super(title, vscode.TreeItemCollapsibleState.None);
        this.command = {command: 'rss.read', title: 'Read', arguments: [title, content]};
    }
}
