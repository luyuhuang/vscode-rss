import * as vscode from 'vscode';
import { FeedList } from './feeds';
import { ArticleList } from './articles';

export function activate(context: vscode.ExtensionContext) {
    const source_list = new FeedList();
    vscode.window.registerTreeDataProvider('rss-sources', source_list);
    const article_list = new ArticleList();
    vscode.window.registerTreeDataProvider('rss-articles', article_list);

    let disposable = vscode.commands.registerCommand('rss.articles', (content) => {
        article_list.setArticles(content.entries)
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.refresh', () => {
        vscode.window.showInformationMessage('refreshed');
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.read', (title, content) => {
        const panel = vscode.window.createWebviewPanel('rss', title, vscode.ViewColumn.One, {})
        panel.webview.html = content
    });
    context.subscriptions.push(disposable);
}
