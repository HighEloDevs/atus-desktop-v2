/**
 * @module
 * The version of the running build.
 */

/**
 * The application version, such as `0.2.8`. It comes from `package.json` at build time, which the
 * release checks keep equal to the version of the desktop core, so it needs no native call.
 */
export const APP_VERSION: string = __APP_VERSION__;
