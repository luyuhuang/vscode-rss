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
}

export class Summary {
    constructor(
        public link: string,
        public title: string,
        public catelog: string[] = [],
        public ok: boolean = true,
        public feed_id?: number,
    ) {}
}

export class Storage {
    private constructor(
        private feed: string,
        private link: string,
        private title: string,
        private abstracts: Abstract[],
        private ok: boolean = true,
        private feed_id?: number,
    ) {}

    static fromSummary(feed: string, summary: Summary, get: (link: string) => Abstract) {
        return new Storage(feed, summary.link, summary.title,
                           summary.catelog.map(get),
                           summary.ok, summary.feed_id);
    }

    static fromJSON(json: string) {
        const obj = JSON.parse(json);
        return new Storage(obj.feed, obj.link, obj.title, obj.abstracts, obj.ok, obj.feed_id);
    }

    toSummary(set: (link: string, abstract: Abstract) => void): [string, Summary] {
        const summary = new Summary(this.link, this.title, this.abstracts.map(abs => abs.link),
                                    this.ok, this.feed_id);
        for (const abstract of this.abstracts) {
            set(abstract.link, abstract);
        }
        return [this.feed, summary];
    }

    toJSON() {
        return JSON.stringify({
            feed: this.feed,
            link: this.link,
            title: this.title,
            abstracts: this.abstracts,
            ok: this.ok,
            feed_id: this.feed_id,
        });
    }
}
