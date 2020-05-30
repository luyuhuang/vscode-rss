import * as path from 'path';
import * as vscode from 'vscode';
import { join as pathJoin } from 'path';
import { Summary, Entry, Abstract, Storage } from './content';
import { writeFile, readDir, checkDir, moveFile } from './utils';
import * as uuid from 'uuid';

export async function migrate(context: vscode.ExtensionContext) {
    const version: string = vscode.extensions.getExtension('luyuhuang.rss')!.packageJSON.version;
    const old = context.globalState.get<string>('version', '0.0.1');
    for (let i = VERSIONS.indexOf(old) + 1; i <= VERSIONS.indexOf(version); ++i) {
        const v = VERSIONS[i];
        await alter[v](context);
    }
    await context.globalState.update('version', version);
}

const VERSIONS = ['0.3.1', '0.4.0'];

const alter: {[v: string]: (context: vscode.ExtensionContext) => Promise<void>} = {
    '0.3.1': async (context) => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Migrating data for the new version...',
            cancellable: false
        }, async () => {
            const cfg = vscode.workspace.getConfiguration('rss');
            const dir = context.globalStoragePath;
            await checkDir(dir);
            const summaries: {[url: string]: Summary} = {};
            const abstracts: {[link: string]: Abstract} = {};

            for (const feed of cfg.get<string[]>('feeds', [])) {
                const summary = context.globalState.get<Summary>(feed);
                if (summary === undefined) { continue; }
                for (const link of summary.catelog) {
                    const entry = context.globalState.get<Entry>(link);
                    if (entry === undefined) { continue; }
                    await writeFile(path.join(dir, encodeURIComponent(link)), entry.content);

                    abstracts[link] = Abstract.fromEntry(entry, feed);
                    await context.globalState.update(link, undefined);
                }
                summaries[feed] = summary;
                await context.globalState.update(feed, undefined);
            }

            await context.globalState.update('summaries', summaries);
            await context.globalState.update('abstracts', abstracts);
        });
    },

    '0.4.0': async (context) => {
        const root = context.globalStoragePath;
        await checkDir(root);

        const cfg = vscode.workspace.getConfiguration('rss');
        const key = uuid.v1();
        await cfg.update('accounts', {
            [key]: {
                name: 'Default',
                type: 'local',
                feeds: cfg.get('feeds', []),
            }
        }, true);

        const summaries = context.globalState.get<{[url: string]: Summary}>('summaries', {});
        const abstracts = context.globalState.get<{[link: string]: Abstract}>('abstracts', {});

        await checkDir(pathJoin(root, key));
        await checkDir(pathJoin(root, key, 'feeds'));
        for (const url in summaries) {
            const summary = summaries[url];
            const json = Storage.fromSummary(url, summary, link => {
                const abstract = abstracts[link];
                abstract.feed = url;
                return abstract;
            }).toJSON();
            await writeFile(pathJoin(root, key, 'feeds', encodeURIComponent(url)), json);
        }

        await checkDir(pathJoin(root, key, 'articles'));
        const files = await readDir(root);
        for (const file of files) {
            if (file === key) {
                continue;
            }
            await moveFile(pathJoin(root, file), pathJoin(root, key, 'articles', file));
        }

        await context.globalState.update('summaries', undefined);
        await context.globalState.update('abstracts', undefined);
    }
};
