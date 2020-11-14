import * as vscode from 'vscode';
import { checkStoragePath, migrate } from './migrate';
import { App } from './app';

export async function activate(context: vscode.ExtensionContext) {
    const root = await checkStoragePath(context);
    await migrate(context, root);
    await App.initInstance(context, root);

    App.instance.initViews();
    App.instance.initCommands();
    App.instance.initEvents();
}
