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
        public feed: string
    ) {}

    static fromEntry(entry: Entry, feed: string) {
        return new Abstract(entry.title, entry.date, entry.link, entry.read, feed);
    }

    static fromArticle(article: Article) {
        return new Abstract(article.title, article.date, article.link, article.read, article.feed);
    }
}

export class Summary {
    constructor(
        public link: string,
        public title: string,
        public catelog: string[] = [],
        public ok: boolean = true,
    ) {}

    static fromFeed(feed: Feed) {
        return new Summary(feed.link, feed.title, [], feed.ok);
    }
}

export interface Feed {
    feed: string,
    account: string,

    link: string,
    title: string,
    ok: boolean
}

export interface Article {
    link: string,
    feed: string,
    account: string,

    title: string,
    date: number,
    read: boolean
}