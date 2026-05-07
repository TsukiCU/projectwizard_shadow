/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as React    from 'react';
import * as ReactDOM from 'react-dom';
import { Provider }  from 'react-redux';
import { hot }       from 'react-hot-loader/root';

import ProjectWizard from './projectWizard';
import ProjectImport from './projectImport/projectImport';
import { Command }   from './core/command';
import { IStore }    from './core/store/store';
import type { Message } from '../backEnd/interface/api';

// @ts-expect-error injected by VSCode webview
export const vscode = acquireVsCodeApi();

const root       = document.getElementById('app');
const flagCreate = document.getElementById('flagCreate');
const flagImport = document.getElementById('flagImport');

let app: JSX.Element;
if (flagCreate) {
  app = (
    <Provider store={IStore.getStore()}>
      <ProjectWizard />
    </Provider>
  );
} else if (flagImport) {
  app = (
    <Provider store={IStore.getStore()}>
      <ProjectImport />
    </Provider>
  );
} else {
  // fallback – render nothing meaningful
  app = <div />;
}

ReactDOM.render(hot(app), root);

// close progress (no-op in shadow, keeps compatibility)
vscode.postMessage({ method: 'closeProgress' });

// hot-reload
const anyModule = module as any;
if (anyModule.hot) {
  anyModule.hot.accept('./index', () => ReactDOM.render(hot(app), root));
}

// messages from the extension
window.addEventListener('message', (event) => {
  const message: Message = event.data;
  const func = Reflect.get(Command, message.method);
  if (typeof func === 'function') {
    Reflect.apply(func, Command, [message]);
  }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());
