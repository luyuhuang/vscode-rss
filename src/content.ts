import * as parser from "fast-xml-parser"
import * as he from 'he';
import * as cheerio from 'cheerio';
import { URL } from "url";

export class Entry {
    constructor(
        public title: string,
        public content: string,
        public date: number,
        public link: string,
        public read: boolean,
    ) {}

    static fromDOM(dom: any, baseURL: string): Entry {
        let title;
        if (dom.title && typeof (dom.title) !== "object") {
            title = dom.title;
        } else if (dom.title.text) {
            title = dom.title.text;
        }
        if (!title) throw new Error("Feed Format Error: Entry Missing Title");
        title = he.decode(title)

        let content;
        if (dom.content) {
            if (dom.content.text) {
                content = dom.content.text;
            } else {
                content = dom.content;
            }
        } else if (dom["content:encoded"]) {
            content = dom["content:encoded"];
        } else if (dom.description && typeof (dom.description) !== "object") {
            content = dom.description;
        } else if (dom.description.text) {
            content = dom.description.text;
        }
        if (!content) throw new Error("Feed Format Error: Entry Missing Content");
        content = he.decode(content);
        const $ = cheerio.load(content);
        $('a').each((_, ele) => {
            const $ele = $(ele);
            const href = $ele.attr('href');
            if (href) $ele.attr('href', new URL(href, baseURL).href)
        });
        $('img').each((_, ele) => {
            const $ele = $(ele);
            const src = $ele.attr('src');
            if (src) $ele.attr('src', new URL(src, baseURL).href)
        })
        content = he.decode($.html());

        let date;
        if (dom.updated) {
            date = dom.updated;
        } else if (dom.pubDate) {
            date = dom.pubDate;
        }
        if (!date) throw new Error("Feed Format Error: Entry Missing Date");
        date = new Date(date).getTime();

        let link;
        if (dom.link && typeof (dom.link) !== "object") {
            link = dom.link;
        } else if (dom.link.attr) {
            link = dom.link.attr.href;
        } else if (dom.source) {
            link = dom.source;
        }
        if (!link) throw new Error("Feed Format Error: Entry Missing Link");
        link = new URL(link, baseURL).href

        return new Entry(title, content, date, link, false);
    }
}

export class Content {
    constructor(
        public title: string,
        public entries: Entry[],
    ) {}

    static fromXML(xml: string): Content {
        const dom = parser.parse(xml, {
            attributeNamePrefix: "",
            attrNodeName: "attr",
            textNodeName: "text",
            ignoreAttributes: false,
            parseAttributeValue: true
        });
        let feed;
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
        if (!feed) throw new Error('Feed Format Error');

        let title;
        if (feed.title && typeof (feed.title) !== "object") {
            title = feed.title;
        } else if (feed.title.text) {
            title = feed.title.text;
        }
        if (!title) throw new Error('Feed Format Error: Missing Title');
        title = he.decode(title);

        let link: any;
        if (feed.link && typeof(feed.link) !== 'object') {
            link = feed.link;
        } else if (feed.link.attr) {
            link = feed.link.attr.href;
        } else if (feed.id) {
            link = feed.id;
        }
        if (!link) throw new Error('Feed Format Error: Missing Link');
        if (!link.match(/^https?:\/\//)) {
            if (link.match(/^\/\//)) {
                link = 'http:' + link;
            } else {
                link = 'http://' + link;
            }
        }

        let items: any;
        if (feed.item) {
            items = feed.item;
        } else if (feed.entry) {
            items = feed.entry;
        }
        if (!items) throw new Error('Feed Format Error');

        const entries: Entry[] = items.map((item: any) => Entry.fromDOM(item, link));
        return new Content(title, entries);
    }
}

export class Summary {
    constructor(
        public title: string,
        public catelog: string[],
    ) {}
}
