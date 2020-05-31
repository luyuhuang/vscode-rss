# VSCode-RSS

嵌入在 Visual Studio Code 中的 RSS 阅读器

[![version](https://vsmarketplacebadge.apphb.com/version/luyuhuang.rss.svg)](https://marketplace.visualstudio.com/items?itemName=luyuhuang.rss)

![demonstrate1](https://s1.ax1x.com/2020/05/20/YoIhK1.gif)

[English](README.md)

## 介绍

VSCode-RSS 是一个 Visual Studio Code 扩展, 它提供了一个嵌入式的 RSS 阅读器. 有了它你就可以在长时间写代码之后在 VScode 中自由地阅读新闻和博客. 现已支持 [Tiny Tiny RSS](https://tt-rss.org/), 它可以让你在不同的设备之间同步 RSS. VSCode-RSS 很容易使用, 基本不需要手动修改配置文件.

- [x] 多账户;
- [x] 支持 Tiny Tiny RSS;
- [x] 支持多种 RSS 格式;
- [x] 自动更新;
- [x] 支持收藏夹;
- [x] 阅读标记;

## 使用

VSCode-RSS 支持两种类型的账户, 本地账户和 ttrss(Tiny Tiny RSS) 账户. VSCode-RSS 默认会创建一个本地账户.

对于本地账户, 它会将数据存储在本地. 点击 "ACCOUNTS" 面板上的 "+" 按钮并选择 "local" 选项, 然后输入一个账户名即可创建一个本地账户. 账户名是随意的, 仅用于显示.

对于 ttrss 账户, 它会从 Tiny Tiny RSS 服务器上获取数据并且与服务器同步阅读记录, 因此它会与其他客户端 (例如你 Mac 上的 Reeder 或者是你手机上的 FeedMe) 有着同样的数据. 如果你不了解 TTRSS, 见 [https://tt-rss.org/](https://tt-rss.org/). 要创建一个 ttrss 账户, 点击 "ACCOUNTS" 面板上的 "+" 按钮并选择 "ttrss" 选项, 然后输入账户名, 服务器地址, 用户名和密码. 账户名仅用于显示, 服务器地址, 用户名和密码则取决于你的 TTRSS 服务器.

![demonstrate2](https://s1.ax1x.com/2020/05/20/YoIWvR.gif)

正如本文开头所演示的, 点击 "FEEDS" 面板上的 "+" 按钮并输入订阅源的 URL 即可添加订阅. 如果是 ttrss 账户, 它还会与服务器同步.

## 配置

如果有需要也可以手动修改配置

| Name | Type | Description |
|:-----|:-----|:------------|
| `rss.accounts` | `object` | 订阅账户, 你可以修改 `name` 字段或者调整列表的顺序, 但是**千万不要**修改键值和 `type` 字段. |
| `rss.interval` | `integer` | 自动刷新的时间间隔 (秒) |
| `rss.timeout` | `integer` | 请求超时时间 (秒) |
| `rss.retry` | `integer` | 请求重试次数 |

Enjoy it!
