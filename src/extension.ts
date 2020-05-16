import * as vscode from 'vscode';
import { migrate } from './migrate';
import { App } from './app';

export async function activate(context: vscode.ExtensionContext) {
    // await migrate(context);
    await App.initInstance(context);

    App.instance.initViews();
    App.instance.initCommands();
    App.instance.initEvents();
}
