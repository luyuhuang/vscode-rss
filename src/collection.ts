import * as vscode from 'vscode';
import { join as pathJoin } from 'path';
import { Summary, Abstract, Storage } from './content';
import { App } from './app';
import { checkDir, writeFile, readFile, removeFile, removeDir, readDir } from './utils';

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
    abstract addFeed(feed: string): Promise<void>;
    abstract delFeed(feed: string): Promise<void>;
    abstract addToFavorites(id: string): Promise<void>;
    abstract removeFromFavorites(id: string): Promise<void>;

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

    async cleanAllOldArticles(expire: number) {
        for (const feed in this.summaries) {
            await this.cleanOldArticles(feed, expire);
        }
    }

    async cleanOldArticles(feed: string, expire: number) {
        const summary = this.getSummary(feed);
        if (!summary) {
            return;
        }
        this.dirty_summaries.add(feed);

        const now = new Date().getTime();
        for (let i = summary.catelog.length - 1; i >= 0; --i) {
            const id = summary.catelog[i];
            const abs = this.getAbstract(id);
            if (abs && now - abs.date <= expire) { // remaining articles is not expired, break
                break;
            }
            if (!abs || (abs.read && !abs.starred)) {
                summary.catelog.splice(i, 1);
                delete this.abstracts[id];
                await removeFile(pathJoin(this.dir, 'articles', id.toString()));
            }
        }
        await this.commit();
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
        const file = pathJoin(this.dir, 'articles', id.toString());
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
        const file = pathJoin(this.dir, 'articles', id.toString());
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
        await removeDir(this.dir);
    }

    abstract fetchAll(update: boolean): Promise<void>;
    abstract fetchOne(url: string, update: boolean): Promise<void>;

}
