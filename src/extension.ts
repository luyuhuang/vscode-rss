import * as vscode from 'vscode';
import { FeedList, Feed } from './feeds';
import { ArticleList, Article } from './articles';
import { Fetcher } from './fetcher';
import { Summary, Content, Entry } from './content';

export function activate(context: vscode.ExtensionContext) {
    // const cfg = vscode.workspace.getConfiguration('rss');
    // for (const feed of cfg.feeds) {
    //     console.log(feed);
    //     const summery = context.globalState.get(feed, new Summary('', []))
    //     for (const link of summery.catelog) {
    //         console.log('--', link)
    //         context.globalState.update(link, undefined)
    //     }
    //     context.globalState.update(feed, undefined)
    // }
    // return
    const fetcher = new Fetcher(context);

    const feed_list = new FeedList(fetcher);
    vscode.window.registerTreeDataProvider('rss-feeds', feed_list);
    const article_list = new ArticleList();
    vscode.window.registerTreeDataProvider('rss-articles', article_list);

    let current_feed: string | undefined;

    let disposable = vscode.commands.registerCommand('rss.articles', (feed: string, content: Content) => {
        current_feed = feed;
        article_list.setArticles(content.entries);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.refresh', () => {
        feed_list.refresh(true);
        current_feed = undefined;
        article_list.setArticles([]);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.refresh-one', async (feed?: Feed) => {
        if (feed) {
            feed_list.update(feed.feed);
        } else if (current_feed) {
            feed_list.update(current_feed);
        } else {
            return;
        }
        current_feed = undefined;
        article_list.setArticles([]);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.read', (entry: Entry) => {
        const panel = vscode.window.createWebviewPanel('rss', entry.title, vscode.ViewColumn.One, {});
        panel.webview.html = entry.content;
        entry.read = true;
        article_list.refresh();
        feed_list.refresh(false);
        context.globalState.update(entry.link, entry);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.open-link', (article: Article) => {
        vscode.env.openExternal(vscode.Uri.parse(article.entry.link));
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.set-read', (article: Article) => {
        article.entry.read = true;
        feed_list.refresh(false);
        article_list.refresh();
        context.globalState.update(article.entry.link, article.entry);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.set-unread', (article: Article) => {
        article.entry.read = false;
        feed_list.refresh(false);
        article_list.refresh();
        context.globalState.update(article.entry.link, article.entry);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.set-all-read', (feed: Feed) => {
        for (const entry of feed.content.entries) {
            entry.read = true;
            context.globalState.update(entry.link, entry);
        }
        feed_list.refresh(false);
        if (feed.feed === current_feed) {
            article_list.setArticles(feed.content.entries);
        }
    });
    context.subscriptions.push(disposable);

    const do_refresh = () => vscode.commands.executeCommand('rss.refresh');
    const cfg = vscode.workspace.getConfiguration('rss');
    let timer = setInterval(do_refresh, cfg.interval * 1000);

    disposable = vscode.workspace.onDidChangeConfiguration((e) => {
        feed_list.refresh(false);
        clearInterval(timer);
        const cfg = vscode.workspace.getConfiguration('rss');
        timer = setInterval(do_refresh, cfg.interval * 1000);
    });
    context.subscriptions.push(disposable);
}
