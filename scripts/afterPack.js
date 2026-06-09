/**
 * afterPack hook for electron-builder.
 *
 * better-sqlite3 is a native addon that electron-builder rebuilds automatically
 * via `postinstall` ("electron-builder install-app-deps") when you run
 * `npm ci` / `npm install` on a Windows machine or the windows-latest CI runner.
 * No manual binary surgery is needed here.
 */
exports.default = async function(context) {
  // Nothing to do — native modules are rebuilt by install-app-deps on the
  // target platform before packaging.
};
