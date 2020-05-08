import * as vscode from 'vscode';
import got from 'got';
import { Content, Entry, Summary, Abstract } from './content';
import { parseXML } from './parser';

export class Fetcher {
    private storage: vscode.Memento;
    constructor(context: vscode.ExtensionContext) {
        this.storage = context.globalState;
    }

    async fetch(url: string, update: boolean=true): Promise<Content> {
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

            summary.catelog = abstracts.map(a => a.link);
            await this.storage.update(url, summary);
        }

        abstracts.sort((a, b) => b.date - a.date);
        return new Content(summary.link, summary.title, abstracts, summary.ok);
    }
}
