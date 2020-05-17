interface Account {
    name: string;
    type: 'local' | 'ttrss';
    favorites: Favorites[];
}

interface Favorites {
    name: string;
    list: string[];
}

interface LocalAccount extends Account {
    feeds: string[];
}

interface TTRSSAccount extends Account {
    server: string;
    username: string;
    password: string;
}
