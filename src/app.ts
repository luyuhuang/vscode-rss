import * as vscode from 'vscode';
import * as collection from './collection';
import { join as pathJoin } from 'path';
import { checkDir } from './utils';
import * as sqlite3 from 'sqlite3';
import { open as openDB, Database } from 'sqlite';
import { AccountList, Account } from './account';
import { FeedList, Feed } from './feeds';
import { ArticleList, Article } from './articles';
import { FavoritesList, Item } from './favorites';
import { Abstract } from './content';
import * as uuid from 'uuid';
import { stringify } from 'querystring';

export class App {
    private static _instance?: App;

    private current_account?: string;
    private current_feed?: string;
    private updating = false;

    private account_list = new AccountList();
    private feed_list = new FeedList();
    private article_list = new ArticleList();
    private favorites_list = new FavoritesList();

    public collections: {[key: string]:collection.Collection} = {};
    public readonly root: string = this.context.globalStoragePath;
    private database?: Database;

    private constructor(
        private context: vscode.ExtensionContext
    ) {}

    private async initAccounts() {
        let keys = Object.keys(App.cfg.accounts);
        if (keys.length <= 0) {
            await this.createLocalAccount('Default');
            keys = Object.keys(App.cfg.accounts);
        }
        for (const key of keys) {
            if (this.collections[key]) {
                continue;
            }
            const account = App.cfg.accounts[key];
            const dir = pathJoin(this.root, key);
            let c: collection.Collection;
            switch (account.type) {
                case 'local':
                    c = new collection.LocalCollection(dir, key);
                    break;
                case 'ttrss':
                    c = new collection.TTRSSCollection(dir, key);
                    break;
                default:
                    throw new Error(`Unknown account type: ${account.type}`);
            }
            await c.init();
            this.collections[key] = c;
        }
        for (const key in this.collections) {
            if (!(key in App.cfg.accounts)) {
                delete this.collections[key];
            }
        }
    }

    private async createLocalAccount(name: string) {
        const key = uuid.v1();
        const accounts: {[key: string]: any} = {
            [key]: {
                name: name,
                type: 'local',
                feeds: [],
                favorites: [
                    {"name": "Default", "list": []}
                ]
            }
        };
        const cfg = App.cfg;
        if (Object.keys(cfg.accounts).length <= 0) {
            this.current_account = key;
        }
        for (const key in cfg.accounts) {
            accounts[key] = cfg.accounts[key];
        }
        await cfg.update('accounts', accounts, true);
    }

    private async removeAccount() {

    }

    async init() {
        await checkDir(this.root);
        this.database = await openDB({
            filename: pathJoin(this.root, 'rss.db'), driver: sqlite3.Database
        });
        await this.initAccounts();
        this.current_account = Object.keys(this.collections)[0];
    }

    static async initInstance(context: vscode.ExtensionContext) {
        App._instance = new App(context);
        await App.instance.init();
    }

    static get instance(): App {
        return App._instance!;
    }

    static get db(): Database {
        return App.instance.database!;
    }

    static get cfg() {
        return vscode.workspace.getConfiguration('rss');
    }

    get db(): Database {
        return this.database!;
    }

    currCollection() {
        return this.collections[this.current_account!];
    }

    currArticles() {
        if (this.current_feed === undefined) {
            return [];
        }
        return this.currCollection().getArticles(this.current_feed);
    }

    currFavorites() {
        return this.currCollection().getFavorites();
    }

    initViews() {
        vscode.window.registerTreeDataProvider('rss-accounts', this.account_list);
        vscode.window.registerTreeDataProvider('rss-feeds', this.feed_list);
        vscode.window.registerTreeDataProvider('rss-articles', this.article_list);
        vscode.window.registerTreeDataProvider('rss-favorites', this.favorites_list);
    }

    initCommands() {
        const commands: [string, (...args: any[]) => any][] = [
            ['rss.select', this.rss_select],
            ['rss.articles', this.rss_articles],
            ['rss.read', this.rss_read],
            ['rss.set-read', this.rss_set_read],
            ['rss.set-unread', this.rss_set_unread],
            ['rss.set-all-read', this.rss_set_all_read],
            ['rss.refresh', this.rss_refresh],
            ['rss.refresh-account', this.rss_refresh_account],
            ['rss.refresh-one', this.rss_refresh_one],
            ['rss.open-website', this.rss_open_website],
            ['rss.open-link', this.rss_open_link],
            ['rss.add-feed', this.rss_add_feed],
            ['rss.remove-feed', this.rss_remove_feed],
            ['rss.add-to-favorites', this.rss_add_to_favorites],
            ['rss.remove-from-favorites', this.rss_remove_from_favorites],
        ];

        for (const [cmd, handler] of commands) {
            this.context.subscriptions.push(
                vscode.commands.registerCommand(cmd, handler, this)
            );
        }
    }

    rss_select(account: string) {
        this.current_account = account;
        this.current_feed = undefined;
        this.feed_list.refresh();
        this.article_list.refresh();
        this.favorites_list.refresh();
    }

    rss_articles(feed: string) {
        this.current_feed = feed;
        this.article_list.refresh();
    }

    async rss_read(abstract: Abstract) {
        const content = await this.currCollection().getContent(abstract.link);
        const panel = vscode.window.createWebviewPanel(
            'rss', abstract.title, vscode.ViewColumn.One, {retainContextWhenHidden: true});
        const css = '<style type="text/css">body{font-size:1em;max-width:960px;margin:auto;}</style>';
        panel.webview.html = css + content;
        abstract.read = true;
        this.article_list.refresh();
        this.feed_list.refresh();
        this.favorites_list.refresh();

        await this.currCollection().updateAbstract(abstract.link, abstract).commit();
    }

    async rss_set_read(article: Article) {
        const abstract = article.abstract;
        abstract.read = true;
        this.feed_list.refresh();
        this.article_list.refresh();
        this.favorites_list.refresh();

        await this.currCollection().updateAbstract(abstract.link, abstract).commit();
    }

    async rss_set_unread(article: Article) {
        const abstract = article.abstract;
        abstract.read = false;
        this.feed_list.refresh();
        this.article_list.refresh();
        this.favorites_list.refresh();

        await this.currCollection().updateAbstract(abstract.link, abstract).commit();
    }

    async rss_set_all_read(feed: Feed) {
        for (const link of feed.summary.catelog) {
            const abs = this.currCollection().getAbstract(link)!;
            abs.read = true;
            this.currCollection().updateAbstract(link, abs);
        }
        this.feed_list.refresh();
        this.article_list.refresh();
        this.favorites_list.refresh();

        await this.currCollection().commit();
    }

    async rss_refresh(auto: boolean) {
        if (this.updating) {
            return;
        }
        this.updating = true;
        await vscode.window.withProgress({
            location: auto ? vscode.ProgressLocation.Window: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            await Promise.all(Object.values(this.collections).map(c => c.fetchAll(true)));
            this.feed_list.refresh();
            this.article_list.refresh();
            this.updating = false;
        });
    }

    async rss_refresh_account(account?: Account) {
        if (this.updating) {
            return;
        }
        this.updating = true;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            const collection = account ?
                this.collections[account.key] : this.currCollection();
            await collection.fetchAll(true);
            this.feed_list.refresh();
            this.article_list.refresh();
            this.updating = false;
        });
    }

    async rss_refresh_one(feed?: Feed) {
        if (this.updating) {
            return;
        }
        const url = feed ? feed.feed : this.current_feed;
        if (url === undefined) {
            return;
        }
        this.updating = true;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            await this.currCollection().fetchOne(url, true);
            this.feed_list.refresh();
            this.article_list.refresh();
            this.updating = false;
        });
    }

    rss_open_website(feed: Feed) {
        vscode.env.openExternal(vscode.Uri.parse(feed.summary.link));
    }

    rss_open_link(article: Article) {
        vscode.env.openExternal(vscode.Uri.parse(article.abstract.link));
    }

    async rss_add_feed() {
        const feed = await vscode.window.showInputBox({prompt: 'Enter the feed URL'});
        if (feed === undefined || feed.length <= 0) {return;}
        await this.currCollection().addFeed(feed);
    }

    async rss_remove_feed(feed: Feed) {
        await this.currCollection().delFeed(feed.feed);
    }

    async rss_add_to_favorites(article: Article) {
        const favorites: any[] = this.currCollection().getFavorites();
        const name = await vscode.window.showQuickPick(favorites.map((e: any) => e.name));
        if (name === undefined) {
            return;
        }
        await this.currCollection().addToFavorites(
            article.abstract.link, favorites.findIndex(e => e.name === name)
        );
    }

    async rss_remove_from_favorites(item: Item) {
        await this.currCollection().removeFromFavorites(item.abstract.link, item.index);
    }

    initEvents() {
        const do_refresh = () => vscode.commands.executeCommand('rss.refresh', true);
        let timer = setInterval(do_refresh, App.cfg.interval * 1000);

        const disposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (this.updating) {
                return;
            }
            this.updating = true;
            clearInterval(timer);
            timer = setInterval(do_refresh, App.cfg.interval * 1000);
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Updating RSS...",
                cancellable: false
            }, async () => {
                await this.initAccounts();
                await Promise.all(Object.values(this.collections).map(c => c.fetchAll(false)));
                this.account_list.refresh();
                this.feed_list.refresh();
                this.favorites_list.refresh();
                this.updating = false;
            });
        });
        this.context.subscriptions.push(disposable);
    }
}