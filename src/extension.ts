import * as vscode from 'vscode';
import { FeedList, Feed } from './feeds';
import { ArticleList, Article } from './articles';
import { Fetcher } from './fetcher';
import { Summary, Entry, Abstract } from './content';
import { FavoritesList, Item } from './favorites';

export async function activate(context: vscode.ExtensionContext) {
    Fetcher.initInstance(context);
    const fetcher = Fetcher.getInstance();
    await fetcher.fetch_all(false);

    const feed_list = new FeedList();
    vscode.window.registerTreeDataProvider('rss-feeds', feed_list);
    const article_list = new ArticleList();
    vscode.window.registerTreeDataProvider('rss-articles', article_list);
    const favorites_list = new FavoritesList();
    vscode.window.registerTreeDataProvider('rss-favorites', favorites_list);

    let current_feed: string | undefined;
    let updating: boolean = false;

    let disposable = vscode.commands.registerCommand('rss.articles', (feed: string) => {
        current_feed = feed;
        article_list.setCatelog(fetcher.getSummary(feed).catelog);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.refresh', async (auto: boolean) => {
        if (updating) {
            return;
        }
        updating = true;
        await vscode.window.withProgress({
            location: auto ? vscode.ProgressLocation.Window: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            await fetcher.fetch_all(true);
            feed_list.refresh();
            if (current_feed) {
                article_list.setCatelog(fetcher.getSummary(current_feed).catelog);
            }
            updating = false;
        });
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.open-website', async (feed: Feed) => {
        vscode.env.openExternal(vscode.Uri.parse(fetcher.getSummary(feed.feed).link));
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.refresh-one', async (feed?: Feed) => {
        if (updating) {
            return;
        }
        updating = true;
        let url: string;
        if (feed) {
            url = feed.feed;
        } else if (current_feed) {
            url = current_feed;
        } else{
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            await fetcher.fetch(url, true);
            feed_list.refresh();
            if (current_feed) {
                article_list.setCatelog(fetcher.getSummary(current_feed).catelog);
            }
            updating = false;
        });
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.read', (abstract: Abstract) => {
        const entry: Entry | undefined = context.globalState.get(abstract.link);
        if (entry === undefined) {return;}
        const panel = vscode.window.createWebviewPanel(
            'rss', entry.title, vscode.ViewColumn.One, {retainContextWhenHidden: true});
        const css = '<style type="text/css">body{font-size:1em;max-width:960px;margin:auto;}</style>';
        panel.webview.html = css + entry.content;
        abstract.read = true;
        entry.read = true;
        article_list.refresh();
        feed_list.refresh();
        favorites_list.refresh();
        context.globalState.update(entry.link, entry);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.open-link', (article: Article) => {
        vscode.env.openExternal(vscode.Uri.parse(article.abstract.link));
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.set-read', (article: Article) => {
        const entry: Entry | undefined = context.globalState.get(article.abstract.link);
        if (entry === undefined) {return;}
        article.abstract.read = true;
        entry.read = true;
        feed_list.refresh();
        article_list.refresh();
        favorites_list.refresh();
        context.globalState.update(entry.link, entry);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.set-unread', (article: Article) => {
        const entry: Entry | undefined = context.globalState.get(article.abstract.link);
        if (entry === undefined) {return;}
        article.abstract.read = false;
        entry.read = false;
        feed_list.refresh();
        article_list.refresh();
        favorites_list.refresh();
        context.globalState.update(entry.link, entry);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.set-all-read', async (feed: Feed) => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Wait a moment...",
            cancellable: false
        }, async () => {
            const catelog = fetcher.getSummary(feed.feed).catelog;
            const abstracts = catelog.map(link => fetcher.getAbstract(link));
            for (const abstract of abstracts) {
                abstract.read = true;
                const entry: Entry | undefined = context.globalState.get(abstract.link);
                if (entry) {
                    entry.read = true;
                    await context.globalState.update(entry.link, entry);
                }
            }
            feed_list.refresh();
            article_list.refresh();
            favorites_list.refresh();
        });
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.add-feed', async () => {
        let url: string | undefined = await vscode.window.showInputBox({prompt: 'Enter the feed URL'});
        if (url === undefined || url.length <= 0) {return;}
        const cfg = vscode.workspace.getConfiguration('rss');
        cfg.feeds.push(url);
        await cfg.update('feeds', cfg.feeds, true);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.remove-feed', async (feed: Feed) => {
        const cfg = vscode.workspace.getConfiguration('rss');
        await cfg.update('feeds', cfg.feeds.filter((e: string) => e !== feed.feed), true);
        const summary: Summary | undefined = context.globalState.get(feed.feed);
        for (const link of summary?.catelog || []) {
            await context.globalState.update(link, undefined);
        }
        await context.globalState.update(feed.feed, undefined);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.add-to-favorites', async (article: Article) => {
        const cfg = vscode.workspace.getConfiguration('rss');
        const name = await vscode.window.showQuickPick(cfg.favorites.map((e: any) => e.name));
        if (name === undefined) {
            return;
        }
        const favorites = cfg.favorites.find((e: any) => e.name === name).list;
        if (favorites.indexOf(article.abstract.link) < 0) {
            favorites.push(article.abstract.link);
            await cfg.update('favorites', cfg.favorites, true);
        }
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('rss.remove-from-favorites', async (item: Item) => {
        const cfg = vscode.workspace.getConfiguration('rss');
        const favorites = cfg.favorites[item.index].list;
        favorites.splice(favorites.indexOf(item.abstract.link), 1);
        await cfg.update('favorites', cfg.favorites, true);
    });
    context.subscriptions.push(disposable);

    const do_refresh = () => vscode.commands.executeCommand('rss.refresh', true);
    const cfg = vscode.workspace.getConfiguration('rss');
    let timer = setInterval(do_refresh, cfg.interval * 1000);

    disposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
        clearInterval(timer);
        const cfg = vscode.workspace.getConfiguration('rss');
        timer = setInterval(do_refresh, cfg.interval * 1000);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            await fetcher.fetch_all(false);
            feed_list.refresh();
            favorites_list.refresh();
        });
    });
    context.subscriptions.push(disposable);
}
