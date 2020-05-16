import * as path from 'path';
import * as vscode from 'vscode';
import { join as pathJoin } from 'path';
import { Summary, Entry, Abstract } from './content';
import { writeFile, readDir, checkDir, moveFile } from './utils';
import * as sqlite3 from 'sqlite3';
import { open as openDB } from 'sqlite';

export async function migrate(context: vscode.ExtensionContext) {
    const version: string = vscode.extensions.getExtension('luyuhuang.rss')!.packageJSON.version;
    const old = context.globalState.get<string>('version', '0.0.1');
    for (let i = VERSIONS.indexOf(old) + 1; i <= VERSIONS.indexOf(version); ++i) {
        const v = VERSIONS[i];
        await alter[v](context);
    }
    // await context.globalState.update('version', version);
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

            for (const feed of cfg.feeds as string[]) {
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
        const database = await openDB({
            filename: pathJoin(root, 'rss.db'), driver: sqlite3.Database
        });

        await database.exec(`
        create table feeds (
            feed text,
            account text,

            link text not null,
            title text not null,
            ok boolean not null default 0,

            primary key(feed, account)
        );
        `);
        await database.exec(`
        create table articles (
            link text,
            feed text,
            account text,

            title text not null,
            date integer not null,
            read boolean not null default 0,

            primary key(link, feed, account)
        );
        `);

        const cfg = vscode.workspace.getConfiguration('rss');
        const name = 'Default';
        await cfg.update('accounts', {
            [name]: {
                type: 'local',
                feeds: cfg.get('feeds', []),
                favorites: cfg.get('favorites', [
                    {"name": "Default", "list": []}
                ])
            }
        }, true);

        const summaries = context.globalState.get<{[url: string]: Summary}>('summaries', {});
        const abstracts = context.globalState.get<{[link: string]: Abstract}>('abstracts', {});

        for (const url in summaries) {
            const summary = summaries[url];
            await database.run('insert into feeds values(?,?,?,?,?)',
                             url, name, summary.link, summary.title, summary.ok);

            for (const link of summary.catelog) {
                const abstract = abstracts[link];
                if (abstract === undefined) {
                    continue;
                }
                try {
                    await database.run('insert into articles values(?,?,?,?,?,?)',
                                     link, url, name,
                                     abstract.title, abstract.date, abstract.read);
                } catch(e) {}
            }
        }

        await checkDir(pathJoin(root, name));
        const files = await readDir(root);
        for (const file of files) {
            if (file === name || file === 'rss.db') {
                continue;
            }
            await moveFile(pathJoin(root, file), pathJoin(root, name, file));
        }

        // await context.globalState.update('summaries', undefined);
        // await context.globalState.update('abstracts', undefined);
    }
};
