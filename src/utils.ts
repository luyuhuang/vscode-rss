import * as fs from 'fs';
import * as fse from 'fs-extra';

export function checkDir(path: string) {
    return new Promise(resolve => fs.mkdir(path, resolve));
}

export function writeFile(path: string, data: string) {
    return new Promise(resolve => {
        fs.writeFile(path, data, {encoding: 'utf-8'}, resolve);
    });
}

export function readFile(path: string) {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data.toString('utf-8'));
            }
        });
    });
}

export function moveFile(oldPath: string, newPath: string) {
    return new Promise((resolve, reject)=> {
        fs.rename(oldPath, newPath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function readDir(path: string) {
    return new Promise<string[]>((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

export function removeFile(path: string) {
    return new Promise(resolve => {
        fs.unlink(path, resolve);
    });
}

export function removeDir(path: string) {
    return fse.remove(path);
}

export function fileExists(path: string): Promise<boolean> {
    return new Promise(resolve => {
        fs.exists(path, resolve);
    });
}

export function TTRSSApiURL(server_url: string) {
    return server_url.endsWith('/') ? server_url + 'api/' : server_url + '/api/';
}
