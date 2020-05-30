interface Account {
    name: string;
    type: 'local' | 'ttrss';
}

type FeedTree = (string | Category)[];

interface Category {
    name: string;
    list: FeedTree;
    custom_data?: any;
}

interface LocalAccount extends Account {
    feeds: FeedTree;
}

interface TTRSSAccount extends Account {
    server: string;
    username: string;
    password: string;
}
