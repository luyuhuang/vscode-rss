import * as parser from "fast-xml-parser";
import * as he from 'he';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';
import { URL } from "url";
import { isString, isArray, isNumber } from "util";
import { Entry, Summary } from "./content";
import * as crypto from 'crypto';

function isStringified(s: any) {
    return isString(s) || isNumber(s);
}

function order(attr: any) {
    if (!attr) {
        return -2;
    }
    if (attr.rel === 'alternate') {
        return 1;
    } else if (!attr.rel) {
        return 0;
    } else {
        return -1;
    }
}

function parseLink(link: any) {
    if (isArray(link) && link.length > 0) {
        link = link.reduce((a, b) => order(a.__attr) > order(b.__attr) ? a : b);
    }

    let ans;
    if (isStringified(link)) {
        ans = link;
    } else if (isStringified(link.__attr?.href)) {
        ans = link.__attr.href;
    } else if (isStringified(link.__text)) {
        ans = link.__text;
    } else if ('__cdata' in link) {
        if (isStringified(link.__cdata)) {
            ans = link.__cdata;
        } else if(isArray(link.__cdata)) {
            ans = link.__cdata.join('');
        }
    }
    return ans;
}

function dom2html(name: string, node: any) {
    if (isStringified(node)) {
        return `<${name}>${node}</${name}>`;
    }

    let html = '<' + name;
    if ('__attr' in node) {
        for (const key in node.__attr) {
            const value = node.__attr[key];
            html += ` ${key}="${value}"`;
        }
    }
    html += '>';

    if (isStringified(node.__text)) {
        html += node.__text;
    }
    for (const key in node) {
        if (key.startsWith('__')) {continue;}
        const value = node[key];
        if (isArray(value)) {
            for (const item of value) {
                html += dom2html(key, item);
            }
        } else {
            html += dom2html(key, value);
        }
    }
    html += `</${name}>`;
    return html;
}

function extractText(content: any) {
    let ans;
    if (isStringified(content)) {
        ans = content;
    } else if (isStringified(content.__text)) {
        ans = content.__text;
    } else if ('__cdata' in content) {
        if (isStringified(content.__cdata)) {
            ans = content.__cdata;
        } else if(isArray(content.__cdata)) {
            ans = content.__cdata.join('');
        }
    } else if (content.__attr?.type === 'html') {
        // XXX: temporary solution. convert dom object to html string.
        ans = dom2html('html', content);
    }
    return ans;
}

function parseEntry(dom: any, baseURL: string, exclude: Set<string>): Entry | undefined {
    let link;
    if (dom.link) {
        link = parseLink(dom.link);
    } else if (dom.source) {
        link = dom.source;
    }
    if (isStringified(link)) {
        link = new URL(link, baseURL).href;
    } else {
        link = undefined;
    }

    let id;
    if (dom.id) {
        id = extractText(dom.id);
    } else if (dom.guid) {
        id = extractText(dom.guid);
    } else {
        id = link;
    }
    if (!isStringified(id)) {
        throw new Error("Feed Format Error: Entry Missing ID");
    }
    id = crypto.createHash("sha256").update(baseURL + id).digest('hex');

    if (exclude.has(id)) {
        return undefined;
    }

    let title;
    if ('title' in dom) {
        title = extractText(dom.title);
    }
    if (!isStringified(title)) {
        throw new Error("Feed Format Error: Entry Missing Title");
    }
    title = he.decode(title);

    let content;
    if ('content' in dom) {
        content = extractText(dom.content);
    } else if ("content:encoded" in dom) {
        content = extractText(dom["content:encoded"]);
    } else if ('description' in dom) {
        content = extractText(dom.description);
    } else if ('summary' in dom) {
        content = extractText(dom.summary);
    } else {
        content = title;
    }
    if (!isStringified(content)) {
        throw new Error("Feed Format Error: Entry Missing Content");
    }
    content = he.decode(content);
    const $ = cheerio.load(content);
    $('a').each((_, ele) => {
        const $ele = $(ele);
        const href = $ele.attr('href');
        if (href) {
            try {
                $ele.attr('href', new URL(href, baseURL).href);
            } catch {}
        }
    });
    $('img').each((_, ele) => {
        const $ele = $(ele);
        const src = $ele.attr('src');
        if (src) {
            try {
                $ele.attr('src', new URL(src, baseURL).href);
            } catch {}
        }
        $ele.removeAttr('height');
    });
    $('script').remove();
    content = he.decode($.html());

    let date;
    if (dom.published) {
        date = dom.published;
    } else if (dom.pubDate) {
        date = dom.pubDate;
    } else if (dom.updated) {
        date = dom.updated;
    } else if (dom["dc:date"]) {
        date = dom["dc:date"];
    }
    if (!isStringified(date)) {
        date = new Date().getTime();
    } else {
        date = new Date(date).getTime();
    }
    if (isNaN(date)) {
        throw new Error("Feed Format Error: Invalid Date");
    }

    return new Entry(id, title, content, date, link, false);
}

export function parseXML(xml: string, exclude: Set<string>): [Entry[], Summary] {
    const match = xml.match(/<\?xml.*encoding="(\S+)".*\?>/);
    xml = iconv.decode(Buffer.from(xml, 'binary'), match ? match[1]: 'utf-8');
    const dom = parser.parse(xml, {
        attributeNamePrefix: "",
        attrNodeName: "__attr",
        textNodeName: "__text",
        cdataTagName: "__cdata",
        cdataPositionChar: "",
        ignoreAttributes: false,
        parseAttributeValue: true,
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
    if (!feed) {
        throw new Error('Feed Format Error');
    }

    let title;
    if ('title' in feed) {
        title = extractText(feed.title);
    } else if (feed.channel?.title !== undefined) {
        title = extractText(feed.channel.title);
    }
    if (!isStringified(title)) {
        throw new Error('Feed Format Error: Missing Title');
    }
    title = he.decode(title);

    let link: any;
    if (feed.link) {
        link = parseLink(feed.link);
    } else if (feed.channel?.link) {
        link = parseLink(feed.channel.link);
    }
    if (!isStringified(link)) {
        throw new Error('Feed Format Error: Missing Link');
    }
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
    if (!items) {
        items = [];
    } else if (!isArray(items)) {
        items = [items];
    }

    const entries: Entry[] = [];
    for (const item of items) {
        const entry = parseEntry(item, link, exclude);
        if (entry) {
            entries.push(entry);
        }
    }
    const summary = new Summary(link, title);

    return [entries, summary];
}
