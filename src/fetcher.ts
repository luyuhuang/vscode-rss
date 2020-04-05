import * as vscode from 'vscode';
import got from 'got';
import { Content, Entry, Summary } from './content';

export class Fetcher {
    private storage: vscode.Memento;
    constructor(context: vscode.ExtensionContext) {
        this.storage = context.globalState
    }

    async fetch(url: string, update: boolean=true): Promise<Content> {
        let summery: Summary | undefined = this.storage.get(url);
        const links = new Set<string>();
        let content
        if (update || !summery) {
            try {
                const res = await got(url);
                content = Content.fromXML(res.body.toString());
            } catch (error) {
                vscode.window.showErrorMessage(error.toString());
                content = new Content(url, []);
            }
            await Promise.all(content.entries.map(entry => {
                links.add(entry.link);
                const old: Entry = this.storage.get(entry.link, entry);
                entry.read = old.read;
                return this.storage.update(entry.link, entry);
            }));

            if (!summery)
                summery = new Summary(content.title, []);
            else
                summery.title = content.title
        } else {
            content = new Content(summery.title, []);
        }

        for (const link of summery.catelog) {
            if (links.has(link)) continue;
            const entry: Entry | undefined = this.storage.get(link);
            if (entry)
                content.entries.push(entry)
        }
        if (links.size > 0) {
            summery.catelog = content.entries.map(entry => entry.link);
            await this.storage.update(url, summery);
        }

        content.entries.sort((a, b) => b.date - a.date);
        return content;
    }
}
