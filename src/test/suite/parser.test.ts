import * as assert from 'assert';
import * as vscode from 'vscode';
import * as parser from '../../parser';

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
});
