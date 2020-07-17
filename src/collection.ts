import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import { join as pathJoin } from 'path';
import got from 'got';
import { parseXML } from './parser';
import { Entry, Summary, Abstract, Storage } from './content';
import { App } from './app';
import { checkDir, writeFile, readFile, removeFile, removeDir, fileExists, readDir } from './utils';

export abstract class Collection {
    private summaries: {[url: string]: Summary} = {};
    private abstracts: {[id: string]: Abstract} = {};
    protected dirty_summaries = new Set<string>();

    constructor(
        protected dir: string,
        public readonly account: string
    ) {}

    async init() {
        await checkDir(this.dir);
        await checkDir(pathJoin(this.dir, 'feeds'));
        await checkDir(pathJoin(this.dir, 'articles'));
        const feeds = await readDir(pathJoin(this.dir, 'feeds'));
        for (const feed of feeds) {
            const json = await readFile(pathJoin(this.dir, 'feeds', feed));
            const [url, summary] = Storage.fromJSON(json).toSummary((id, abstract) => {this.abstracts[id] = abstract;});
            this.summaries[url] = summary;
        }
    }

    protected get cfg(): Account {
        return App.cfg.accounts[this.account];
    }

    public get name() {
        return this.cfg.name;
    }

    protected async updateCfg() {
        const cfg = App.cfg;
        await cfg.update('accounts', cfg.accounts, true);
    }

    abstract get type(): string;
    abstract async addFeed(feed: string): Promise<void>;
    abstract async delFeed(feed: string): Promise<void>;
    abstract async addToFavorites(id: string): Promise<void>;
    abstract async removeFromFavorites(id: string): Promise<void>;

    getSummary(url: string): Summary | undefined {
        return this.summaries[url];
    }

    getAbstract(id: string): Abstract | undefined {
        return this.abstracts[id];
    }

    getFeedList(): FeedTree {
        return Object.keys(this.summaries);
    }

    getArticleList(): string[] {
        return Object.keys(this.abstracts);
    }

    protected getFeeds() {
        return Object.keys(this.summaries);
    }

    getArticles(feed: string): Abstract[] {
        if (feed === '<unread>') {
            const list = Object.values(this.abstracts).filter(a => !a.read);
            list.sort((a, b) => b.date - a.date);
            return list;
        } else {
            const summary = this.getSummary(feed);
            const list: Abstract[] = [];
            if (summary !== undefined) {
                for (const id of summary.catelog) {
                    const abstract = this.getAbstract(id);
                    if (abstract) {
                        list.push(abstract);
                    }
                }
            }
            return list;
        }
    }

    getFavorites() {
        const list: Abstract[] = [];
        for (const abstract of Object.values(this.abstracts)) {
            if (abstract.starred) {
                list.push(abstract);
            }
        }
        return list;
    }

    async getContent(id: string) {
        const file = pathJoin(this.dir, 'articles', encodeURIComponent(id));
        try {
            return await readFile(file);
        } catch (error) {
            vscode.window.showErrorMessage(error.toString());
            throw error;
        }
    }

    updateAbstract(id: string, abstract?: Abstract) {
        if (abstract === undefined) {
            const old = this.getAbstract(id);
            if (old) {
                this.dirty_summaries.add(old.feed);
                delete this.abstracts[id];
            }
        } else {
            this.dirty_summaries.add(abstract.feed);
            this.abstracts[id] = abstract;
        }
        return this;
    }

    updateSummary(feed: string, summary?: Summary) {
        if (summary === undefined) {
            delete this.summaries[feed];
        } else {
            this.summaries[feed] = summary;
        }
        this.dirty_summaries.add(feed);
        return this;
    }

    async updateContent(id: string, content: string | undefined) {
        const file = pathJoin(this.dir, 'articles', encodeURIComponent(id));
        if (content === undefined) {
            await removeFile(file);
        } else {
            await writeFile(file, content);
        }
    }

    async removeSummary(url: string) {
        const summary = this.summaries[url];
        if (!summary) {
            return;
        }
        this.updateSummary(url, undefined);
        for (const id of summary.catelog) {
            this.updateAbstract(id, undefined);
            await this.updateContent(id, undefined);
        }
        return this;
    }

    async commit() {
        for (const feed of this.dirty_summaries) {
            const summary = this.getSummary(feed);
            const path = pathJoin(this.dir, 'feeds', encodeURIComponent(feed));
            if (summary === undefined) {
                await removeFile(path);
            } else {
                const json = Storage.fromSummary(feed, summary, id => this.abstracts[id]).toJSON();
                await writeFile(path, json);
            }
        }
        this.dirty_summaries.clear();
    }

    async clean() {
        for (const feed in this.summaries) {
            await this.removeSummary(feed);
        }
        await this.commit();
        await removeDir(pathJoin(this.dir, 'feeds'));
        await removeDir(pathJoin(this.dir, 'articles'));
        await removeDir(this.dir);
    }

    abstract async fetchAll(update: boolean): Promise<void>;
    abstract async fetchOne(url: string, update: boolean): Promise<void>;

}

export class LocalCollection extends Collection {
    get type() {
        return 'local';
    }

    protected get cfg(): LocalAccount {
        return super.cfg as LocalAccount;
    }

    getFeedList(): FeedTree {
        return this.cfg.feeds;
    }

    private async addToTree(tree: FeedTree, feed: string) {
        const categories: Category[] = [];
        for (const item of tree) {
            if (typeof(item) !== 'string') {
                categories.push(item);
            }
        }
        if (categories.length > 0) {
            const choice = await vscode.window.showQuickPick([
                '.', ...categories.map(c => c.name)
            ], {placeHolder: 'Select a category'});
            if (choice === undefined) {
                return;
            } else if (choice === '.') {
                tree.push(feed);
            } else {
                const caty = categories.find(c => c.name === choice)!;
                await this.addToTree(caty.list, feed);
            }
        } else {
            tree.push(feed);
        }
    }

    async addFeed(feed: string) {
        await this.addToTree(this.cfg.feeds, feed);
        await this.updateCfg();
    }

    private deleteFromTree(tree: FeedTree, feed: string) {
        for (const [i, item] of tree.entries()) {
            if (typeof(item) === 'string') {
                if (item === feed) {
                    tree.splice(i, 1);
                    break;
                }
            } else {
                this.deleteFromTree(item.list, feed);
            }
        }
    }

    async delFeed(feed: string) {
        this.deleteFromTree(this.cfg.feeds, feed);
        await this.updateCfg();
    }

    async addToFavorites(id: string) {
        const abstract = this.getAbstract(id);
        if (abstract) {
            abstract.starred = true;
            this.updateAbstract(id, abstract);
            await this.commit();
        }
    }

    async removeFromFavorites(id: string) {
        const abstract = this.getAbstract(id);
        if (abstract) {
            abstract.starred = false;
            this.updateAbstract(id, abstract);
            await this.commit();
        }
    }

    private async fetch(url: string, update: boolean) {
        const summary = this.getSummary(url) || new Summary(url, url, [], false);
        if (!update && summary.ok) {
            return;
        }

        const abstracts: Abstract[] = [];
        for (const id of summary.catelog) {
            const abstract = this.getAbstract(id);
            if (abstract !== undefined) {
                abstracts.push(abstract);
            }
        }

        let entries: Entry[];
        try {
            const cfg = App.cfg;
            const res = await got(url, {timeout: cfg.timeout * 1000, retry: cfg.retry, encoding: 'binary'});
            const [e, s] = parseXML(res.body, new Set(summary.catelog));
            entries = e;
            summary.title = s.title;
            summary.link = s.link;
            summary.ok = true;
        } catch (error) {
            vscode.window.showErrorMessage(error.toString());
            entries = [];
            summary.ok = false;
        }

        for (const entry of entries) {
            await this.updateContent(entry.id, entry.content);
            const abstract = Abstract.fromEntry(entry, url);
            this.updateAbstract(abstract.id, abstract);
            abstracts.push(abstract);
        }

        abstracts.sort((a, b) => b.date - a.date);
        summary.catelog = abstracts.map(a => a.id);
        this.updateSummary(url, summary);
    }

    async fetchOne(url: string, update: boolean) {
        await this.fetch(url, update);
        await this.commit();
    }

    private *walkFeedTree(tree: FeedTree): Generator<string> {
        for (const item of tree) {
            if (typeof(item) === 'string') {
                yield item;
            } else {
                for (const feed of this.walkFeedTree(item.list)) {
                    yield feed;
                }
            }
        }
    }

    async fetchAll(update: boolean) {
        const feeds = [...this.walkFeedTree(this.cfg.feeds)];
        await Promise.all(feeds.map(feed => this.fetch(feed, update)));
        const feed_set = new Set(feeds);
        for (const feed of this.getFeeds()) {
            if (!feed_set.has(feed)) {
                await this.removeSummary(feed);
            }
        }
        await this.commit();
    }
}

export class TTRSSCollection extends Collection {
    private session_id?: string;
    private dirty_abstracts = new Set<string>();
    private feed_tree: FeedTree = [];

    get type() {
        return 'ttrss';
    }

    protected get cfg(): TTRSSAccount {
        return super.cfg as TTRSSAccount;
    }

    async init() {
        const path = pathJoin(this.dir, 'feed_list');
        if (await fileExists(path)) {
            this.feed_tree = JSON.parse(await readFile(path));
        }
        await super.init();
    }

    getFeedList(): FeedTree {
        if (this.feed_tree.length > 0) {
            return this.feed_tree;
        } else {
            return super.getFeedList();
        }
    }

    private async login() {
        const cfg = this.cfg;
        const res = await got({
            url: cfg.server,
            method: 'POST',
            json: {
                op: "login",
                user: cfg.username,
                password: cfg.password,
            },
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry,
        });
        const response = JSON.parse(res.body);
        if (response.status !== 0) {
            throw Error(`Login failed: ${response.content.error}`);
        }
        this.session_id = response.content.session_id;
    }

    private async request(req: {[key: string]: any}): Promise<any> {
        if (this.session_id === undefined) {
            await this.login();
        }
        const res = await got({
            url: this.cfg.server,
            method: 'POST',
            json: {
                sid: this.session_id,
                ...req
            },
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry
        });
        const response = JSON.parse(res.body);
        if (response.status !== 0) {
            if (response.content.error === 'NOT_LOGGED_IN') {
                this.session_id = undefined;
                return this.request(req);
            } else {
                throw Error(response.content.error);
            }
        }
        return response;
    }

    private async _addFeed(feed: string, category_id: number) {
        if (this.getSummary(feed) !== undefined) {
            vscode.window.showInformationMessage('Feed already exists');
            return;
        }
        const response = await this.request({
            op: 'subscribeToFeed', feed_url: feed, category_id
        });
        await this.request({op: 'updateFeed', feed_id: response.content.status.feed_id});
        await this._fetchAll(false);
        App.instance.refreshLists();
    }

    private async selectCategory(id: number, tree: FeedTree): Promise<number | undefined> {
        const categories: Category[] = [];
        for (const item of tree) {
            if (typeof(item) !== 'string') {
                categories.push(item);
            }
        }
        if (categories.length > 0) {
            const choice = await vscode.window.showQuickPick([
                '.', ...categories.map(c => c.name)
            ], {placeHolder: 'Select a category'});
            if (choice === undefined) {
                return undefined;
            } else if (choice === '.') {
                return id;
            } else {
                const caty = categories.find(c => c.name === choice)!;
                return this.selectCategory(caty.custom_data, caty.list);
            }
        } else {
            return id;
        }
    }

    async addFeed(feed: string) {
        const category_id = await this.selectCategory(0, this.feed_tree);
        if (category_id === undefined) {
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            try {
                await this._addFeed(feed, category_id);
            } catch (error) {
                vscode.window.showErrorMessage('Add feed failed: ' + error.toString());
            }
        });
    }

    async _delFeed(feed: string) {
        const summary = this.getSummary(feed);
        if (summary === undefined) {
            return;
        }
        await this.request({op: 'unsubscribeFeed', feed_id: summary.custom_data});
        await this._fetchAll(false);
        App.instance.refreshLists();
    }

    async delFeed(feed: string) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            try {
                await this._delFeed(feed);
            } catch (error) {
                vscode.window.showErrorMessage('Remove feed failed: ' + error.toString());
            }
        });
    }

    async addToFavorites(id: string) {
        const abstract = this.getAbstract(id);
        if (abstract) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Syncing...",
                cancellable: false
            }, async () => {
                await this.request({
                    op: "updateArticle",
                    article_ids: `${abstract.custom_data}`,
                    field: 0,
                    mode: 1,
                });
                abstract.starred = true;
                this.updateAbstract(id, abstract);
                await this.commit();
            });
        }
    }

    async removeFromFavorites(id: string) {
        const abstract = this.getAbstract(id);
        if (abstract) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Syncing...",
                cancellable: false
            }, async () => {
                await this.request({
                    op: "updateArticle",
                    article_ids: `${abstract.custom_data}`,
                    field: 0,
                    mode: 0,
                });
                abstract.starred = false;
                this.updateAbstract(id, abstract);
                await this.commit();
            });
        }
    }

    private async fetch(url: string, update: boolean) {
        const summary = this.getSummary(url);
        if (summary === undefined || summary.custom_data === undefined) {
            throw Error('Feed dose not exist');
        }
        if (!update && summary.ok) {
            return;
        }

        const response = await this.request({
            op: 'getHeadlines',
            feed_id: summary.custom_data,
            view_mode: App.cfg.get('fetch-unread-only') ? 'unread': 'all_articles',
        });
        const headlines = response.content as any[];
        const abstracts: Abstract[] = [];
        const ids = new Set<string>();
        for (const h of headlines) {
            const abstract = new Abstract(h.id, h.title, h.updated * 1000, h.link,
                                         !h.unread, url, h.marked, h.id);
            abstracts.push(abstract);
            ids.add(abstract.id);
            this.updateAbstract(abstract.id, abstract);
        }

        for (const id of summary.catelog) {
            if (!ids.has(id)) {
                const abstract = this.getAbstract(id);
                if (abstract) {
                    abstracts.push(abstract);
                }
            }
        }

        abstracts.sort((a, b) => b.date - a.date);
        summary.catelog = abstracts.map(a => a.id);
        this.updateSummary(url, summary);
    }

    async getContent(id: string) {
        if (!await fileExists(pathJoin(this.dir, 'articles', encodeURIComponent(id)))) {
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Fetching content...",
                cancellable: false
            }, async () => {
                try {
                    const abstract = this.getAbstract(id)!;
                    const response = await this.request({
                        op: 'getArticle', article_id: abstract.custom_data
                    });
                    const content = response.content[0].content;
                    const $ = cheerio.load(content);
                    $('script').remove();
                    const html = $.html();
                    await this.updateContent(id, html);
                    return html;
                } catch (error) {
                    vscode.window.showErrorMessage('Fetch content failed: ' + error.toString());
                    throw error;
                }
            });
        } else {
            return await super.getContent(id);
        }
    }

    private async _fetchAll(update: boolean) {
        const res1 = await this.request({op: 'getFeedTree'});
        const res2 = await this.request({op: 'getFeeds', cat_id: -3});
        const list: any[] = res2.content;
        const feed_map = new Map(list.map(
            (feed: any): [number, string] => [feed.id, feed.feed_url]
        ));
        const feeds = new Set(feed_map.values());

        const walk = (node: any[]) => {
            const list: FeedTree = [];
            for (const item of node) {
                if (item.type === 'category') {
                    if (item.bare_id < 0) {
                        continue;
                    }
                    const sub = walk(item.items);
                    if (item.bare_id === 0) {
                        list.push(...sub);
                    } else {
                        list.push({
                            name: item.name,
                            list: sub,
                            custom_data: item.bare_id
                        });
                    }
                } else {
                    const feed = feed_map.get(item.bare_id);
                    if (feed === undefined) {
                        continue;
                    }
                    list.push(feed);
                    let summary = this.getSummary(feed);
                    if (summary) {
                        summary.ok = item.error.length <= 0;
                        summary.title = item.name;
                        summary.custom_data = item.bare_id;
                    } else {
                        summary = new Summary(feed, item.name, [], true, item.bare_id);
                    }
                    this.updateSummary(feed, summary);
                }
            }
            return list;
        };
        this.feed_tree = walk(res1.content.categories.items);

        for (const feed of this.getFeeds()) {
            if (!feeds.has(feed)) {
                this.updateSummary(feed, undefined);
            }
        }
        await Promise.all(this.getFeeds().map(url => this.fetch(url, update)));
        await this.commit();
    }

    async fetchOne(url: string, update: boolean) {
        try {
            if (update) {
                const summary = this.getSummary(url);
                if (summary === undefined || summary.custom_data === undefined) {
                    throw Error('Feed dose not exist');
                }
                await this.request({op: 'updateFeed', feed_id: summary.custom_data});
            }
            await this.fetch(url, update);
            await this.commit();
        } catch (error) {
            vscode.window.showErrorMessage('Update feed failed: ' + error.toString());
        }
    }

    async fetchAll(update: boolean) {
        try {
            await this._fetchAll(update);
        } catch (error) {
            vscode.window.showErrorMessage('Update feeds failed: ' + error.toString());
        }
    }

    updateAbstract(id: string, abstract?: Abstract) {
        this.dirty_abstracts.add(id);
        return super.updateAbstract(id, abstract);
    }

    private async syncReadStatus(list: number[], read: boolean) {
        if (list.length <= 0) {
            return;
        }
        await this.request({
            op: 'updateArticle',
            article_ids: list.join(','),
            mode: Number(!read),
            field: 2,
        });
    }

    async commit() {
        const read_list: number[] = [];
        const unread_list: number[] = [];
        for (const id of this.dirty_abstracts) {
            const abstract = this.getAbstract(id);
            if (abstract) {
                if (abstract.read) {
                    read_list.push(abstract.custom_data);
                } else {
                    unread_list.push(abstract.custom_data);
                }
            }
        }
        this.dirty_abstracts.clear();
        try {
            await this.syncReadStatus(read_list, true);
            await this.syncReadStatus(unread_list, false);
        } catch (error) {
            vscode.window.showErrorMessage('Sync read status failed: ' + error.toString());
        }

        await writeFile(pathJoin(this.dir, 'feed_list'), JSON.stringify(this.feed_tree));
        await super.commit();
    }

    async clean() {
        await super.clean();
        await removeFile(pathJoin(this.dir, 'feed_list'));
        await removeDir(this.dir);
    }
}
