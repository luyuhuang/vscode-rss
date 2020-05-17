export class Entry {
    constructor(
        public title: string,
        public content: string,
        public date: number,
        public link: string,
        public read: boolean,
    ) {}
}

export class Abstract {
    constructor(
        public title: string,
        public date: number,
        public readonly link: string,
        public read: boolean,
        public feed: string,
        public article_id?: number,
    ) {}

    static fromEntry(entry: Entry, feed: string) {
        return new Abstract(entry.title, entry.date, entry.link, entry.read, feed);
    }

    static fromArticle(article: Article) {
        return new Abstract(article.title, article.date, article.link,
                            article.read, article.feed, article.article_id);
    }
}

export class Summary {
    constructor(
        public link: string,
        public title: string,
        public catelog: string[] = [],
        public ok: boolean = true,
        public feed_id?: number,
    ) {}

    static fromFeed(feed: Feed) {
        return new Summary(feed.link, feed.title, [], feed.ok, feed.feed_id);
    }
}

export interface Feed {
    feed: string,
    account: string,

    feed_id?: number,
    link: string,
    title: string,
    ok: boolean
}

export interface Article {
    link: string,
    feed: string,
    account: string,

    article_id?: number,
    title: string,
    date: number,
    read: boolean
}
