/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as fs    from 'fs';
import * as path  from 'path';
import * as vscode from 'vscode';
import * as ini   from 'ini';

import { extension } from '../extension';
import { res }       from '../i18n/backEndTrans';
import { ApiMethod } from './interface/apiMethod';
import type { GetInfoCallBack, LanguageSetMessage } from './interface/api';
import type { OperateStruct, ShadowProjectData } from './interface/model';
import {
  addItemsToProList,
  updateOneItemToLatestList,
  deleteFromProjectList,
  getProjectList,
  getLatestList,
  getHiprojContent,
  findHiprojFiles,
  showMessageModal,
  getUserDir,
  readUserConfig,
  writeUserConfig,
} from './utils';

// ─── helpers ─────────────────────────────────────────────────────────────────

function postToWizard(message: any): void {
  extension.chipConfigPanel?.postMessage(message);
}

function postToImport(message: any): void {
  extension.projectImportPanel?.postMessage(message);
}

function callback(key: string, data: any, target: 'wizard' | 'import' = 'wizard'): void {
  const msg: GetInfoCallBack = {
    method: ApiMethod.GET_INFO_CALLBAK,
    params: { key, data },
  };
  if (target === 'import') {
    postToImport(msg);
  } else {
    postToWizard(msg);
  }
}

// ─── Minimal .hiproj writer ───────────────────────────────────────────────────

function writeHiproj(projectData: ShadowProjectData, projectDir: string): void {
  const hiprojPath = path.join(projectDir, `${projectData.projectName}.hiproj`);
  const content = {
    information: {
      'board_build.mcu': projectData.soc,
      board:             projectData.board,
      platform:          projectData.platform,
      project_name:      projectData.projectName,
      project_path:      projectDir,
      sdk_path:          projectData.sdkPath ?? '',
      series_name:       'shadow',
      project_type:      'SHADOW',
    },
    compile: {},
    debug:   {},
  };
  fs.writeFileSync(hiprojPath, ini.stringify(content), 'utf-8');
}

// ─── Command class ────────────────────────────────────────────────────────────

export class Command {

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  static async closeProgress(): Promise<void> {
    // no-op in shadow (no progress bar)
  }

  // ── Language / theme ───────────────────────────────────────────────────────

  static getLanguage(operate: OperateStruct): void {
    const msg: LanguageSetMessage = {
      method: ApiMethod.SET_LANGUAGE,
      params: { language: vscode.env.language },
    };
    if (operate.source === 'import') {
      postToImport(msg);
    } else {
      postToWizard(msg);
    }
  }

  // ── Chip list ──────────────────────────────────────────────────────────────

  static getJsonInfo(operate: OperateStruct): void {
    const { fileName } = operate.paramData ?? {};
    if (fileName === 'chiplist.json') {
      const chiplistPath = path.join(extension.extensionPath!, 'resources', 'chips', 'chiplist.json');
      try {
        const data = JSON.parse(fs.readFileSync(chiplistPath, 'utf-8'));
        callback('chipList', data, operate.source === 'import' ? 'import' : 'wizard');
      } catch (e) {
        callback('chipList', [], operate.source === 'import' ? 'import' : 'wizard');
      }
    }
  }

  // ── User config ────────────────────────────────────────────────────────────

  static getUserConfig(_operate: OperateStruct): void {
    const saved = extension.globalStoragePath
      ? readUserConfig(extension.globalStoragePath)
      : {};
    const cfg = {
      projectCreate_last_projectPath: saved.projectCreate_last_projectPath ?? getUserDir(),
      projectCreate_last_sdkPath:     saved.projectCreate_last_sdkPath     ?? '',
    };
    callback('userConfig', cfg);
  }

  // ── Project path dialog ────────────────────────────────────────────────────

  static selectFolderPath(operate: OperateStruct): void {
    const { key, currentValue } = operate.paramData ?? {};
    const defaultUri = currentValue && fs.existsSync(currentValue)
      ? vscode.Uri.file(currentValue)
      : vscode.Uri.file(getUserDir());

    vscode.window.showOpenDialog({
      canSelectFiles:    false,
      canSelectFolders:  true,
      canSelectMany:     false,
      defaultUri,
      title: res('selectFolderTitle'),
    }).then((result) => {
      if (result?.[0]?.fsPath) {
        const selected = result[0].fsPath;
        if (extension.globalStoragePath) {
          writeUserConfig({ projectCreate_last_projectPath: selected }, extension.globalStoragePath);
        }
        callback(key, selected);
      }
    });
  }

  // ── SDK path dialog ────────────────────────────────────────────────────────

  static selectSdkPath(operate: OperateStruct): void {
    const { key, currentValue } = operate.paramData ?? {};
    const defaultUri = currentValue && fs.existsSync(currentValue)
      ? vscode.Uri.file(currentValue)
      : vscode.Uri.file(getUserDir());

    vscode.window.showOpenDialog({
      canSelectFiles:    false,
      canSelectFolders:  true,
      canSelectMany:     false,
      defaultUri,
      title: res('slectSdkPath'),
    }).then((result) => {
      if (result?.[0]?.fsPath) {
        const selected = result[0].fsPath;
        if (extension.globalStoragePath) {
          writeUserConfig({ projectCreate_last_sdkPath: selected }, extension.globalStoragePath);
        }
        callback(key, selected);
      }
    });
  }

  // ── Path validation ────────────────────────────────────────────────────────

  static updateProjectTips(operate: OperateStruct): void {
    const { projectPath } = operate.paramData ?? {};
    if (!projectPath) { return; }
    if (fs.existsSync(projectPath)) {
      callback('projectPathRightInfo', projectPath);
    } else {
      callback('projectPathWrongInfo', projectPath);
    }
  }

  // ── Create project ─────────────────────────────────────────────────────────

  static async getProjectData(projectData: ShadowProjectData): Promise<void> {
    if (!projectData.soc || !projectData.projectName || !projectData.projectPath) {
      showMessageModal({ content: res('fieldsMissing'), infoType: 'err' });
      return;
    }

    const projectDir = path.join(projectData.projectPath, projectData.projectName);

    if (fs.existsSync(projectDir)) {
      callback('thisProjectExists', new Date().getTime());
      return;
    }

    try {
      fs.mkdirSync(projectDir, { recursive: true });
    } catch {
      showMessageModal({ content: res('createFolderFailed', [projectDir]), infoType: 'err' });
      return;
    }

    // Write .hiproj file (includes sdk_path)
    writeHiproj(projectData, projectDir);

    // Persist the chosen paths so getUserConfig can pre-fill them next time
    if (extension.globalStoragePath) {
      writeUserConfig({
        projectCreate_last_projectPath: projectData.projectPath,
        projectCreate_last_sdkPath:     projectData.sdkPath ?? '',
      }, extension.globalStoragePath);
    }

    // Update project lists — schema matches projectwizard: { name, path, chip, board, time }
    const hiprojPath = path.join(projectDir, `${projectData.projectName}.hiproj`);
    const item = {
      name:  projectData.projectName,
      path:  hiprojPath,
      chip:  projectData.soc.toUpperCase(),
      board: projectData.board.toUpperCase(),
      time:  new Date().toLocaleString('zh-CN'),
    };
    if (extension.globalStoragePath) {
      addItemsToProList([item], extension.globalStoragePath);
      updateOneItemToLatestList(item, extension.globalStoragePath);
    }

    // Signal wizard to close
    callback('thisProjectNotExists', new Date().getTime());

    // Open the project folder
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectDir));
    extension.deactivate('chipConfig');
  }

  // ── Close wizard ───────────────────────────────────────────────────────────

  static closeProjectWizard(_operate?: OperateStruct): void {
    extension.deactivate('chipConfig');
  }

  // ─── Project list (history) ────────────────────────────────────────────────

  static getProjectList(operate: OperateStruct): void {
    if (!extension.globalStoragePath) { callback('projectList', []); return; }
    const list = getProjectList(extension.globalStoragePath);
    callback('projectList', list);
  }

  static getLatestList(operate: OperateStruct): void {
    if (!extension.globalStoragePath) { callback('latestList', []); return; }
    const list = getLatestList(extension.globalStoragePath);
    callback('latestList', list);
  }

  static deleteProject(operate: OperateStruct): void {
    const { projectPath } = operate.paramData ?? {};
    if (!projectPath || !extension.globalStoragePath) { return; }
    deleteFromProjectList(projectPath, extension.globalStoragePath);
  }

  // ─── Import panel ─────────────────────────────────────────────────────────

  /** User picked a folder to scan for .hiproj files */
  static selectImportPath(_operate: OperateStruct): void {
    vscode.window.showOpenDialog({
      canSelectFiles:   false,
      canSelectFolders: true,
      canSelectMany:    false,
      defaultUri:       vscode.Uri.file(getUserDir()),
      title:            res('selectImportPath'),
    }).then((result) => {
      if (result?.[0]?.fsPath) {
        const scanPath = result[0].fsPath;
        callback('importablePath', scanPath, 'import');
        // Scan for .hiproj files
        const found = findHiprojFiles(scanPath);
        const items = found.map((hiprojPath, idx) => ({
          key:      String(idx),
          name:     path.parse(hiprojPath).name,
          path:     hiprojPath,
          disabled: false,
        }));
        callback('importableItemsInfo', items, 'import');
      }
    });
  }

  /** Confirm import: add selected .hiproj files to the project list */
  static confirmImport(operate: OperateStruct): void {
    const selectedPaths: string[] = operate.paramData?.selectedPaths ?? [];
    if (!extension.globalStoragePath) { return; }

    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const hiprojPath of selectedPaths) {
      const content = getHiprojContent(hiprojPath);
      if (!content) { failed.push(hiprojPath); continue; }
      const chip  = (content?.information?.['board_build.mcu'] ?? '').toUpperCase();
      const board = (content?.information?.board ?? chip).toUpperCase();
      const item = {
        name:  path.parse(hiprojPath).name,
        path:  hiprojPath,
        chip,
        board,
        time:  new Date().toLocaleString('zh-CN'),
      };
      addItemsToProList([item], extension.globalStoragePath!);
      updateOneItemToLatestList(item, extension.globalStoragePath!);
      succeeded.push(hiprojPath);
    }

    callback('importResult', { succeeded, failed }, 'import');

    if (failed.length === 0) {
      showMessageModal({ content: res('importSuccess') });
    } else {
      showMessageModal({ content: res('importPartialFailed', [String(failed.length)]), infoType: 'warn' });
    }

    extension.deactivate('projectImport');
  }

  /** Open a project by .hiproj path */
  static async openProject(operate: OperateStruct): Promise<void> {
    const hiprojPath: string = operate.paramData?.path ?? '';
    if (!hiprojPath || !fs.existsSync(hiprojPath)) {
      showMessageModal({ content: res('pathNotExist', [hiprojPath]), infoType: 'err' });
      return;
    }
    const projectDir = path.dirname(hiprojPath);
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectDir));
  }

  /** Update folder path (called on .hiproj watch change, kept for compatibility) */
  static updateFolderPath(): void { /* no-op in shadow */ }
}
