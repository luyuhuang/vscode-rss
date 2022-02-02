# VSCode-RSS

嵌入在 Visual Studio Code 中的 RSS 阅读器

[![version](https://vsmarketplacebadge.apphb.com/version-short/luyuhuang.rss.svg)](https://marketplace.visualstudio.com/items?itemName=luyuhuang.rss)
[![rating](https://vsmarketplacebadge.apphb.com/rating-short/luyuhuang.rss.svg)](https://marketplace.visualstudio.com/items?itemName=luyuhuang.rss)
[![rating](https://vsmarketplacebadge.apphb.com/installs-short/luyuhuang.rss.svg)](https://marketplace.visualstudio.com/items?itemName=luyuhuang.rss)
[![test](https://github.com/luyuhuang/vscode-rss/workflows/test/badge.svg)](https://github.com/luyuhuang/vscode-rss/actions/)

![demonstrate1](https://s1.ax1x.com/2020/06/18/Nmyedf.gif)

[English](README.md)

## 介绍

VSCode-RSS 是一个 Visual Studio Code 扩展, 它提供了一个嵌入式的 RSS 阅读器. 有了它你就可以在长时间写代码之后在 VScode 中自由地阅读新闻和博客. 支持 [Tiny Tiny RSS](https://tt-rss.org/) 和 [Inoreader](https://inoreader.com), 它们可以让你在不同的设备之间同步 RSS. VSCode-RSS 很容易使用, 基本不需要手动修改配置文件.

- [x] 多账户;
- [x] 支持 Tiny Tiny RSS;
- [x] 支持 Inoreader;
- [x] 支持多种 RSS 格式;
- [x] 自动更新;
- [x] 支持收藏夹;
- [x] 滚动通知;
- [x] 阅读标记;

## 使用

### 账户

VSCode-RSS 支持三种类型的账户, 本地账户, TTRSS(Tiny Tiny RSS) 账户, 和 Inoreader 账户. VSCode-RSS 默认会创建一个本地账户.

#### 本地账户

对于本地账户, 它会将数据存储在本地. 点击 "ACCOUNTS" 面板上的 "+" 按钮并选择 "local" 选项, 然后输入一个账户名即可创建一个本地账户. 账户名是随意的, 仅用于显示.

#### TTRSS 账户

对于 TTRSS 账户, 它会从 Tiny Tiny RSS 服务器上获取数据并且与服务器同步阅读记录, 因此它会与其他客户端 (例如你 Mac 上的 Reeder 或者是你手机上的 FeedMe) 有着同样的数据. 如果你不了解 TTRSS, 见 [https://tt-rss.org/](https://tt-rss.org/). 要创建一个 ttrss 账户, 点击 "ACCOUNTS" 面板上的 "+" 按钮并选择 "ttrss" 选项, 然后输入账户名, 服务器地址, 用户名和密码. 账户名仅用于显示, 服务器地址, 用户名和密码则取决于你的 TTRSS 服务器.

![demonstrate2](https://s1.ax1x.com/2020/05/20/YoIWvR.gif)

#### Inoreader 账户

对于 Inoreader 账户, 类似于 TTRSS, 它会向 Inoreader 服务器获取和同步数据. 如果你不了解 Inoreader, 见 [https://inoreader.com](https://inoreader.com). 创建 Inoreader 账户最简单的方法就是点击创建账户按钮并选择 "inoreader", 接着输入账户名然后选择 "no" (使用默认的 app ID 和 app key). 然后, 它会提示你打开认证页面, 你只需根据提示认证你的账户即可. 一切顺利的话, 账户就创建好了.

由于 Inoreader 对单个 app 的请求数量有限制, 因此你可能需要创建并使用你自己的 app ID 和 app key. 打开你的 Inoreader 偏好设置, 点击 "其它" 中的 "开发者", 然后点击 "新应用". 任意设置一个名称并将权限范围设置为 "可读写", 然后点击 "保存".

![create_app](https://s1.ax1x.com/2020/09/04/wk0zdK.png)

然后你就能得到你的 app ID 和 app key 了.

![id_and_key](https://s1.ax1x.com/2020/09/04/wkBcTK.png)

创建一个账户, 在输入账户名后选择 "yes" 以自定义 app ID 和 app key, 然后依次输入 app ID 和 app key. 如果已经有一个账户, 则在账户列表项上右击, 选择 "Modify" 然后更改 app ID 和 app key 即可. 或者直接编辑 `setting.json`

### 添加订阅

正如本文开头所演示的, 点击 "FEEDS" 面板上的 "+" 按钮并输入订阅源的 URL 即可添加订阅. 如果是 TTRSS 或 Inoreader 账户, 它还会与服务器同步.

## 配置

如果有需要也可以手动修改配置

| Name | Type | Description |
|:-----|:-----|:------------|
| `rss.accounts` | `object` | 订阅账户, 你可以修改 `name` 字段或者调整列表的顺序, 但是**千万不要**修改键值和 `type` 字段. |
| `rss.interval` | `integer` | 自动刷新的时间间隔 (秒) |
| `rss.timeout` | `integer` | 请求超时时间 (秒) |
| `rss.retry` | `integer` | 请求重试次数 |
| `rss.fetch-unread-only` | `boolean` | 对于 TTRSS 和 Inoreader, 是否仅获取未读文章 |
| `rss.status-bar-notify` | `boolean` | 是否在状态栏显示滚动通知 |
| `rss.status-bar-update` | `integer` | 滚动通知刷新间隔 (秒) |
| `rss.status-bar-length` | `integer` | 状态栏中显示的通知的最大长度 |
| `rss.storage-path` | `string` | 数据存储路径, 必须是绝对路径 |
| `rss.inoreader-domain` | `string` | Inoreader 的域名 |
| `rss.inoreader-limit` | `string` | Inoreader 单次获取文章数量的限制 |

Enjoy it!
