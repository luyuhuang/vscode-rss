import * as vscode from 'vscode';
import { join as pathJoin } from 'path';
import got from 'got';
import { parseXML } from './parser';
import { Entry, Summary, Abstract, Feed, Article } from './content';
import { App } from './app';
import { checkDir, writeFile, readFile, removeFile } from './utils';

export abstract class Collection {
    private summaries: {[url: string]: Summary} = {};
    private abstracts: {[link: string]: Abstract} = {};
    private dirty_summaries = new Map<string, 'add' | 'up' | 'del'>();
    private dirty_abstracts = new Map<string, 'add' | 'up' | 'del'>();

    constructor(
        protected dir: string,
        protected account: string
    ) {}

    async init() {
        await checkDir(this.dir);
        const feeds = await App.db.all<Feed[]>('select * from feeds where account = ?', this.account);
        for (const feed of feeds) {
            const articles = await App.db.all<Article[]>('select * from articles where account = ? and feed = ? order by date desc', this.account, feed.feed);
            const summary = Summary.fromFeed(feed);
            for (const article of articles) {
                summary.catelog.push(article.link);
                this.abstracts[article.link] = Abstract.fromArticle(article);
            }
            this.summaries[feed.feed] = summary;
        }
    }

    protected get cfg() {
        return vscode.workspace.getConfiguration('rss').accounts[this.account];
    }

    protected async updateCfg() {
        const cfg = vscode.workspace.getConfiguration('rss');
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

    getFeeds() {
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

    getFavorites() {
        return this.cfg.favorites;
    }

    async getContent(link: string) {
        const file = pathJoin(this.dir, encodeURIComponent(link));
        try {
            return await readFile(file);
        } catch (error) {
            vscode.window.showErrorMessage(error.toString());
            throw error;
        }
    }

    updateAbstract(link: string, abstract?: Abstract) {
        if (abstract === undefined) {
            if (this.getAbstract(link) !== undefined) {
                this.dirty_abstracts.set(link, 'del');
                delete this.abstracts[link];
            }
        } else {
            if (this.getAbstract(link) === undefined) {
                this.dirty_abstracts.set(link, 'add');
            } else {
                this.dirty_abstracts.set(link, 'up');
            }
            this.abstracts[link] = abstract;
        }
        return this;
    }

    updateSummary(feed: string, summary?: Summary) {
        if (summary === undefined) {
            if (this.getSummary(feed) !== undefined) {
                this.dirty_summaries.set(feed, 'del');
                delete this.summaries[feed];
            }
        } else {
            if (this.getSummary(feed) === undefined) {
                this.dirty_summaries.set(feed, 'add');
            } else {
                this.dirty_summaries.set(feed, 'up');
            }
            this.summaries[feed] = summary;
        }
        return this;
    }

    async updateContent(link: string, content: string | undefined) {
        const file = pathJoin(this.dir, encodeURIComponent(link));
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
        for (const [feed, op] of this.dirty_summaries) {
            const summary = this.getSummary(feed)!;
            if (op === 'add') {
                await App.db.run('insert into feeds values(?,?,?,?,?)',
                                 feed, this.account,
                                 summary.link, summary.title, summary.ok);
            } else if (op === 'up') {
                await App.db.run('update feeds set link = ?, title = ?, ok = ? '+
                                 'where feed = ? and account = ?',
                                 summary.link, summary.title, summary.ok,
                                 feed, this.account);
            } else if (op === 'del') {
                await App.db.run('delete from feeds where feed = ? and account = ?',
                                 feed, this.account);
            }
        }
        this.dirty_summaries.clear();

        for (const [link, op] of this.dirty_abstracts) {
            const abstract = this.getAbstract(link)!;
            if (op === 'add') {
                await App.db.run('insert into articles values(?,?,?,?,?,?)',
                                 link, abstract.feed, this.account,
                                 abstract.title, abstract.date, abstract.read);
            } else if (op === 'up') {
                await App.db.run('update articles set title = ?, date = ?, read = ? '+
                                 'where link = ? and feed = ? and account = ?',
                                 abstract.title, abstract.date, abstract.read,
                                 link, abstract.feed, this.account);
            } else if (op === 'del') {
                await App.db.run('delete from articles where link = ? and account = ?',
                                 link, this.account);
            }
        }
        this.dirty_abstracts.clear();
    }

    abstract async fetch(url: string, update: boolean): Promise<void>;
    abstract async fetchAll(update: boolean): Promise<void>;
    abstract async fetchOne(url: string, update: boolean): Promise<void>;

}

export class LocalCollection extends Collection {
    async addFeed(feed: string) {
        this.cfg.feeds.push(feed);
        await this.updateCfg();
    }

    async delFeed(feed: string) {
        this.cfg.feeds.splice(this.cfg.feeds.indexOf(feed), 1);
        await this.updateCfg();
    }

    async fetch(url: string, update: boolean) {
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
            const cfg = vscode.workspace.getConfiguration('rss');
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
    addFeed(feed: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    delFeed(feed: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    async fetch(url: string, update: boolean) {
    }
    async fetchOne(url: string, update: boolean) {
    }
    async fetchAll(update: boolean) {
    }
}
