import * as path from 'path';
import * as vscode from 'vscode';
import { join as pathJoin, isAbsolute } from 'path';
import { Summary, Entry, Abstract, Storage } from './content';
import { writeFile, readDir, checkDir, moveFile, readFile, fileExists, isDirEmpty } from './utils';
import * as uuid from 'uuid';
import * as crypto from 'crypto';

export async function checkStoragePath(context: vscode.ExtensionContext): Promise<string> {
    const old = context.globalState.get<string>('root', context.globalStoragePath);
    const cfg = vscode.workspace.getConfiguration('rss');
    const root = cfg.get<string>('storage-path') || context.globalStoragePath;
    if (old !== root) {
        if (!isAbsolute(root)) {
            throw Error(`"${root}" is not an absolute path`);
        }
        if (!await fileExists(root) || await isDirEmpty(root)) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Moving data...',
                cancellable: false
            }, async () => {
                await checkDir(old);
                try {
                    await moveFile(old, root);
                } catch (e: any) {
                    throw Error(`Move data failed: ${e.toString()}`);
                }
            });
        } else {
            const s = await vscode.window.showInformationMessage(
                `Target directory "${root}" is not empty, use this directory?`,
                'Yes', "Cancel"
            );
            if (s !== 'Yes') {
                // revert the configuration
                await cfg.update('storage-path', old, true);
                await checkDir(old);
                return old;
            }
        }
        await context.globalState.update('root', root);
    }
    await checkDir(root);
    return root;
}

async function getVersion(ctx: vscode.ExtensionContext, root: string) {
    const path = pathJoin(root, 'version');
    if (!await fileExists(path)) {
        // an issue left over from history
        await setVersion(root, ctx.globalState.get<string>('version', '0.0.1'));
    }
    return (await readFile(path)).trim();
}

async function setVersion(root: string, version: string) {
    await writeFile(pathJoin(root, 'version'), version);
}

export async function migrate(context: vscode.ExtensionContext, root: string) {
    const old = await getVersion(context, root);
    const idx = VERSIONS.indexOf(old);
    if (idx < 0) {
        throw Error(`Invalid version "${old}". Current version is "${VERSIONS[VERSIONS.length - 1]}"`);
    }

    for (let i = idx + 1; i < VERSIONS.length; ++i) {
        const v = VERSIONS[i];
        if (v in alter) {
            await alter[v](context, root);
        }
    }
    await setVersion(root, VERSIONS[VERSIONS.length - 1]);
}

const VERSIONS = [
    '0.0.1', '0.0.2', '0.0.3', '0.0.4', '0.0.5', '0.1.0', '0.2.0', '0.2.1',
    '0.2.2', '0.3.0', '0.3.1', '0.4.0', '0.4.1', '0.5.0', '0.6.0', '0.6.1',
    '0.7.0', '0.7.1', '0.7.2', '0.8.0', '0.8.1', '0.9.0', '0.9.1', '0.9.2',
    '0.9.3', '0.10.0', '0.10.1', '0.10.2', '0.10.3',
];

const alter: {[v: string]: (context: vscode.ExtensionContext, root: string) => Promise<void>} = {
    '0.3.1': async (context, root) => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Migrating data for the new version...',
            cancellable: false
        }, async () => {
            const cfg = vscode.workspace.getConfiguration('rss');
            await checkDir(root);
            const summaries: {[url: string]: Summary} = {};
            const abstracts: {[link: string]: Abstract} = {};

            for (const feed of cfg.get<string[]>('feeds', [])) {
                const summary = context.globalState.get<Summary>(feed);
                if (summary === undefined) { continue; }
                for (const link of summary.catelog) {
                    const entry = context.globalState.get<Entry>(link);
                    if (entry === undefined) { continue; }
                    await writeFile(path.join(root, encodeURIComponent(link)), entry.content);

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

    '0.4.0': async (context, root) => {
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

    '0.7.0': async (context, root) => {
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

    '0.7.1': async (context, root) => {
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
