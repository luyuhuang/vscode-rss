import * as vscode from 'vscode';
import got from 'got';
import * as parser from "fast-xml-parser"
import * as he from 'he';


export class FeedList implements vscode.TreeDataProvider<Feed> {
    private _onDidChangeTreeData: vscode.EventEmitter<Feed | undefined> = new vscode.EventEmitter<Feed | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Feed | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(ele: Feed): vscode.TreeItem {
        return ele;
    }

    async getChildren(element?: Feed): Promise<Feed[]> {
        if (element) return [];

        const cfg = vscode.workspace.getConfiguration('rss');
        return await Promise.all(cfg.feeds.map(async (feed: string) => {
            const res = await got(feed);
            const content = parseXML(res.body.toString());
            if (!content)
                throw 'fuck';
            return new Feed(content.title, content);
        }));
    }
}

class Feed extends vscode.TreeItem {
    constructor(
        public title: string,
        private content: object,
    ) {
        super(title, vscode.TreeItemCollapsibleState.None);
        this.command = {command: 'rss.articles', title: 'articles', arguments: [this.content]};
    }
}

function parseXML(XML: string) {
    const dom = parser.parse(XML, {
        attributeNamePrefix: "",
        attrNodeName: "attr",
        textNodeName: "text",
        ignoreAttributes: false,
        parseAttributeValue: true
    });
    let feed;
    const entries: any[] = [];
    const feedObject = {
        entries,
        title: "",
    };
    if (dom.rss) {
        if (dom.rss.channel) {
            feed = dom.rss.channel;
        } else if (dom.rss.feed) {
            feed = dom.rss.feed;
        }
    } else if (dom.channel) {
        feed = dom.channel;
    } else if (dom.feed) {
        feed = dom.feed;
    } else if (dom["rdf:RDF"]) {
        feed = dom["rdf:RDF"];
    }
    if (!feed) return;

    if (feed.title && typeof (feed.title) !== "object") {
        feedObject.title = feed.title;
    }
    else if (feed.title.text) {
        feedObject.title = feed.title.text;
    }

    let items;
    if (feed.item) {
        items = feed.item;
    } else if (feed.entry) {
        items = feed.entry;
    }
    if (!items) return;

    items.forEach((object: any) => {
        const entry = {
            title: "",
            content: "",
            date: "",
            link: "",
        };
        if (object.title && typeof (object.title) !== "object") {
            entry.title = object.title;
        }
        else if (object.title.text) {
            entry.title = object.title.text;
        }
        if (object.content) {
            if (object.content.text) {
                entry.content = object.content.text;
            } else {
                entry.content = object.content;
            }
        } else if (object["content:encoded"]) {
            entry.content = object["content:encoded"];
        } else if (object.description && typeof (object.description) !== "object") {
            entry.content = object.description;
        } else if (object.description.text) {
            entry.content = object.description.text;
        }
        entry.content = he.decode(entry.content);
        if (object.updated) {
            entry.date = object.updated;
        } else if (object.pubDate) {
            entry.date = object.pubDate;
        }
        if (object.link && typeof (object.link) !== "object") {
            entry.link = object.link;
        } else if (object.link.attr) {
            entry.link = object.link.attr.href;
        } else if (object.source) {
            entry.link = object.source;
        }
        if (entry && feedObject.entries) {
            entries.push(entry);
        }
    });
    return feedObject;
}