import * as path from 'path';
import * as vscode from 'vscode';
import { Summary, Entry, Abstract } from './content';
import { writeFile } from './utils';

export async function migrate(context: vscode.ExtensionContext) {
    const version: string = vscode.extensions.getExtension('luyuhuang.rss')!.packageJSON.version;
    const old = context.globalState.get<string>('version', '0.0.1');
    for (let i = VERSIONS.indexOf(old) + 1; i <= VERSIONS.indexOf(version); ++i) {
        const v = VERSIONS[i];
        await alter[v](context);
    }
    await context.globalState.update('version', version);
}

const VERSIONS = ['0.3.1'];

const alter: {[v: string]: (context: vscode.ExtensionContext) => Promise<void>} = {
    '0.3.1': async (context) => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Migrating data for the new version...',
            cancellable: false
        }, async () => {
            const cfg = vscode.workspace.getConfiguration('rss');
            const dir = context.globalStoragePath;
            const summaries: {[url: string]: Summary} = {};
            const abstracts: {[link: string]: Abstract} = {};

            for (const feed of cfg.feeds as string[]) {
                const summary = context.globalState.get<Summary>(feed);
                if (summary === undefined) { continue; }
                for (const link of summary.catelog) {
                    const entry = context.globalState.get<Entry>(link);
                    if (entry === undefined) { continue; }
                    await writeFile(path.join(dir, encodeURIComponent(link)), entry.content);

                    abstracts[link] = new Abstract(entry);
                    await context.globalState.update(link, undefined);
                }
                summaries[feed] = summary;
                await context.globalState.update(feed, undefined);
            }

            await context.globalState.update('summaries', summaries);
            await context.globalState.update('abstracts', abstracts);
        });
    }
};
