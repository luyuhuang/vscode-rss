import * as assert from 'assert';
import * as vscode from 'vscode';
import * as parser from '../../parser';
import * as crypto from 'crypto';

function sha256(s: string) {
    return crypto.createHash('sha256').update(s).digest('hex');
}

suite('test parser', () => {
    test('basic', () => {
        const xml = `
        <?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
        <link href="https://luyuhuang.tech/"/>
        <id>https://luyuhuang.tech/feed.xml</id>
        <title type="html">Luyu Huang's Tech Blog</title>
        <entry>
        <title type="html">Title 1</title>
        <link href="https://luyuhuang.tech/2020/06/03/cloudflare-free-https.html"/>
        <published>2020-06-03T00:00:00+08:00</published>
        <content type="html">Some Content</content>
        </entry>
        </feed>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert.equal(summary.title, "Luyu Huang's Tech Blog");
        assert.equal(summary.link, 'https://luyuhuang.tech/');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].title, 'Title 1');
        assert.equal(entries[0].link, 'https://luyuhuang.tech/2020/06/03/cloudflare-free-https.html');
        assert.equal(entries[0].content, '<html><head></head><body>Some Content</body></html>');
    });

    test('empty entry', () => {
        const xml = `
        <?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
        <link href="https://luyuhuang.tech/"/>
        <id>https://luyuhuang.tech/feed.xml</id>
        <title type="html">Luyu Huang's Tech Blog</title>
        </feed>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert.equal(summary.title, "Luyu Huang's Tech Blog");
        assert.equal(summary.link, 'https://luyuhuang.tech/');
        assert.equal(entries.length, 0);
    });

    test('multiple entries', () => {
        const xml = `
        <?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
        <link href="https://luyuhuang.tech/"/>
        <id>https://luyuhuang.tech/feed.xml</id>
        <title type="html">Luyu Huang's Tech Blog</title>

        <entry>
        <title type="html">Title 1</title>
        <link href="https://luyuhuang.tech/2020/06/03/cloudflare-free-https.html"/>
        <published>2020-06-03T00:00:00+08:00</published>
        <content type="html">Some Content</content>
        </entry>

        <entry>
        <title type="html">Title 2</title>
        <link href="https://luyuhuang.tech/2020/05/22/nginx-beginners-guide.html"/>
        <published>2020-05-22T00:00:00+08:00</published>
        <content type="html">Another Content</content>
        </entry>

        </feed>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert.equal(summary.title, "Luyu Huang's Tech Blog");
        assert.equal(summary.link, 'https://luyuhuang.tech/');
        assert.equal(entries.length, 2);
        assert.equal(entries[0].title, 'Title 1');
        assert.equal(entries[0].link, 'https://luyuhuang.tech/2020/06/03/cloudflare-free-https.html');
        assert.equal(entries[0].content, '<html><head></head><body>Some Content</body></html>');
        assert.equal(entries[1].title, 'Title 2');
        assert.equal(entries[1].link, 'https://luyuhuang.tech/2020/05/22/nginx-beginners-guide.html');
        assert.equal(entries[1].content, '<html><head></head><body>Another Content</body></html>');
    });

    test('dual links', () => {
        const xml = `
        <?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
        <link href="https://luyuhuang.tech/feed.xml" rel="self"/>
        <link href="https://luyuhuang.tech/" rel="alternate"/>
        <id>https://luyuhuang.tech/feed.xml</id>
        <title type="html">Luyu Huang's Tech Blog</title>
        <entry>
        <title type="html">Title 1</title>
        <link>https://luyuhuang.tech/</link>
        <link rel="alternate">https://luyuhuang.tech/2020/06/03/cloudflare-free-https.html</link>
        <published>2020-06-03T00:00:00+08:00</published>
        <content type="html">Some Content</content>
        </entry>
        </feed>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert.equal(summary.title, "Luyu Huang's Tech Blog");
        assert.equal(summary.link, 'https://luyuhuang.tech/');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].title, 'Title 1');
        assert.equal(entries[0].link, 'https://luyuhuang.tech/2020/06/03/cloudflare-free-https.html');
        assert.equal(entries[0].content, '<html><head></head><body>Some Content</body></html>');
    });

    test('cdata link', () => {
        const xml = `
        <rss version="2.0">
        <channel>
        <title>Site Title</title>
        <link>http://world.huanqiu.com</link>
        <item>
        <title><![CDATA[Title 1]]></title>
        <link><![CDATA[http://world.huanqiu.com/exclusive/2020-06/16558145.html]]></link>
        <description><![CDATA[Description 1]]></description>
        <content><![CDATA[Content 1]]></content>
        <pubDate>2020-06-18</pubDate>
        </item>
        </channel>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert.equal(summary.title, "Site Title");
        assert.equal(summary.link, 'http://world.huanqiu.com');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].title, 'Title 1');
        assert.equal(entries[0].link, 'http://world.huanqiu.com/exclusive/2020-06/16558145.html');
        assert.equal(entries[0].content, '<html><head></head><body>Content 1</body></html>');
    });

    test('id', () => {
        const xml = `
        <rss version="2.0">
        <channel>
        <title>Site Title</title>
        <link>http://world.huanqiu.com</link>
        <item>
        <title><![CDATA[Title 1]]></title>
        <link>http://world.huanqiu.com/exclusive/2020-06/16558145.html</link>
        <guid>41d2104c-3453-42d9-9aff-7c3447913a42</guid>
        <description><![CDATA[Description 1]]></description>
        <content><![CDATA[Content 1]]></content>
        <pubDate>2020-06-18</pubDate>
        </item>
        </channel>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert.equal(summary.title, "Site Title");
        assert.equal(summary.link, 'http://world.huanqiu.com');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].title, 'Title 1');
        assert.equal(entries[0].link, 'http://world.huanqiu.com/exclusive/2020-06/16558145.html');
        assert.equal(entries[0].id, sha256('http://world.huanqiu.com41d2104c-3453-42d9-9aff-7c3447913a42'));
        assert.equal(entries[0].content, '<html><head></head><body>Content 1</body></html>');
    });

    test('use link as id', () => {
        const xml = `
        <rss version="2.0">
        <channel>
        <title>Site Title</title>
        <link>http://world.huanqiu.com</link>
        <item>
        <title><![CDATA[Title 1]]></title>
        <link>http://world.huanqiu.com/exclusive/2020-06/16558145.html</link>
        <description><![CDATA[Description 1]]></description>
        <content><![CDATA[Content 1]]></content>
        <pubDate>2020-06-18</pubDate>
        </item>
        </channel>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert.equal(summary.title, "Site Title");
        assert.equal(summary.link, 'http://world.huanqiu.com');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].title, 'Title 1');
        assert.equal(entries[0].link, 'http://world.huanqiu.com/exclusive/2020-06/16558145.html');
        assert.equal(entries[0].id, sha256('http://world.huanqiu.comhttp://world.huanqiu.com/exclusive/2020-06/16558145.html'));
        assert.equal(entries[0].content, '<html><head></head><body>Content 1</body></html>');
    });

    test('atom date', () => {
        const xml = `
        <?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
        <link href="https://luyuhuang.tech/"/>
        <id>https://luyuhuang.tech/feed.xml</id>
        <title type="html">Luyu Huang's Tech Blog</title>
        <entry>
        <title type="html">Title 1</title>
        <link href="https://luyuhuang.tech/2020/06/03/cloudflare-free-https.html"/>
        <published>2020-06-03T00:00:00+08:00</published>
        <content type="html">Some Content</content>
        </entry>
        </feed>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert.equal(entries[0].date, new Date('2020-06-03T00:00:00+08:00').getTime());

    });

    test('rss2 date', () => {
        const xml = `
        <rss version="2.0">
        <channel>
        <title>Site Title</title>
        <link>http://world.huanqiu.com</link>
        <item>
        <title><![CDATA[Title 1]]></title>
        <link><![CDATA[http://world.huanqiu.com/exclusive/2020-06/16558145.html]]></link>
        <description><![CDATA[Description 1]]></description>
        <content><![CDATA[Content 1]]></content>
        <pubDate>2020-06-18</pubDate>
        </item>
        </channel>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert.equal(entries[0].date, new Date('2020-06-18').getTime());
    });

    test('missing date', () => {
        const xml = `
        <rss version="2.0">
        <channel>
        <title>Site Title</title>
        <link>http://world.huanqiu.com</link>
        <item>
        <title><![CDATA[Title 1]]></title>
        <link><![CDATA[http://world.huanqiu.com/exclusive/2020-06/16558145.html]]></link>
        <description><![CDATA[Description 1]]></description>
        <content><![CDATA[Content 1]]></content>
        </item>
        </channel>
        `;
        const [entries, summary] = parser.parseXML(xml, new Set());
        assert(new Date().getTime() - entries[0].date < 10);
    });
});
