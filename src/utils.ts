import * as fs from 'fs';
import * as vscode from 'vscode';

export function checkDir(context: vscode.ExtensionContext) {
    return new Promise(resolve => {
        fs.mkdir(context.globalStoragePath, resolve);
    });
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

export function removeFile(path: string) {
    return new Promise(resolve => {
        fs.unlink(path, resolve);
    });
}
