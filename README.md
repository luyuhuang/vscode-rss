# VSCode-RSS

A RSS reader embedded in Visual Studio Code

[![version](https://vsmarketplacebadge.apphb.com/version-short/luyuhuang.rss.svg)](https://marketplace.visualstudio.com/items?itemName=luyuhuang.rss)
[![rating](https://vsmarketplacebadge.apphb.com/rating-short/luyuhuang.rss.svg)](https://marketplace.visualstudio.com/items?itemName=luyuhuang.rss)
[![rating](https://vsmarketplacebadge.apphb.com/installs-short/luyuhuang.rss.svg)](https://marketplace.visualstudio.com/items?itemName=luyuhuang.rss)
[![test](https://github.com/luyuhuang/vscode-rss/workflows/test/badge.svg)](https://github.com/luyuhuang/vscode-rss/actions/)

![demonstrate1](https://s1.ax1x.com/2020/06/18/Nmyedf.gif)

[简体中文](README_zh.md)

## Introduction

VSCode-RSS is a Visual Studio Code extension that provides an embedded RSS reader. With it, you can read news and blog freely in VSCode after a long time of coding. [Tiny Tiny RSS](https://tt-rss.org/) and [Inoreader](https://innoreader.com) are supported, which allows you to sync RSS between devices. VSCode-RSS is easy to use and requires little to manually modify the configuration.

- [x] Multiple accounts;
- [x] Support Tiny Tiny RSS;
- [x] Support Inoreader;
- [x] Support multiple RSS formats;
- [x] Automatic update;
- [x] Support favorites;
- [x] Scrolling notification;
- [x] Read / unread marks;

## Usage

### Accounts

VSCode-RSS has three types of accounts, local account, TTRSS(Tiny Tiny RSS) account, and Inoreader account. VSCode-RSS will create a local account by default.

#### Local Account

For local account, it will store the data locally. Click the "+" button on the "ACCOUNTS" view and select "local" option, then enter the account name to create a local account. Account name is arbitrary, just for display.

#### TTRSS Account

For TTRSS account, it will fetch data from Tiny Tiny RSS server and synchronize reading records with the server, so it has the same data as other clients(such as Reeder on your Mac or FeedMe on your phone). If you don't know TTRSS, see [https://tt-rss.org/](https://tt-rss.org/) for more information. To create a TTRSS account, click the "+" button on the "ACCOUNTS" view and select "ttrss" option, and then enter the account name, server address, username and password. Account name is just for display, while server address, username and password depends on your TTRSS server.

![demonstrate2](https://s1.ax1x.com/2020/05/20/YoIWvR.gif)

#### Inoreader Account

For Inoreader account, similar with TTRSS account, it'll fetch and synchronize data with the Inoreader server. If you don't know Inoreader, see [https://innoreader.com](https://innoreader.com) for more information. The simplest way to create an Inoreader account is to click the add account button and select "inoreader" option, enter the account name and select "no" (using default app ID and app key). Then, you'll be prompted to open the authorization page and you should follow the tips to authenticate your Inoreader account. If it goes well, the account will be created.

Because Inoreader has a limit on the number of requests for a single app, maybe you need to create and use your own app ID and app key. Open your Inoreader preferences page, click the "Developer" in "Other", and then click the "New application". Enter an arbitrary name and set the scope to "Read and write", then click "Save".

![create_app](https://s1.ax1x.com/2020/09/04/wk0zdK.png)

Then, you'll get your app ID and app key.

![id_and_key](https://s1.ax1x.com/2020/09/04/wkBcTK.png)

Create an account, select "yes" after entering the account name to use custom app ID and app key, and enter the app ID and app key. If you already have an account, right-click on the account list item and select "Modify" to alter the app ID and app key, or edit `setting.json`.

### Add Feeds

Just as demonstrated at the beginning of this README, click the "+" button on the "FEEDS" view and enter the feed URL to add a feed. For TTRSS and Inoreader account, it'll sync to the server.

## Configuration

You can modify the configuration as needed.

| Name | Type | Description |
|:-----|:-----|:------------|
| `rss.accounts` | `object` | Feed accounts, you can modify `name` field or adjust the order of the lists if you want, but **NEVER** modify the key and `type` field. |
| `rss.interval` | `integer` | Automatic refresh interval (s) |
| `rss.timeout` | `integer` | Request timeout (s) |
| `rss.retry` | `integer` | Request retries |
| `rss.fetch-unread-only` | `boolean` | Whether to fetch unread articles only, for TTRSS and Inoreader |
| `rss.status-bar-notify` | `boolean` | Whether to show scrolling notification in status bar |
| `rss.status-bar-update` | `integer` | Scrolling notification update interval(s) |
| `rss.status-bar-length` | `integer` | Max length of notification displayed in status bar |
| `rss.storage-path` | `string` | Data storage path, must be an absolute path |

Enjoy it!
