import * as vscode from 'vscode';
import { Collection } from "./collection";
import { App } from "./app";
import { join as pathJoin, resolve } from 'path';
import { writeFile, readFile, removeFile, fileExists, got } from './utils';
import { Summary, Abstract } from "./content";
import * as http from 'http';
import { parse as url_parse } from 'url';
import { AddressInfo } from 'net';
import { IncomingMessage, ServerResponse } from 'http';
import he = require('he');

interface Token {
    auth_code: string;
    access_token: string;
    refresh_token: string;
    expire: number;
}

export class InoreaderCollection extends Collection {
    private feed_tree: FeedTree = [];
    private token?: Token;
    private dirty_abstracts = new Set<string>();

    get type(): string {
        return "inoreader";
    }

    protected get cfg(): InoreaderAccount {
        return super.cfg as InoreaderAccount;
    }

    private get domain(): string {
        return App.cfg.get<string>('inoreader-domain')!;
    }

    async init() {
        const list_path = pathJoin(this.dir, 'feed_list');
        if (await fileExists(list_path)) {
            this.feed_tree = JSON.parse(await readFile(list_path));
        }

        const code_path = pathJoin(this.dir, 'auth_code');
        if (await fileExists(code_path)) {
            this.token = JSON.parse(await readFile(code_path));
        }

        await super.init();
    }

    getFeedList(): FeedTree {
        if (this.feed_tree.length > 0) {
            return this.feed_tree;
        } else {
            return super.getFeedList();
        }
    }

    private async saveToken(token: Token) {
        await writeFile(pathJoin(this.dir, 'auth_code'), JSON.stringify(token));
    }

    private async authorize(): Promise<Token> {
        const server = http.createServer().listen(0, '127.0.0.1');
        const addr = await new Promise<AddressInfo>(resolve => {
            server.on('listening', () => {
                resolve(server.address() as AddressInfo);
            });
        });

        const client_id = this.cfg.appid;
        const redirect_uri = encodeURIComponent(`http://127.0.0.1:${addr.port}`);
        const url = `https://${this.domain}/oauth2/auth?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=code&scope=read+write&state=1`;
        await vscode.env.openExternal(vscode.Uri.parse(url));

        const auth_code = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Authorizing...',
            cancellable: true
        }, async (_, token) => new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject('Authorization Timeout');
                server.close();
            }, 300000);

            token.onCancellationRequested(() => {
                reject('Cancelled');
                server.close();
                clearInterval(timer);
            });

            server.on('request', (req: IncomingMessage, res: ServerResponse) => {
                const query = url_parse(req.url!, true).query;
                if (query.code) {
                    resolve(query.code as string);
                    res.end('<h1>Authorization Succeeded</h1>');
                    server.close();
                    clearInterval(timer);
                }
            });

        }));

        const res = await got({
            url: `https://${this.domain}/oauth2/token`,
            method: 'POST',
            form: {
                code: auth_code,
                redirect_uri: redirect_uri,
                client_id: this.cfg.appid,
                client_secret: this.cfg.appkey,
                grant_type: 'authorization_code',
            },
            throwHttpErrors: false,
        });
        const response = JSON.parse(res.body);
        if (!response.refresh_token || !response.access_token || !response.expires_in) {
            throw Error('Get Token Fail: ' + response.error_description);
        }
        return {
            auth_code: auth_code,
            refresh_token: response.refresh_token,
            access_token: response.access_token,
            expire: new Date().getTime() + response.expires_in * 1000,
        };
    }

    private async refreshToken(token: Token) {
        const res = await got({
            url: `https://${this.domain}/oauth2/token`,
            method: 'POST',
            form: {
                client_id: this.cfg.appid,
                client_secret: this.cfg.appkey,
                grant_type: "refresh_token",
                refresh_token: token.refresh_token,
            },
            throwHttpErrors: false,
        });
        const response = JSON.parse(res.body);
        if (!response.refresh_token || !response.access_token || !response.expires_in) {
            return undefined;
        }
        token.refresh_token = response.refresh_token;
        token.access_token = response.access_token;
        token.expire = new Date().getTime() + response.expires_in * 1000;
        return token;
    }

    private async getAccessToken() {
        if (!this.token) {
            this.token = await this.authorize();
            this.saveToken(this.token);
        }
        if (new Date().getTime() > this.token.expire) {
            this.token = await this.refreshToken(this.token);
            if (!this.token) {
                this.token = await this.authorize();
            }
            this.saveToken(this.token);
        }

        return this.token.access_token;
    }

    private async request(cmd: string, param?: {[key: string]: any}, is_json: boolean=true): Promise<any> {
        const access_token = await this.getAccessToken();

        const res = await got({
            url: `https://${this.domain}/reader/api/0/${cmd}`,
            method: 'POST',
            headers: {'Authorization': `Bearer ${access_token}`},
            form: param,
            throwHttpErrors: false,
            timeout: App.cfg.timeout * 1000,
            retry: App.cfg.retry,
        });
        if (res.statusCode !== 200) {
            if (res.statusCode === 401) {
                this.token = undefined;
                return await this.request(cmd, param);
            } else {
                throw Error(res.body);
            }
        }
        return is_json ? JSON.parse(res.body) : res.body;
    }

    async addFeed(feed: string) {
        if (this.getSummary(feed) !== undefined) {
            vscode.window.showInformationMessage('Feed already exists');
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            try {
                const res = await this.request('subscription/quickadd', {
                    quickadd: 'feed/' + feed,
                });
                if (res.numResults > 0) {
                    await this._fetchAll(false);
                    App.instance.refreshLists();
                }
            } catch (error: any) {
                vscode.window.showErrorMessage('Add feed failed: ' + error.toString());
            }
        });
    }

    async delFeed(feed: string) {
        const summary = this.getSummary(feed);
        if (summary === undefined) {
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Updating RSS...",
            cancellable: false
        }, async () => {
            try {
                await this.request('subscription/edit', {
                    ac: 'unsubscribe',
                    s: summary.custom_data,
                }, false);
                await this._fetchAll(false);
                App.instance.refreshLists();
            } catch (error: any) {
                vscode.window.showErrorMessage('Remove feed failed: ' + error.toString());
            }
        });
    }

    async addToFavorites(id: string) {
        const abstract = this.getAbstract(id);
        if (!abstract) {
            return;
        }
        abstract.starred = true;
        this.updateAbstract(id, abstract);
        await this.commit();

        this.request('edit-tag', {
            a: 'user/-/state/com.google/starred',
            i: id,
        }, false).catch(error => {
            vscode.window.showErrorMessage('Add favorite failed: ' + error.toString());
        });
    }

    async removeFromFavorites(id: string) {
        const abstract = this.getAbstract(id);
        if (!abstract) {
            return;
        }
        abstract.starred = false;
        this.updateAbstract(id, abstract);
        await this.commit();

        this.request('edit-tag', {
            r: 'user/-/state/com.google/starred',
            i: id,
        }, false).catch(error => {
            vscode.window.showErrorMessage('Remove favorite failed: ' + error.toString());
        });
    }

    private async fetch(url: string, update: boolean) {
        const summary = this.getSummary(url);
        if (summary === undefined || summary.custom_data === undefined) {
            throw Error('Feed dose not exist');
        }
        if (!update && summary.ok) {
            return;
        }

        const param: {[key: string]: any} = {};
        param.n = App.cfg.get('inoreader-limit');
        if (App.cfg.get('fetch-unread-only')) {
            param.xt = 'user/-/state/com.google/read';
        }

        const res = await this.request(
            'stream/contents/' + encodeURIComponent(summary.custom_data),
            param
        );
        const items = res.items as any[];
        const id2abs = new Map<string, Abstract>();
        for (const item of items) {
            let read = false, starred = false;
            for (const tag of item.categories as string[]) {
                if (tag.endsWith('state/com.google/read')) {
                    read = true;
                } else if (tag.endsWith('state/com.google/starred')) {
                    starred = true;
                }
            }
            const id = item.id.split('/').pop();

            const abs = new Abstract(id, he.decode(item.title), item.published * 1000,
                                     item.canonical[0]?.href, read, url, starred);
            this.updateAbstract(id, abs);
            this.updateContent(id, item.summary.content);
            id2abs.set(id, abs);
        }

        for (const id of summary.catelog) {
            const abs = this.getAbstract(id);
            if (abs !== undefined && !id2abs.has(id)) {
                if (!abs.read) {
                    abs.read = true;
                    this.updateAbstract(id, abs);
                }
                id2abs.set(id, abs);
            }
        }

        summary.catelog = [...id2abs.values()]
            .sort((a, b) => b.date - a.date)
            .map(a => a.id);
        summary.ok = true;
        this.updateSummary(url, summary);
    }

    private async _fetchAll(update: boolean) {
        const res = await this.request('subscription/list');
        const list = res.subscriptions as any[];

        const feeds = new Set<string>();
        const caties = new Map<string, Category>();
        const no_caties: FeedTree = [];
        for (const feed of list) {
            let summary = this.getSummary(feed.url);
            if (summary) {
                summary.ok = true;
                summary.title = feed.title;
                summary.custom_data = feed.id;
            } else {
                summary = new Summary(feed.htmlUrl, feed.title, [], false, feed.id);
            }
            this.updateSummary(feed.url, summary);
            feeds.add(feed.url);

            for (const caty of feed.categories as {id: string, label: string}[]) {
                let category = caties.get(caty.id);
                if (!category) {
                    category = {
                        name: caty.label,
                        list: [],
                        custom_data: caty.id,
                    };
                    caties.set(caty.id, category);
                }
                category.list.push(feed.url);
            }
            if (feed.categories.length <= 0) {
                no_caties.push(feed.url);
            }
        }

        this.feed_tree = [];
        for (const caty of caties.values()) {
            this.feed_tree.push(caty);
        }
        this.feed_tree.push(...no_caties);
        for (const feed of this.getFeeds()) {
            if (!feeds.has(feed)) {
                this.updateSummary(feed, undefined);
            }
        }

        await Promise.all(this.getFeeds().map(url => this.fetch(url, update)));
        await this.commit();
    }

    async fetchAll(update: boolean) {
        try {
            await this._fetchAll(update);
        } catch (error: any) {
            vscode.window.showErrorMessage('Update feeds failed: ' + error.toString());
        }
    }

    async fetchOne(url: string, update: boolean) {
        try {
            await this.fetch(url, update);
            await this.commit();
        } catch (error: any) {
            vscode.window.showErrorMessage('Update feed failed: ' + error.toString());
        }
    }

    updateAbstract(id: string, abstract?: Abstract) {
        this.dirty_abstracts.add(id);
        return super.updateAbstract(id, abstract);
    }

    private async syncReadStatus(list: string[], read: boolean) {
        if (list.length <= 0) {
            return;
        }
        const param = list.map(i => ['i', i]);
        param.push([read ? 'a' : 'r', 'user/-/state/com.google/read']);
        await this.request('edit-tag', param, false);
    }

    async commit() {
        const read_list: string[] = [];
        const unread_list: string[] = [];
        for (const id of this.dirty_abstracts) {
            const abstract = this.getAbstract(id);
            if (abstract) {
                if (abstract.read) {
                    read_list.push(abstract.id);
                } else {
                    unread_list.push(abstract.id);
                }
            }
        }
        this.dirty_abstracts.clear();
        Promise.all([
            this.syncReadStatus(read_list, true),
            this.syncReadStatus(unread_list, false),
        ]).catch(error => {
            vscode.window.showErrorMessage('Sync read status failed: ' + error.toString());
        });

        await writeFile(pathJoin(this.dir, 'feed_list'), JSON.stringify(this.feed_tree));
        await super.commit();
    }

}
