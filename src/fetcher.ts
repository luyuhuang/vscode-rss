import * as path from 'path';
import * as vscode from 'vscode';
import got from 'got';
import { Entry, Summary, Abstract } from './content';
import { parseXML } from './parser';
import { readFile, writeFile, removeFile } from './utils';

export class Fetcher {
    private storage: vscode.Memento;
    private dir: string;
    private summaries: {[url: string]: Summary};
    private abstracts: {[link: string]: Abstract};
    private static instance: Fetcher;

    private constructor(context: vscode.ExtensionContext) {
        this.storage = context.globalState;
        this.dir = context.globalStoragePath;
        this.summaries = this.storage.get('summaries', {});
        this.abstracts = this.storage.get('abstracts', {});
    }

    static initInstance(context: vscode.ExtensionContext) {
        Fetcher.instance = new Fetcher(context);
    }

    static getInstance() {
        return Fetcher.instance;
    }

    getSummary(url: string): Summary {
        return this.summaries[url];
    }

    getAbstract(link: string): Abstract {
        return this.abstracts[link];
    }

    private async fetch(url: string, update: boolean=true) {
        const summary = this.summaries[url] || new Summary(url, url, [], false);
        if (!update && summary.ok) {
            return;
        }

        const abstracts: Abstract[] = [];
        for (const link of summary.catelog) {
            const abstract =  this.abstracts[link];
            if (abstract) {
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
            const abstract = new Abstract(entry);
            this.abstracts[abstract.link] = abstract;
            abstracts.push(abstract);
        }

        abstracts.sort((a, b) => b.date - a.date);
        summary.catelog = abstracts.map(a => a.link);
        this.summaries[url] = summary;
    }

    async fetchOne(url: string, update: boolean) {
        await this.fetch(url, update);
        await this.updateSummaries();
        await this.updateAbstracts();
    }

    async fetchAll(update: boolean) {
        const cfg = vscode.workspace.getConfiguration('rss');
        await Promise.all(cfg.feeds.map((feed: string) => this.fetch(feed, update)));
        await this.updateSummaries();
        await this.updateAbstracts();
    }

    async updateSummaries() {
        await this.storage.update('summaries', this.summaries);
    }

    async updateAbstracts() {
        await this.storage.update('abstracts', this.abstracts);
    }

    async updateContent(link: string, content: string | undefined) {
        const file = path.join(this.dir, encodeURIComponent(link));
        if (content === undefined) {
            await removeFile(file);
        } else {
            await writeFile(file, content);
        }
    }

    async getContent(link: string) {
        const file = path.join(this.dir, encodeURIComponent(link));
        try {
            return await readFile(file);
        } catch (error) {
            vscode.window.showErrorMessage(error.toString());
            throw error;
        }
    }

    async removeFeed(url: string) {
        const summary = this.summaries[url];
        if (!summary) {
            return;
        }
        delete this.summaries[url];
        for (const link of summary.catelog) {
            delete this.abstracts[link];
            await this.updateContent(link, undefined);
        }
        await this.updateSummaries();
        await this.updateAbstracts();
    }
}
