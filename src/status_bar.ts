import * as vscode from 'vscode';
import { App } from './app';
import { Abstract } from './content';

export class StatusBar {
    private status_bar_item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    private unread_list: [string, string][] = [];
    private index = 0;
    private timer: NodeJS.Timeout | undefined;
    private read_state: [string, Abstract] | undefined;

    public init() {
        App.instance.context.subscriptions.push(
            vscode.commands.registerCommand('rss.read-notification', async () => {
                if (!this.read_state) {
                    return;
                }
                const [account, abstract] = this.read_state;
                App.instance.rss_select(account);
                await App.instance.rss_read(abstract);
            })
        );
        this.refresh();
    }

    public refresh() {
        this.unread_list = Object.values(App.instance.collections)
            .map(c => c.getArticles('<unread>').map((a): [string, string] => [c.account, a.id]))
            .reduce((a, b) => a.concat(b));

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        if (App.cfg.get('status-bar-notify')) {
            const interval = App.cfg.get<number>('status-bar-update') || 5;
            this.timer = setInterval(() => this.show(), interval * 1000);
            this.show();
        } else {
            this.status_bar_item.hide();
        }
    }

    private show() {
        this.status_bar_item.hide();
        this.read_state = undefined;
        if (this.unread_list.length <= 0) {
            return;
        }

        this.index %= this.unread_list.length;
        let i = this.index;
        do {
            const [account, id] = this.unread_list[i];
            const collection = App.instance.collections[account];
            if (collection) {
                const abs = collection.getAbstract(id);
                if (abs && !abs.read) {
                    this.status_bar_item.show();
                    const max_len = App.cfg.get<number>('status-bar-length');
                    let title = abs.title;
                    if (max_len && title.length > max_len) {
                        title = title.substr(0, max_len - 3) + '...';
                    }
                    this.status_bar_item.text = '$(rss) ' + title;
                    this.status_bar_item.tooltip = abs.title;
                    this.status_bar_item.command = 'rss.read-notification',
                    this.read_state = [account, abs];
                    this.index = (i + 1) % this.unread_list.length;
                    break;
                }
            }

            i = (i + 1) % this.unread_list.length;
        } while (i !== this.index);
    }
}
