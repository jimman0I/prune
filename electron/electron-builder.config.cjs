module.exports = {
  appId: 'com.jimman0i.unrevo',
  productName: 'unrevo',
  directories: { output: 'dist' },
  files: ['main.cjs'],
  extraResources: [
    { from: '../backend/src', to: 'backend/src' },
    { from: '../backend/node_modules', to: 'backend/node_modules' },
    { from: '../backend/package.json', to: 'backend/package.json' },
    { from: '../frontend/dist', to: 'frontend-dist' }
  ],
  win: { target: 'nsis' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true }
};