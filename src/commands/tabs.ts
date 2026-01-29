/**
 * Tabs command - list and manage browser tabs
 */

import { ChromeConnection } from '../chrome/connection.js';

export interface TabInfo {
  index: number;
  title: string;
  url: string;
  isCurrent: boolean;
}

export async function listTabs(connection: ChromeConnection): Promise<TabInfo[]> {
  const pages = await connection.getPages();
  const currentPage = connection.getCurrentPage();

  const tabs: TabInfo[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    tabs.push({
      index: i,
      title: await page.title() || '(no title)',
      url: page.url(),
      isCurrent: page === currentPage,
    });
  }

  return tabs;
}

export async function selectTab(
  connection: ChromeConnection,
  pattern: string
): Promise<TabInfo | null> {
  // Try as index first
  const index = parseInt(pattern, 10);
  let page;

  if (!isNaN(index)) {
    page = await connection.selectPageByIndex(index);
  } else {
    page = await connection.selectPage(pattern);
  }

  if (!page) return null;

  const pages = await connection.getPages();
  const pageIndex = pages.indexOf(page);

  return {
    index: pageIndex,
    title: await page.title() || '(no title)',
    url: page.url(),
    isCurrent: true,
  };
}
