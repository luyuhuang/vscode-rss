import * as vscode from 'vscode';
import { join as pathJoin } from 'path';
import got from 'got';
import { parseXML } from './parser';
import { Entry, Summary, Abstract, Storage } from './content';
import { App } from './app';
import { checkDir, writeFile, readFile, removeFile, removeDir, fileExists, readDir } from './utils';

export abstract class Collection {
    private summaries: {[url: string]: Summary} = {};
    private abstracts: {[link: string]: Abstract} = {};
    protected dirty_summaries = new Set<string>();

    constructor(
        protected dir: string,
        protected account: string
    ) {}

    async init() {
        await checkDir(this.dir);
        await checkDir(pathJoin(this.dir, 'feeds'));
        await checkDir(pathJoin(this.dir, 'articles'));
        const feeds = await readDir(pathJoin(this.dir, 'feeds'));
        for (const feed of feeds) {
            const json = await readFile(pathJoin(this.dir, 'feeds', feed));
            const [url, summary] = Storage.fromJSON(json).toSummary((link, abstract) => {this.abstracts[link] = abstract;});
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

    abstract async addFeed(feed: string): Promise<void>;
    abstract async delFeed(feed: string): Promise<void>;

    async addToFavorites(link: string, index: number) {
        const list = this.cfg.favorites[index].list;
        if (list.indexOf(link) < 0) {
            list.push(link);
            await this.updateCfg();
        }
    }

    async removeFromFavorites(link: string, index: number) {
        const list = this.cfg.favorites[index].list;
        list.splice(list.indexOf(link), 1);
        await this.updateCfg();
    }

    getSummary(url: string): Summary | undefined {
        return this.summaries[url];
    }

    getAbstract(link: string): Abstract | undefined {
        return this.abstracts[link];
    }

    getFeedList(): string[] {
        return Object.keys(this.summaries);
    }

    protected getFeeds() {
        return Object.keys(this.summaries);
    }

    getArticles(feed: string) {
        const summary = this.getSummary(feed);
        const list: Abstract[] = [];
        if (summary !== undefined) {
            for (const link of summary.catelog) {
                const abstract = this.getAbstract(link);
                if (abstract) {
                    list.push(abstract);
                }
            }
        }
        return list;
    }

    getFavorites(): Favorites[] {
        return this.cfg.favorites;
    }

    async getContent(link: string) {
        const file = pathJoin(this.dir, 'articles', encodeURIComponent(link));
        try {
            return await readFile(file);
        } catch (error) {
            vscode.window.showErrorMessage(error.toString());
            throw error;
        }
    }

    updateAbstract(link: string, abstract?: Abstract) {
        if (abstract === undefined) {
            const old = this.getAbstract(link);
            if (old) {
                this.dirty_summaries.add(old.feed);
                delete this.abstracts[link];
            }
        } else {
            this.dirty_summaries.add(abstract.feed);
            this.abstracts[link] = abstract;
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

    async updateContent(link: string, content: string | undefined) {
        const file = pathJoin(this.dir, 'articles', encodeURIComponent(link));
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
        for (const link of summary.catelog) {
            this.updateAbstract(link, undefined);
            await this.updateContent(link, undefined);
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
                const json = Storage.fromSummary(feed, summary, link => this.abstracts[link]).toJSON();
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
    protected get cfg(): LocalAccount {
        return super.cfg as LocalAccount;
    }

    getFeedList(): string[] {
        return this.cfg.feeds;
    }

    async addFeed(feed: string) {
        this.cfg.feeds.push(feed);
        await this.updateCfg();
    }

    async delFeed(feed: string) {
        this.cfg.feeds.splice(this.cfg.feeds.indexOf(feed), 1);
        await this.updateCfg();
    }

    private async fetch(url: string, update: boolean) {
        const summary = this.getSummary(url) || new Summary(url, url, [], false);
        if (!update && summary.ok) {
            return;
        }

        const abstracts: Abstract[] = [];
        for (const link of summary.catelog) {
            const abstract = this.getAbstract(link);
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
            await this.updateContent(entry.link, entry.content);
            const abstract = Abstract.fromEntry(entry, url);
            this.updateAbstract(abstract.link, abstract);
            abstracts.push(abstract);
        }

        abstracts.sort((a, b) => b.date - a.date);
        summary.catelog = abstracts.map(a => a.link);
        this.updateSummary(url, summary);
    }

    async fetchOne(url: string, update: boolean) {
        await this.fetch(url, update);
        await this.commit();
    }

    async fetchAll(update: boolean) {
        const feeds = this.cfg.feeds as string[];
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
    private feed_list: string[] = [];

    protected get cfg(): TTRSSAccount {
        return super.cfg as TTRSSAccount;
    }

    async init() {
        const path = pathJoin(this.dir, 'feed_list');
        if (await fileExists(path)) {
            this.feed_list = JSON.parse(await readFile(path));
        }
        await super.init();
    }

    getFeedList(): string[] {
        if (this.feed_list.length > 0) {
            return this.feed_list;
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

    private async _addFeed(feed: string) {
        if (this.getSummary(feed) !== undefined) {
            vscode.window.showInformationMessage('Feed already exists');
            return;
        }
        if (this.session_id === undefined) {
            await this.login();
        }
        const res = await got({
            url: this.cfg.server,
            method: 'POST',
            json: {
                op: 'subscribeToFeed',
                sid: this.session_id,
                feed_url: feed,
            },
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry
        });
        const response = JSON.parse(res.body);
        if (response.status !== 0) {
            if (response.content.error === 'NOT_LOGGED_IN') {
                this.session_id = undefined;
                await this._addFeed(feed);
                return;
            } else {
                throw Error(`Add feed failed: ${response.content.error}`);
            }
        }
        await got({
            url: this.cfg.server,
            method: 'POST',
            json: {
                op: 'updateFeed',
                sid: this.session_id,
                feed_id: response.content.status.feed_id,
            },
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry
        });
        await this._fetchAll(false);
        App.instance.refreshLists();
    }

    async addFeed(feed: string) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            try {
                await this._addFeed(feed);
            } catch (error) {
                vscode.window.showErrorMessage(error.toString());
            }
        });
    }

    async _delFeed(feed: string) {
        const summary = this.getSummary(feed);
        if (summary === undefined) {
            return;
        }
        if (this.session_id === undefined) {
            await this.login();
        }
        const res = await got({
            url: this.cfg.server,
            method: 'POST',
            json: {
                op: 'unsubscribeFeed',
                sid: this.session_id,
                feed_id: summary.feed_id,
            },
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry
        });
        const response = JSON.parse(res.body);
        if (response.status !== 0) {
            if (response.content.error === 'NOT_LOGGED_IN') {
                this.session_id = undefined;
                await this._delFeed(feed);
                return;
            } else {
                throw Error(`Delete feed failed: ${response.content.error}`);
            }
        }
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
                vscode.window.showErrorMessage(error.toString());
            }
        });
    }

    private async fetch(url: string, update: boolean) {
        const summary = this.getSummary(url);
        if (summary === undefined || summary.feed_id === undefined) {
            throw Error('Feed dose not exist');
        }
        if (!update && summary.ok) {
            return;
        }

        if (this.session_id === undefined) {
            await this.login();
        }
        const res = await got({
            url: this.cfg.server,
            method: 'POST',
            json: {
                op: 'getHeadlines',
                sid: this.session_id,
                feed_id: summary.feed_id,
            },
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry
        });
        const response = JSON.parse(res.body);
        if (response.status !== 0) {
            if (response.content.error === 'NOT_LOGGED_IN') {
                this.session_id = undefined;
                await this.fetch(url, update);
                return;
            } else {
                throw Error(`Get feeds failed: ${response.content.error}`);
            }
        }
        const headlines = response.content as any[];
        const abstracts = [];
        for (const h of headlines) {
            const abstract = new Abstract(h.title, h.updated * 1000, h.link, !h.unread, url, h.id);
            abstracts.push(abstract);
            this.updateAbstract(abstract.link, abstract);
        }
        abstracts.sort((a, b) => b.date - a.date);
        summary.ok = true;
        summary.catelog = abstracts.map(a => a.link);
        this.updateSummary(url, summary);
    }

    private async requestArticle(article_id: number): Promise<string> {
        if (this.session_id === undefined) {
            await this.login();
        }
        const res = await got({
            url: this.cfg.server,
            method: 'POST',
            json: {
                op: 'getArticle',
                sid: this.session_id,
                article_id
            },
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry
        });
        const response = JSON.parse(res.body);
        if (response.status !== 0) {
            if (response.content.error === 'NOT_LOGGED_IN') {
                this.session_id = undefined;
                return await this.requestArticle(article_id);
            } else {
                throw Error(`Get feeds failed: ${response.content.error}`);
            }
        }
        return response.content[0].content;
    }

    async getContent(link: string) {
        if (!await fileExists(pathJoin(this.dir, encodeURIComponent(link)))) {
            const abstract = this.getAbstract(link)!;
            const content = await this.requestArticle(abstract.article_id!);
            await this.updateContent(link, content);
            return content;
        } else {
            return await super.getContent(link);
        }
    }

    private async _fetchAll(update: boolean) {
        if (this.session_id === undefined) {
            await this.login();
        }
        const res = await got({
            url: this.cfg.server,
            method: 'POST',
            json: {
                op: 'getFeeds',
                sid: this.session_id
            },
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry
        });
        const response = JSON.parse(res.body);
        if (response.status !== 0) {
            if (response.content.error === 'NOT_LOGGED_IN') {
                this.session_id = undefined;
                await this._fetchAll(update);
                return;
            } else {
                throw Error(`Get feeds failed: ${response.content.error}`);
            }
        }
        this.feed_list = response.content.map((feed: any) => feed.feed_url);
        const feeds = new Set<string>(this.feed_list);
        for (const feed of this.getFeeds()) {
            if (!feeds.has(feed)) {
                this.updateSummary(feed, undefined);
            }
        }
        for (const feed of response.content) {
            let summary = this.getSummary(feed.feed_url);
            if (summary) {
                summary.title = feed.title;
                summary.feed_id = feed.id;
            } else {
                summary = new Summary(feed.feed_url, feed.title, [], false, feed.id);
            }
            this.updateSummary(feed.feed_url, summary);
        }
        await Promise.all(this.getFeeds().map(url => this.fetch(url, update)));
        await this.commit();
    }

    async fetchOne(url: string, update: boolean) {
        try {
            await this.fetch(url, update);
            await this.commit();
        } catch (error) {
            vscode.window.showErrorMessage(error.toString());
        }
    }

    async fetchAll(update: boolean) {
        try {
            await this._fetchAll(update);
        } catch (error) {
            vscode.window.showErrorMessage(error.toString());
        }
    }

    updateAbstract(link: string, abstract?: Abstract) {
        this.dirty_abstracts.add(link);
        return super.updateAbstract(link, abstract);
    }

    private async syncReadStatus(list: number[], read: boolean) {
        if (list.length <= 0) {
            return;
        }
        if (this.session_id === undefined) {
            await this.login();
        }
        const res = await got({
            url: this.cfg.server,
            method: 'POST',
            json: {
                op: 'updateArticle',
                sid: this.session_id,
                article_ids: list.join(','),
                mode: Number(!read),
                field: 2,
            },
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry
        });
        let response = JSON.parse(res.body);
        if (response.status !== 0) {
            if (response.content.error === 'NOT_LOGGED_IN') {
                this.session_id = undefined;
                await this.syncReadStatus(list, read);
                return;
            } else {
                throw Error(`Sync read status failed: ${response.content.error}`);
            }
        }
    }

    async commit() {
        const read_list: number[] = [];
        const unread_list: number[] = [];
        for (const link of this.dirty_abstracts) {
            const abstract = this.getAbstract(link);
            if (abstract) {
                if (abstract.read) {
                    read_list.push(abstract.article_id!);
                } else {
                    unread_list.push(abstract.article_id!);
                }
            }
        }
        this.dirty_abstracts.clear();
        try {
            await this.syncReadStatus(read_list, true);
            await this.syncReadStatus(unread_list, false);
        } catch (error) {
            vscode.window.showErrorMessage(error.toString());
        }

        await writeFile(pathJoin(this.dir, 'feed_list'), JSON.stringify(this.feed_list));
        await super.commit();
    }
}
