import * as path from 'path';
import * as vscode from 'vscode';
import { join as pathJoin } from 'path';
import { Summary, Entry, Abstract, Storage } from './content';
import { writeFile, readDir, checkDir, moveFile, readFile, fileExists } from './utils';
import * as uuid from 'uuid';
import * as crypto from 'crypto';

export async function migrate(context: vscode.ExtensionContext) {
    const old = context.globalState.get<string>('version', '0.0.1');
    for (let i = VERSIONS.indexOf(old) + 1; i < VERSIONS.length; ++i) {
        const v = VERSIONS[i];
        if (v in alter) {
            await alter[v](context);
        }
    }
    await context.globalState.update('version', VERSIONS[VERSIONS.length - 1]);
}

const VERSIONS = [
    '0.0.1', '0.0.2', '0.0.3', '0.0.4', '0.0.5', '0.1.0', '0.2.0', '0.2.1',
    '0.2.2', '0.3.0', '0.3.1', '0.4.0', '0.4.1', '0.5.0', '0.6.0', '0.6.1',
    '0.7.0', '0.7.1',
];

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
    },

    '0.7.0': async (context) => {
        const root = context.globalStoragePath;
        await checkDir(root);

        const cfg = vscode.workspace.getConfiguration('rss');
        for (const key in cfg.accounts) {
            const dir = pathJoin(root, key);
            await checkDir(dir);
            await checkDir(pathJoin(dir, 'feeds'));
            const feeds = await readDir(pathJoin(dir, 'feeds'));
            for (const feed of feeds) {
                const file_name = pathJoin(dir, 'feeds', feed);
                const json = await readFile(file_name);
                const storage = JSON.parse(json);
                for (const abstract of storage.abstracts) {
                    if (cfg.accounts[key].type === 'local') {
                        abstract.id = abstract.link;
                    } else if (cfg.accounts[key].type === 'ttrss') {
                        abstract.id = abstract.custom_data;
                        const old = pathJoin(dir, 'articles', encodeURIComponent(abstract.link));
                        if (await fileExists(old)) {
                            await moveFile(old, pathJoin(dir, 'articles', encodeURIComponent(abstract.id)));
                        }
                    }
                }
                await writeFile(file_name, JSON.stringify(storage));
            }

        }
    },

    '0.7.1': async (context) => {
        const root = context.globalStoragePath;
        await checkDir(root);

        const cfg = vscode.workspace.getConfiguration('rss');
        for (const key in cfg.accounts) {
            if (cfg.accounts[key].type === 'local') {
                const dir = pathJoin(root, key);
                await checkDir(dir);
                await checkDir(pathJoin(dir, 'feeds'));
                const feeds = await readDir(pathJoin(dir, 'feeds'));
                for (const feed of feeds) {
                    const file_name = pathJoin(dir, 'feeds', feed);
                    const json = await readFile(file_name);
                    const storage = JSON.parse(json);
                    for (const abstract of storage.abstracts) {
                        const old = pathJoin(dir, 'articles', encodeURIComponent(abstract.id));
                        abstract.id = crypto.createHash("sha256")
                                            .update(storage.link + abstract.id)
                                            .digest('hex');
                        if (await fileExists(old)) {
                            await moveFile(old, pathJoin(dir, 'articles', abstract.id));
                        }
                    }
                    await writeFile(file_name, JSON.stringify(storage));
                }
            }
        }
    },

};
