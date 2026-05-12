/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as fs   from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ProjectListItem } from './interface/model';

// ─── Path helpers ────────────────────────────────────────────────────────────

export function pathIsHiproj(p: string): boolean {
  return p.endsWith('.hiproj');
}

export function getUserDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '/';
}

// ─── User config helpers ──────────────────────────────────────────────────────

const USER_CONFIG_FILE = 'shadow_userconfig.json';

export function readUserConfig(globalStoragePath: string): Record<string, string> {
  const filePath = path.join(path.dirname(globalStoragePath), USER_CONFIG_FILE);
  if (!fs.existsSync(filePath)) { return {}; }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

export function writeUserConfig(updates: Record<string, string>, globalStoragePath: string): void {
  const filePath = path.join(path.dirname(globalStoragePath), USER_CONFIG_FILE);
  const existing = readUserConfig(globalStoragePath);
  const merged   = { ...existing, ...updates };
  try {
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
  } catch {
    // non-fatal — user config persistence is best-effort
  }
}

// ─── Project list helpers ─────────────────────────────────────────────────────

// Same suffix constants as projectwizard — resolves to the shared
// ~/Library/Application Support/Code/projectlist.json that the welcome page reads.
const SUFFIX_PROJECT_LIST = '../../../projectlist.json';
const SUFFIX_LATEST_LIST  = '../../../latestlist.json';

function readJsonSafe(filePath: string): any[] {
  if (!fs.existsSync(filePath)) { return []; }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

export function addItemsToProList(items: ProjectListItem[], globalStoragePath: string): void {
  const listPath = path.join(globalStoragePath, SUFFIX_PROJECT_LIST);
  const list: ProjectListItem[] = readJsonSafe(listPath);
  for (const item of items) {
    const idx = list.findIndex((x) => x.path === item.path);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
  }
  fs.writeFileSync(listPath, JSON.stringify(list), 'utf-8');
}

export function updateOneItemToLatestList(item: ProjectListItem, globalStoragePath: string): void {
  const listPath = path.join(globalStoragePath, SUFFIX_LATEST_LIST);
  let list: ProjectListItem[] = readJsonSafe(listPath);
  list = list.filter((x) => x.path !== item.path);
  list.unshift(item);
  if (list.length > 10) { list = list.slice(0, 10); }
  fs.writeFileSync(listPath, JSON.stringify(list), 'utf-8');
}

export function getProjectList(globalStoragePath: string): ProjectListItem[] {
  return readJsonSafe(path.join(globalStoragePath, SUFFIX_PROJECT_LIST));
}

export function getLatestList(globalStoragePath: string): ProjectListItem[] {
  return readJsonSafe(path.join(globalStoragePath, SUFFIX_LATEST_LIST));
}

export function deleteFromProjectList(targetPath: string, globalStoragePath: string): void {
  const listPath   = path.join(globalStoragePath, SUFFIX_PROJECT_LIST);
  const latestPath = path.join(globalStoragePath, SUFFIX_LATEST_LIST);

  const list   = readJsonSafe(listPath).filter((x: any) => x.path !== targetPath);
  const latest = readJsonSafe(latestPath).filter((x: any) => x.path !== targetPath);

  fs.writeFileSync(listPath,   JSON.stringify(list),   'utf-8');
  fs.writeFileSync(latestPath, JSON.stringify(latest), 'utf-8');
}

// ─── hiproj helpers ───────────────────────────────────────────────────────────

export function getHiprojContent(hiprojPath: string): any {
  if (!fs.existsSync(hiprojPath)) { return null; }
  try {
    const ini = require('ini');
    return ini.parse(fs.readFileSync(hiprojPath, 'utf-8'));
  } catch {
    return null;
  }
}

/** Recursively find all .hiproj files under rootDir (max depth 5) */
export function findHiprojFiles(rootDir: string, depth = 0): string[] {
  if (depth > 5 || !fs.existsSync(rootDir)) { return []; }
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHiprojFiles(full, depth + 1));
    } else if (entry.isFile() && entry.name.endsWith('.hiproj')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Modal helper ─────────────────────────────────────────────────────────────

export function showMessageModal(opts: { content: string; infoType?: 'tips' | 'err' | 'warn' }): void {
  if (opts.infoType === 'err') {
    vscode.window.showErrorMessage(opts.content);
  } else {
    vscode.window.showInformationMessage(opts.content);
  }
}

// ─── Active workspace ─────────────────────────────────────────────────────────

export async function getActiveWorkFolderPath(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return undefined;
}
