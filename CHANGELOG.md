# Change Log

## v0.9.2 (2021-01-15)

- Using Etag to improve update efficiency
- The domain of Inoreader is configurable

## v0.9.1 (2020-11-19)

- fix activating extension error(#23)

## v0.9.0 (2020-11-14)

- Export / import from OPML(close #22)
- Clean old articles
- Data storage path is configurable(close #20 close #21)

## v0.8.1 (2020-09-24)

- Fix the problem that unable sync read status when open fetch unread only

## v0.8.0 (2020-09-04)

- **Support Inoreader**(close #14)
-  Improve some user experience

## v0.7.2 (2020-08-04)

- Compatible with feeds with missing dates(close #15)
- Hide commands from command palette

## v0.7.1 (2020-07-20)

- Use `sha256(link + id)` as primary key to resolve key conflicts

## v0.7.0 (2020-07-19)

- Use id instead of link as primary key(close #7)
- Add status bar scroll notification(close #11)

## v0.6.1 (2020-06-21)

- Deal with links with CDATA(close #6)

## v0.6.0 (2020-06-18)

- Add shortcut floating Buttons at the right bottom
- Add an option to fetch unread articles only
- Fix #2

## v0.5.0 (2020-05-31)

- Support category
- Summary of unread articles
- Favorites sync with TTRSS server
- Configuration `favorites` in `rss.accounts` is now obsolete, you can remove them after updating

## v0.4.1 (2020-05-22)

- Show progress when fetching content from server
- Optimize updating single feed

## v0.4.0 (2020-05-20)

Major update:

- Support multiple accounts
- **Support Tiny Tiny RSS**
- Configurations `rss.feeds` and `rss.favorites` are now obsolete, you can remove them after updating

## v0.3.1 (2020-05-12)

- Modify the way articles are stored
- Remove redundant menus in favorites

## v0.3.0 (2020-05-08)

- Support favorites
- Prevent page refresh when hidden

## v0.2.2 (2020-05-06)

Fix the bug that some pictures are displayed out of proportion(close #3)

## v0.2.1 (2020-05-05)

Deal with different encodings

## v0.2.0 (2020-05-03)

- Add or remove feeds in the UI
- Optimize performance

## v0.1.0 (2020-04-16)

- Fix some bugs
- Optimize feed list
- Add width limit

## v0.0.5 (2020-04-15)

Fix a feed loading error on some pages.

## v0.0.4 (2020-04-10)

Make `timeout` and `retry` configurable

## v0.0.3 (2020-04-07)

Fix errors when adding feeds

## v0.0.2 (2020-04-07)

Do some optimization

- Add progress bar
- Add timeout
- Adjust font size

## v0.0.1 (2020-04-06)

First release
