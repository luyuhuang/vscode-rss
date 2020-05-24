interface Account {
    name: string;
    type: 'local' | 'ttrss';
    favorites: Favorites[];
}

interface Favorites {
    name: string;
    list: string[];
}

type FeedTree = (string | Category)[];

interface Category {
    name: string;
    list: FeedTree;
}

interface LocalAccount extends Account {
    feeds: FeedTree;
}

interface TTRSSAccount extends Account {
    server: string;
    username: string;
    password: string;
}
