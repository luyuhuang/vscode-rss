import * as vscode from 'vscode';
import got from 'got';
import { parseXML2 } from './parser';
import { Entry, Summary, Abstract } from './content';
import { App } from './app';
import { Collection } from './collection';
import { walkFeedTree } from './utils';

export class LocalCollection extends Collection {
    private etags = new Map<string, string>();

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

    async addFeeds(feeds: string[]) {
        this.cfg.feeds.push(...feeds);
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

        let entries: Entry[];
        try {
            const cfg = App.cfg;
            const res = await got(url, {
                timeout: cfg.timeout * 1000, retry: cfg.retry, encoding: 'binary',
                headers: {
                    'If-None-Match': this.etags.get(url),
                    'Accept-Encoding': 'gzip, br',
                }
            });
            if (res.statusCode === 304) {
                return;
            }
            let etag = res.headers['etag'];
            if (etag) {
                if (Array.isArray(etag)) {
                    etag = etag[0];
                }
                this.etags.set(url, etag);
            }
            const [e, s] = parseXML2(res.body);
            entries = e;
            summary.title = s.title;
            summary.link = s.link;
            summary.ok = true;
        } catch (error) {
            vscode.window.showErrorMessage(error.toString());
            entries = [];
            summary.ok = false;
        }

        const id2abs = new Map<string, Abstract>();
        for (const entry of entries) {
            await this.updateContent(entry.id, entry.content);
            const abstract = Abstract.fromEntry(entry, url);
            const old = this.getAbstract(abstract.id);
            if (old) {
                abstract.read = old.read;
                abstract.starred = old.starred;
            }
            this.updateAbstract(abstract.id, abstract);
            id2abs.set(abstract.id, abstract);
        }

        for (const id of summary.catelog) {
            const abstract = this.getAbstract(id);
            if (abstract !== undefined && !id2abs.has(abstract.id)) {
                id2abs.set(abstract.id, abstract);
            }
        }

        summary.catelog = [...id2abs.values()]
            .sort((a, b) => b.date - a.date)
            .map(a => a.id);
        this.updateSummary(url, summary);
    }

    async fetchOne(url: string, update: boolean) {
        await this.fetch(url, update);
        await this.commit();
    }

    async fetchAll(update: boolean) {
        const feeds = [...walkFeedTree(this.cfg.feeds)];
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

