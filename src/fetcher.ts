import * as vscode from 'vscode';
import got from 'got';
import { Entry, Summary, Abstract } from './content';
import { parseXML } from './parser';

export class Fetcher {
    private storage: vscode.Memento;
    private summaries: {[url: string]: Summary} = {};
    private abstracts: {[link: string]: Abstract} = {};
    private static instance: Fetcher;

    private constructor(context: vscode.ExtensionContext) {
        this.storage = context.globalState;
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

    async fetch(url: string, update: boolean=true) {
        const summary: Summary = this.storage.get(url, new Summary(url, url, [], false));
        const abstracts: Abstract[] = [];
        for (const link of summary.catelog) {
            const entry: Entry | undefined = this.storage.get(link);
            if (entry) {
                abstracts.push(new Abstract(entry));
            }
        }

        if (update || !summary.ok) {
            let entries: Entry[];
            try {
                const cfg = vscode.workspace.getConfiguration('rss');
                const res = await got(url, {timeout: cfg.timeout * 1000, retry: cfg.retry, encoding: 'binary'});
                const obj = parseXML(res.body, new Set(summary.catelog));
                entries = obj.entries;
                summary.title = obj.summary.title;
                summary.link = obj.summary.link;
                summary.ok = true;
            } catch (error) {
                vscode.window.showErrorMessage(error.toString());
                entries = [];
                summary.ok = false;
            }

            for (const entry of entries) {
                await this.storage.update(entry.link, entry);
                abstracts.push(new Abstract(entry));
            }

            abstracts.sort((a, b) => b.date - a.date);
            summary.catelog = abstracts.map(a => a.link);
            await this.storage.update(url, summary);
        }

        this.summaries[url] = summary;
        for (const abstract of abstracts) {
            this.abstracts[abstract.link] = abstract;
        }
    }

    async fetch_all(update: boolean) {
        const cfg = vscode.workspace.getConfiguration('rss');
        await Promise.all(cfg.feeds.map((feed: string) => this.fetch(feed, update)));
    }
}
