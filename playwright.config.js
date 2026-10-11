import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: './tests/browser', timeout: 60000, workers: 1, reporter: 'list', use: { screenshot: 'only-on-failure', trace: 'retain-on-failure' }, projects: [
 {name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},
 {name:'android-chromium',use:{...devices['Pixel 5']}},
 {name:'iphone-webkit',use:{...devices['iPhone 13']}}
] });
