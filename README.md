# VSCode-RSS

A RSS reader embedded in Visual Studio Code

[![version](https://vsmarketplacebadge.apphb.com/version/luyuhuang.rss.svg)](https://marketplace.visualstudio.com/items?itemName=luyuhuang.rss)
[![test](https://github.com/luyuhuang/vscode-rss/workflows/test/badge.svg)](https://github.com/luyuhuang/vscode-rss/actions/)

![demonstrate1](https://s1.ax1x.com/2020/06/18/Nmyedf.gif)

[简体中文](README_zh.md)

## Introduction

VSCode-RSS is a Visual Studio Code extension that provides an embedded RSS reader. With it you can read news and blog freely in VSCode after long time of coding. [Tiny Tiny RSS](https://tt-rss.org/) is now supported, which allows you to sync RSS between devices. VSCode-RSS is easy to use and require little to manually modify the configuration.

- [x] Multiple accounts;
- [x] Support Tiny Tiny RSS;
- [x] Support multiple RSS formats;
- [x] Automatic update;
- [x] Support favorites;
- [x] Read / unread marks;

## Usage

VSCode-RSS has two types of accounts, local account and ttrss(Tiny Tiny RSS) account. VSCode-RSS will create a local account by default.

For local account, it will store the data locally. Click the "+" button on the "ACCOUNTS" view and select "local" option, then enter the account name to create a local account. Account name is arbitrary, just for display.

For ttrss account, it will fetch data from Tiny Tiny RSS server and synchronize reading records with that server, so it has the same data as other clients(such as Reeder on you Mac or FeedMe on your phone). If you don't know TTRSS, see [https://tt-rss.org/](https://tt-rss.org/) for more information. To create a ttrss account, click the "+" button on the "ACCOUNTS" view and select "ttrss" option, and then enter the account name, server address, username and password. Account name is just for display, while server address, username and password depends on your TTRSS server.

![demonstrate2](https://s1.ax1x.com/2020/05/20/YoIWvR.gif)

Just as demonstrated at the beginning of this README, click the "+" button on the "FEEDS" view and enter the feed URL to add a feed. For ttrss account, it'll sync to the server.

## Configuration

You can modify the configuration as needed.

| Name | Type | Description |
|:-----|:-----|:------------|
| `rss.accounts` | `object` | Feed accounts, you can modify `name` field or adjust the order of the lists if you want, but **NEVER** modify the key and `type` field. |
| `rss.interval` | `integer` | Automatic refresh interval (s) |
| `rss.timeout` | `integer` | Request timeout (s) |
| `rss.retry` | `integer` | Request retries |

Enjoy it!
