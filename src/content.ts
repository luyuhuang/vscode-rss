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
    public title: string;
    public date: number;
    public link: string;
    public read: boolean;

    constructor(entry: Entry) {
        this.title = entry.title;
        this.date = entry.date;
        this.link = entry.link;
        this.read = entry.read;
    }
}

export class Summary {
    constructor(
        public link: string,
        public title: string,
        public catelog: string[] = [],
        public ok: boolean = true,
    ) {}
}
