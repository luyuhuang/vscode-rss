# VSCode-RSS

A RSS reader embedded in Visual Studio Code

[![version](https://vsmarketplacebadge.apphb.com/version/luyuhuang.rss.svg)](https://marketplace.visualstudio.com/items?itemName=luyuhuang.rss)

![demonstrate](https://raw.githubusercontent.com/luyuhuang/vscode-rss/master/demonstrate.gif)

## Introduction

VSCode-RSS is a Visual Studio Code extension that provides an embedded RSS reader. With it you can read news and blog freely in VSCode after long time of coding. It is simple to configure and easy to use.

- [x] Support multiple RSS formats;
- [x] Automatic update;
- [x] Simple configuration;
- [x] Read / unread marks;
- [x] Handling relative paths.

## Configuration

| Name | Type | Description |
|:-----|:-----|:------------|
| `rss.feeds` | `Array<string>` | RSS feed URLs |
| `rss.interval` | `integer` | Automatic refresh interval (s) |
| `rss.timeout` | `integer` | Request timeout (s) |
| `rss.retry` | `integer` | Request retries |

Example:

```json
{
    "rss.feeds": [
        "https://luyuhuang.github.io/feed.xml",
        "https://github.com/luyuhuang/vscode-rss/commits/master.atom",
        "https://nodejs.org/en/feed/blog.xml"
    ],
    "rss.interval": 3600
}
```
