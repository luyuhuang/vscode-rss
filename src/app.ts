import * as vscode from 'vscode';
import { Collection } from './collection';
import { LocalCollection } from './local_collection';
import { TTRSSCollection } from './ttrss_collection';
import { join as pathJoin } from 'path';
import { checkDir, readFile, TTRSSApiURL, walkFeedTree, writeFile } from './utils';
import { AccountList, Account } from './account';
import { FeedList, Feed } from './feeds';
import { ArticleList, Article } from './articles';
import { FavoritesList, Item } from './favorites';
import { Abstract, Summary } from './content';
import * as uuid from 'uuid';
import { StatusBar } from './status_bar';
import { InoreaderCollection } from './inoreader_collection';
import * as parser from "fast-xml-parser";
import { assert } from 'console';

export class App {
    private static _instance?: App;

    private current_account?: string;
    private current_feed?: string;
    private updating = false;

    private account_list = new AccountList();
    private feed_list = new FeedList();
    private article_list = new ArticleList();
    private favorites_list = new FavoritesList();

    private status_bar = new StatusBar();

    public collections: {[key: string]: Collection} = {};

    private constructor(
        public readonly context: vscode.ExtensionContext,
        public readonly root: string,
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
            let c: Collection;
            switch (account.type) {
                case 'local':
                    c = new LocalCollection(dir, key);
                    break;
                case 'ttrss':
                    c = new TTRSSCollection(dir, key);
                    break;
                case 'inoreader':
                    c = new InoreaderCollection(dir, key);
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
        if (this.current_account === undefined || !(this.current_account in this.collections)) {
            this.current_account = Object.keys(this.collections)[0];
        }
    }

    private async createLocalAccount(name: string) {
        const accounts = App.cfg.get<any>('accounts');
        accounts[uuid.v1()] = {
            name: name,
            type: 'local',
            feeds: [],
        };
        await App.cfg.update('accounts', accounts, true);
    }

    private async createTTRSSAccount(name: string, server: string, username: string, password: string) {
        const accounts = App.cfg.get<any>('accounts');
        accounts[uuid.v1()] = {
            name: name,
            type: 'ttrss',
            server,
            username,
            password,
        };
        await App.cfg.update('accounts', accounts, true);
    }

    private async createInoreaderAccount(name: string, appid: string, appkey: string) {
        const accounts = App.cfg.get<any>('accounts');
        accounts[uuid.v1()] = {
            name: name,
            type: 'inoreader',
            appid, appkey,
        };
        await App.cfg.update('accounts', accounts, true);
    }

    private async removeAccount(key: string) {
        const collection = this.collections[key];
        if (collection === undefined) {
            return;
        }
        await collection.clean();
        delete this.collections[key];

        const accounts = {...App.cfg.get<any>('accounts')};
        delete accounts[key];
        await App.cfg.update('accounts', accounts, true);
    }

    async init() {
        await this.initAccounts();
    }

    static async initInstance(context: vscode.ExtensionContext, root: string) {
        App._instance = new App(context, root);
        await App.instance.init();
    }

    static get instance(): App {
        return App._instance!;
    }

    static get cfg() {
        return vscode.workspace.getConfiguration('rss');
    }

    public static readonly ACCOUNT = 1;
    public static readonly FEED = 1 << 1;
    public static readonly ARTICLE = 1 << 2;
    public static readonly FAVORITES = 1 << 3;
    public static readonly STATUS_BAR = 1 << 4;

    refreshLists(list: number=0b11111) {
        if (list & App.ACCOUNT) {
            this.account_list.refresh();
        }
        if (list & App.FEED) {
            this.feed_list.refresh();
        }
        if (list & App.ARTICLE) {
            this.article_list.refresh();
        }
        if (list & App.FAVORITES) {
            this.favorites_list.refresh();
        }
        if (list & App.STATUS_BAR) {
            this.status_bar.refresh();
        }
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
        this.status_bar.init();
    }

    initCommands() {
        const commands: [string, (...args: any[]) => any][] = [
            ['rss.select', this.rss_select],
            ['rss.articles', this.rss_articles],
            ['rss.read', this.rss_read],
            ['rss.mark-read', this.rss_mark_read],
            ['rss.mark-unread', this.rss_mark_unread],
            ['rss.mark-all-read', this.rss_mark_all_read],
            ['rss.mark-account-read', this.rss_mark_account_read],
            ['rss.refresh', this.rss_refresh],
            ['rss.refresh-account', this.rss_refresh_account],
            ['rss.refresh-one', this.rss_refresh_one],
            ['rss.open-website', this.rss_open_website],
            ['rss.open-link', this.rss_open_link],
            ['rss.add-feed', this.rss_add_feed],
            ['rss.remove-feed', this.rss_remove_feed],
            ['rss.add-to-favorites', this.rss_add_to_favorites],
            ['rss.remove-from-favorites', this.rss_remove_from_favorites],
            ['rss.new-account', this.rss_new_account],
            ['rss.del-account', this.rss_del_account],
            ['rss.account-rename', this.rss_account_rename],
            ['rss.account-modify', this.rss_account_modify],
            ['rss.export-to-opml', this.rss_export_to_opml],
            ['rss.import-from-opml', this.rss_import_from_opml],
            ['rss.clean-old-articles', this.rss_clean_old_articles],
            ['rss.clean-all-old-articles', this.rss_clean_all_old_articles],
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
        this.refreshLists(App.FEED | App.ARTICLE | App.FAVORITES);
    }

    rss_articles(feed: string) {
        this.current_feed = feed;
        this.refreshLists(App.ARTICLE);
    }

    private getHTML(content: string, panel: vscode.WebviewPanel) {
        const css = '<style type="text/css">body{font-size:1em;max-width:960px;margin:auto;}</style>';

        const star_path = vscode.Uri.file(pathJoin(this.context.extensionPath, 'resources/star.svg'));
        const star_src = panel.webview.asWebviewUri(star_path);

        const web_path = vscode.Uri.file(pathJoin(this.context.extensionPath, 'resources/web.svg'));
        const web_src = panel.webview.asWebviewUri(web_path);

        let html = css + content + `
        <style>
        .float-btn {
            width: 2.2rem;
            height: 2.2rem;
            position: fixed;
            right: 0.5rem;
            z-index: 9999;
            filter: drop-shadow(0 0 0.2rem rgba(0,0,0,.5));
            transition-duration: 0.3s;
        }
        .float-btn:hover {
            filter: drop-shadow(0 0 0.2rem rgba(0,0,0,.5))
                    brightness(130%);
        }
        .float-btn:active {
            filter: drop-shadow(0 0 0.2rem rgba(0,0,0,.5))
                    brightness(80%);
        }
        </style>
        <script type="text/javascript">
        const vscode = acquireVsCodeApi();
        function star() {
            vscode.postMessage('star')
        }
        function next() {
            vscode.postMessage('next')
        }
        function web() {
            vscode.postMessage('web')
        }
        </script>
        <img src="${web_src}" title="Open link" onclick="web()" class="float-btn" style="bottom:1rem;"/>
        <img src="${star_src}" title="Add to favorites" onclick="star()" class="float-btn" style="bottom:4rem;"/>
        `;
        if (this.currCollection().getArticles('<unread>').length > 0) {
            const next_path = vscode.Uri.file(pathJoin(this.context.extensionPath, 'resources/next.svg'));
            const next_src = panel.webview.asWebviewUri(next_path);
            html += `<img src="${next_src}" title="Next" onclick="next()" class="float-btn" style="bottom:7rem;"/>`;
        }
        return html;
    }

    async rss_read(abstract: Abstract) {
        const content = await this.currCollection().getContent(abstract.id);
        const panel = vscode.window.createWebviewPanel(
            'rss', abstract.title, vscode.ViewColumn.One,
            {retainContextWhenHidden: true, enableScripts: true});

        abstract.read = true;
        panel.title = abstract.title;
        panel.webview.html = this.getHTML(content, panel);
        panel.webview.onDidReceiveMessage(async (e) => {
            if (e === 'web') {
                if (abstract.link) {
                    vscode.env.openExternal(vscode.Uri.parse(abstract.link));
                }
            } else if (e === 'star') {
                await this.currCollection().addToFavorites(abstract.id);
                this.refreshLists(App.FAVORITES);
            } else if (e === 'next') {
                const unread = this.currCollection().getArticles('<unread>');
                if (unread.length > 0) {
                    const abs = unread[0];
                    panel.dispose();
                    await this.rss_read(abs);
                }
            }
        });

        this.refreshLists();

        await this.currCollection().updateAbstract(abstract.id, abstract).commit();
    }

    async rss_mark_read(article: Article) {
        const abstract = article.abstract;
        abstract.read = true;
        this.refreshLists();

        await this.currCollection().updateAbstract(abstract.id, abstract).commit();
    }

    async rss_mark_unread(article: Article) {
        const abstract = article.abstract;
        abstract.read = false;
        this.refreshLists();

        await this.currCollection().updateAbstract(abstract.id, abstract).commit();
    }

    async rss_mark_all_read(feed?: Feed) {
        let abstracts: Abstract[];
        if (feed) {
            abstracts = this.currCollection().getArticles(feed.feed);
        } else {
            abstracts = this.currArticles();
        }
        for (const abstract of abstracts) {
            abstract.read = true;
            this.currCollection().updateAbstract(abstract.id, abstract);
        }
        this.refreshLists();

        await this.currCollection().commit();
    }

    async rss_mark_account_read(account?: Account) {
        const collection = account ?
            this.collections[account.key] : this.currCollection();
        for (const abstract of collection.getArticles('<unread>')) {
            abstract.read = true;
            collection.updateAbstract(abstract.id, abstract);
        }
        this.refreshLists();
        await collection.commit();
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
            this.refreshLists();
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
            this.refreshLists();
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
            this.refreshLists();
            this.updating = false;
        });
    }

    rss_open_website(feed: Feed) {
        vscode.env.openExternal(vscode.Uri.parse(feed.summary.link));
    }

    rss_open_link(article: Article) {
        if (article.abstract.link) {
            vscode.env.openExternal(vscode.Uri.parse(article.abstract.link));
        }
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
        await this.currCollection().addToFavorites(article.abstract.id);
        this.refreshLists(App.FAVORITES);
    }

    async rss_remove_from_favorites(item: Item) {
        await this.currCollection().removeFromFavorites(item.abstract.id);
        this.refreshLists(App.FAVORITES);
    }

    async rss_new_account() {
        const type = await vscode.window.showQuickPick(
            ['local', 'ttrss', 'inoreader'],
            {placeHolder: "Select account type"}
        );
        if (type === undefined) {return;}
        const name = await vscode.window.showInputBox({prompt: 'Enter account name'});
        if (name === undefined || name.length <= 0) {return;}

        if (type === 'local') {
            await this.createLocalAccount(name);
        } else if (type === 'ttrss') {
            const url = await vscode.window.showInputBox({prompt: 'Enter server URL(SELF_URL_PATH)'});
            if (url === undefined || url.length <= 0) {return;}
            const username = await vscode.window.showInputBox({prompt: 'Enter user name'});
            if (username === undefined || username.length <= 0) {return;}
            const password = await vscode.window.showInputBox({prompt: 'Enter password', password: true});
            if (password === undefined || password.length <= 0) {return;}
            await this.createTTRSSAccount(name, TTRSSApiURL(url), username, password);
        } else if (type === 'inoreader') {
            const custom = await vscode.window.showQuickPick(
                ['no', 'yes'],
                {placeHolder: "Using custom app ID & app key?"}
            );
            let appid, appkey;
            if (custom === 'yes') {
                appid = await vscode.window.showInputBox({prompt: 'Enter app ID'});
                if (!appid) {return;}
                appkey = await vscode.window.showInputBox({prompt: 'Enter app key', password: true});
                if (!appkey) {return;}
            } else {
                appid = '999999367';
                appkey = 'GOgPzs1RnPTok6q8kC8HgmUPji3DjspC';
            }

            await this.createInoreaderAccount(name, appid, appkey);
        }
    }

    async rss_del_account(account: Account) {
        const confirm = await vscode.window.showQuickPick(['no', 'yes'], {placeHolder: "Are you sure to delete?"});
        if (confirm !== 'yes') {
            return;
        }
        await this.removeAccount(account.key);
    }

    async rss_account_rename(account: Account) {
        const name = await vscode.window.showInputBox({prompt: 'Enter the name'});
        if (name === undefined || name.length <= 0) {return;}
        const accounts = App.cfg.get<any>('accounts');
        accounts[account.key].name = name;
        await App.cfg.update('accounts', accounts, true);
    }

    async rss_account_modify(account: Account) {
        const accounts = App.cfg.get<any>('accounts');
        if (account.type === 'ttrss') {
            const cfg = accounts[account.key] as TTRSSAccount;

            const url = await vscode.window.showInputBox({
                prompt: 'Enter server URL(SELF_URL_PATH)',
                value: cfg.server.substr(0, cfg.server.length - 4)
            });
            if (url === undefined || url.length <= 0) {return;}
            const username = await vscode.window.showInputBox({
                prompt: 'Enter user name', value: cfg.username
            });
            if (username === undefined || username.length <= 0) {return;}
            const password = await vscode.window.showInputBox({
                prompt: 'Enter password', password: true, value: cfg.password
            });
            if (password === undefined || password.length <= 0) {return;}

            cfg.server = TTRSSApiURL(url);
            cfg.username = username;
            cfg.password = password;
        } else if (account.type === 'inoreader') {
            const cfg = accounts[account.key] as InoreaderAccount;

            const appid = await vscode.window.showInputBox({
                prompt: 'Enter app ID', value: cfg.appid
            });
            if (!appid) {return;}
            const appkey = await vscode.window.showInputBox({
                prompt: 'Enter app key', password: true, value: cfg.appkey
            });
            if (!appkey) {return;}

            cfg.appid = appid;
            cfg.appkey = appkey;
        }

        await App.cfg.update('accounts', accounts, true);
    }

    async rss_export_to_opml(account: Account) {
        const collection = this.collections[account.key];
        const path = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(collection.name + '.opml')
        });
        if (!path) {
            return;
        }

        const tree = collection.getFeedList();
        const outlines: string[] = [];
        for (const feed of walkFeedTree(tree)) {
            const summary = collection.getSummary(feed);
            if (!summary) {
                continue;
            }
            outlines.push(`<outline text="${summary.title}" title="${summary.title}" type="rss" xmlUrl="${feed}" htmlUrl="${summary.link}"/>`);
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>`
                  + `<opml version="1.0">`
                  + `<head><title>${collection.name}</title></head>`
                  + `<body>${outlines.join('')}</body>`
                  + `</opml>`;

        await writeFile(path.fsPath, xml);
    }

    async rss_import_from_opml(account: Account) {
        const collection = this.collections[account.key] as LocalCollection;
        assert(collection.type === 'local');
        const paths = await vscode.window.showOpenDialog({canSelectMany: false});
        if (!paths) {
            return;
        }

        const xml = await readFile(paths[0].fsPath);
        const dom = parser.parse(xml, {
            attributeNamePrefix: "",
            ignoreAttributes: false,
            parseAttributeValue: true,
        });
        const outlines = dom.opml?.body?.outline;
        if (!outlines) {
            vscode.window.showErrorMessage("Bad OPML format");
            return;
        }
        const feeds: string[] = [];
        for (const outline of outlines) {
            const feed = outline.xmlUrl;
            if (!feed) {
                vscode.window.showErrorMessage("Bad OPML format");
                return;
            }
            feeds.push(feed as string);
        }

        await collection.addFeeds(feeds);
    }

    private async selectExpire(): Promise<number|undefined> {
        const s = ['1 month', '2 months', '3 months', '6 months'];
        const t = [1 * 30, 2 * 30, 3 * 30, 6 * 30];
        const time = await vscode.window.showQuickPick(s, {
            placeHolder: "Choose a time. Unread and favorite articles will be kept."
        });
        if (!time) {
            return undefined;
        }
        return t[s.indexOf(time)] * 86400 * 1000;
    }

    async rss_clean_old_articles(feed: Feed) {
        const exprie = await this.selectExpire();
        if (!exprie) {
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Cleaning...",
            cancellable: false
        }, async () => {
            await this.currCollection().cleanOldArticles(feed.feed, exprie);
        });
        this.refreshLists(App.ARTICLE | App.STATUS_BAR);
    }

    async rss_clean_all_old_articles(account: Account) {
        const expire = await this.selectExpire();
        if (!expire) {
            return;
        }
        const collection = this.collections[account.key];
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Cleaning...",
            cancellable: false
        }, async () => {
            await collection.cleanAllOldArticles(expire);
        });
        this.refreshLists(App.ARTICLE | App.STATUS_BAR);
    }

    initEvents() {
        const do_refresh = () => vscode.commands.executeCommand('rss.refresh', true);
        let timer = setInterval(do_refresh, App.cfg.interval * 1000);

        const disposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('rss.interval')) {
                clearInterval(timer);
                timer = setInterval(do_refresh, App.cfg.interval * 1000);
            }

            if (e.affectsConfiguration('rss.status-bar-notify') || e.affectsConfiguration('rss.status-bar-update')) {
                this.refreshLists(App.STATUS_BAR);
            }

            if (e.affectsConfiguration('rss.accounts') && !this.updating) {
                this.updating = true;
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Updating RSS...",
                    cancellable: false
                }, async () => {
                    await this.initAccounts();
                    await Promise.all(Object.values(this.collections).map(c => c.fetchAll(false)));
                    this.refreshLists();
                    this.updating = false;
                });
            }

            if (e.affectsConfiguration('rss.storage-path')) {
                const res = await vscode.window.showInformationMessage("Reload vscode to take effect", "Reload");
                if (res === "Reload") {
                    vscode.commands.executeCommand("workbench.action.reloadWindow");
                }
            }

        });
        this.context.subscriptions.push(disposable);
    }
}
