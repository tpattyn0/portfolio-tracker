"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/portfolio/route";
exports.ids = ["app/api/portfolio/route"];
exports.modules = {

/***/ "@prisma/client":
/*!*********************************!*\
  !*** external "@prisma/client" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),

/***/ "bcryptjs":
/*!***************************!*\
  !*** external "bcryptjs" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("bcryptjs");

/***/ }),

/***/ "./action-async-storage.external":
/*!*******************************************************************************!*\
  !*** external "next/dist/client/components/action-async-storage.external.js" ***!
  \*******************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/action-async-storage.external.js");

/***/ }),

/***/ "./request-async-storage.external":
/*!********************************************************************************!*\
  !*** external "next/dist/client/components/request-async-storage.external.js" ***!
  \********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/request-async-storage.external.js");

/***/ }),

/***/ "./static-generation-async-storage.external":
/*!******************************************************************************************!*\
  !*** external "next/dist/client/components/static-generation-async-storage.external.js" ***!
  \******************************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/static-generation-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "assert":
/*!*************************!*\
  !*** external "assert" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "events":
/*!*************************!*\
  !*** external "events" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ "querystring":
/*!******************************!*\
  !*** external "querystring" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("querystring");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fportfolio%2Froute&page=%2Fapi%2Fportfolio%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fportfolio%2Froute.ts&appDir=%2FUsers%2Fthomaspattyn%2FProjects%2Fportfolio-tracker%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fthomaspattyn%2FProjects%2Fportfolio-tracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!*******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fportfolio%2Froute&page=%2Fapi%2Fportfolio%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fportfolio%2Froute.ts&appDir=%2FUsers%2Fthomaspattyn%2FProjects%2Fportfolio-tracker%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fthomaspattyn%2FProjects%2Fportfolio-tracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \*******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _Users_thomaspattyn_Projects_portfolio_tracker_app_api_portfolio_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/portfolio/route.ts */ \"(rsc)/./app/api/portfolio/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/portfolio/route\",\n        pathname: \"/api/portfolio\",\n        filename: \"route\",\n        bundlePath: \"app/api/portfolio/route\"\n    },\n    resolvedPagePath: \"/Users/thomaspattyn/Projects/portfolio-tracker/app/api/portfolio/route.ts\",\n    nextConfigOutput,\n    userland: _Users_thomaspattyn_Projects_portfolio_tracker_app_api_portfolio_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/portfolio/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZwb3J0Zm9saW8lMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRnBvcnRmb2xpbyUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRnBvcnRmb2xpbyUyRnJvdXRlLnRzJmFwcERpcj0lMkZVc2VycyUyRnRob21hc3BhdHR5biUyRlByb2plY3RzJTJGcG9ydGZvbGlvLXRyYWNrZXIlMkZhcHAmcGFnZUV4dGVuc2lvbnM9dHN4JnBhZ2VFeHRlbnNpb25zPXRzJnBhZ2VFeHRlbnNpb25zPWpzeCZwYWdlRXh0ZW5zaW9ucz1qcyZyb290RGlyPSUyRlVzZXJzJTJGdGhvbWFzcGF0dHluJTJGUHJvamVjdHMlMkZwb3J0Zm9saW8tdHJhY2tlciZpc0Rldj10cnVlJnRzY29uZmlnUGF0aD10c2NvbmZpZy5qc29uJmJhc2VQYXRoPSZhc3NldFByZWZpeD0mbmV4dENvbmZpZ091dHB1dD0mcHJlZmVycmVkUmVnaW9uPSZtaWRkbGV3YXJlQ29uZmlnPWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBQXNHO0FBQ3ZDO0FBQ2M7QUFDeUI7QUFDdEc7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLGdIQUFtQjtBQUMzQztBQUNBLGNBQWMseUVBQVM7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLFlBQVk7QUFDWixDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsUUFBUSxpRUFBaUU7QUFDekU7QUFDQTtBQUNBLFdBQVcsNEVBQVc7QUFDdEI7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUN1SDs7QUFFdkgiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9wb3J0Zm9saW8tdHJhY2tlci8/NjJkYiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLW1vZHVsZXMvYXBwLXJvdXRlL21vZHVsZS5jb21waWxlZFwiO1xuaW1wb3J0IHsgUm91dGVLaW5kIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLWtpbmRcIjtcbmltcG9ydCB7IHBhdGNoRmV0Y2ggYXMgX3BhdGNoRmV0Y2ggfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9saWIvcGF0Y2gtZmV0Y2hcIjtcbmltcG9ydCAqIGFzIHVzZXJsYW5kIGZyb20gXCIvVXNlcnMvdGhvbWFzcGF0dHluL1Byb2plY3RzL3BvcnRmb2xpby10cmFja2VyL2FwcC9hcGkvcG9ydGZvbGlvL3JvdXRlLnRzXCI7XG4vLyBXZSBpbmplY3QgdGhlIG5leHRDb25maWdPdXRwdXQgaGVyZSBzbyB0aGF0IHdlIGNhbiB1c2UgdGhlbSBpbiB0aGUgcm91dGVcbi8vIG1vZHVsZS5cbmNvbnN0IG5leHRDb25maWdPdXRwdXQgPSBcIlwiXG5jb25zdCByb3V0ZU1vZHVsZSA9IG5ldyBBcHBSb3V0ZVJvdXRlTW9kdWxlKHtcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgIGtpbmQ6IFJvdXRlS2luZC5BUFBfUk9VVEUsXG4gICAgICAgIHBhZ2U6IFwiL2FwaS9wb3J0Zm9saW8vcm91dGVcIixcbiAgICAgICAgcGF0aG5hbWU6IFwiL2FwaS9wb3J0Zm9saW9cIixcbiAgICAgICAgZmlsZW5hbWU6IFwicm91dGVcIixcbiAgICAgICAgYnVuZGxlUGF0aDogXCJhcHAvYXBpL3BvcnRmb2xpby9yb3V0ZVwiXG4gICAgfSxcbiAgICByZXNvbHZlZFBhZ2VQYXRoOiBcIi9Vc2Vycy90aG9tYXNwYXR0eW4vUHJvamVjdHMvcG9ydGZvbGlvLXRyYWNrZXIvYXBwL2FwaS9wb3J0Zm9saW8vcm91dGUudHNcIixcbiAgICBuZXh0Q29uZmlnT3V0cHV0LFxuICAgIHVzZXJsYW5kXG59KTtcbi8vIFB1bGwgb3V0IHRoZSBleHBvcnRzIHRoYXQgd2UgbmVlZCB0byBleHBvc2UgZnJvbSB0aGUgbW9kdWxlLiBUaGlzIHNob3VsZFxuLy8gYmUgZWxpbWluYXRlZCB3aGVuIHdlJ3ZlIG1vdmVkIHRoZSBvdGhlciByb3V0ZXMgdG8gdGhlIG5ldyBmb3JtYXQuIFRoZXNlXG4vLyBhcmUgdXNlZCB0byBob29rIGludG8gdGhlIHJvdXRlLlxuY29uc3QgeyByZXF1ZXN0QXN5bmNTdG9yYWdlLCBzdGF0aWNHZW5lcmF0aW9uQXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcyB9ID0gcm91dGVNb2R1bGU7XG5jb25zdCBvcmlnaW5hbFBhdGhuYW1lID0gXCIvYXBpL3BvcnRmb2xpby9yb3V0ZVwiO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICBzZXJ2ZXJIb29rcyxcbiAgICAgICAgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBvcmlnaW5hbFBhdGhuYW1lLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fportfolio%2Froute&page=%2Fapi%2Fportfolio%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fportfolio%2Froute.ts&appDir=%2FUsers%2Fthomaspattyn%2FProjects%2Fportfolio-tracker%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fthomaspattyn%2FProjects%2Fportfolio-tracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/auth/[...nextauth]/route.ts":
/*!*********************************************!*\
  !*** ./app/api/auth/[...nextauth]/route.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ handler),\n/* harmony export */   POST: () => (/* binding */ handler),\n/* harmony export */   authOptions: () => (/* binding */ authOptions)\n/* harmony export */ });\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next-auth */ \"(rsc)/./node_modules/next-auth/index.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_auth__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next-auth/providers/credentials */ \"(rsc)/./node_modules/next-auth/providers/credentials.js\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! bcryptjs */ \"bcryptjs\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(bcryptjs__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _lib_prisma__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/lib/prisma */ \"(rsc)/./lib/prisma.ts\");\n\n\n\n\nconst authOptions = {\n    providers: [\n        (0,next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_1__[\"default\"])({\n            name: \"credentials\",\n            credentials: {\n                email: {\n                    label: \"Email\",\n                    type: \"email\"\n                },\n                password: {\n                    label: \"Password\",\n                    type: \"password\"\n                }\n            },\n            async authorize (credentials) {\n                if (!credentials?.email || !credentials?.password) {\n                    throw new Error(\"Invalid credentials\");\n                }\n                const user = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.user.findUnique({\n                    where: {\n                        email: credentials.email\n                    }\n                });\n                if (!user || !await bcryptjs__WEBPACK_IMPORTED_MODULE_2___default().compare(credentials.password, user.passwordHash)) {\n                    throw new Error(\"Invalid credentials\");\n                }\n                return {\n                    id: user.id,\n                    email: user.email,\n                    name: user.name\n                };\n            }\n        })\n    ],\n    callbacks: {\n        async session ({ session, token }) {\n            if (token && session.user) {\n                session.user.id = token.id;\n            }\n            return session;\n        },\n        async jwt ({ token, user }) {\n            if (user) {\n                token.id = user.id;\n            }\n            return token;\n        }\n    },\n    pages: {\n        signIn: \"/login\",\n        error: \"/login\"\n    },\n    session: {\n        strategy: \"jwt\",\n        maxAge: 30 * 24 * 60 * 60\n    }\n};\nconst handler = next_auth__WEBPACK_IMPORTED_MODULE_0___default()(authOptions);\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBa0Q7QUFDZ0I7QUFDcEM7QUFDUTtBQUUvQixNQUFNSSxjQUEyQjtJQUN0Q0MsV0FBVztRQUNUSiwyRUFBbUJBLENBQUM7WUFDbEJLLE1BQU07WUFDTkMsYUFBYTtnQkFDWEMsT0FBTztvQkFBRUMsT0FBTztvQkFBU0MsTUFBTTtnQkFBUTtnQkFDdkNDLFVBQVU7b0JBQUVGLE9BQU87b0JBQVlDLE1BQU07Z0JBQVc7WUFDbEQ7WUFDQSxNQUFNRSxXQUFVTCxXQUFXO2dCQUN6QixJQUFJLENBQUNBLGFBQWFDLFNBQVMsQ0FBQ0QsYUFBYUksVUFBVTtvQkFDakQsTUFBTSxJQUFJRSxNQUFNO2dCQUNsQjtnQkFFQSxNQUFNQyxPQUFPLE1BQU1YLCtDQUFNQSxDQUFDVyxJQUFJLENBQUNDLFVBQVUsQ0FBQztvQkFDeENDLE9BQU87d0JBQUVSLE9BQU9ELFlBQVlDLEtBQUs7b0JBQUM7Z0JBQ3BDO2dCQUVBLElBQUksQ0FBQ00sUUFBUSxDQUFDLE1BQU1aLHVEQUFjLENBQUNLLFlBQVlJLFFBQVEsRUFBRUcsS0FBS0ksWUFBWSxHQUFHO29CQUMzRSxNQUFNLElBQUlMLE1BQU07Z0JBQ2xCO2dCQUVBLE9BQU87b0JBQ0xNLElBQUlMLEtBQUtLLEVBQUU7b0JBQ1hYLE9BQU9NLEtBQUtOLEtBQUs7b0JBQ2pCRixNQUFNUSxLQUFLUixJQUFJO2dCQUNqQjtZQUNGO1FBQ0Y7S0FDRDtJQUNEYyxXQUFXO1FBQ1QsTUFBTUMsU0FBUSxFQUFFQSxPQUFPLEVBQUVDLEtBQUssRUFBRTtZQUM5QixJQUFJQSxTQUFTRCxRQUFRUCxJQUFJLEVBQUU7Z0JBQ3pCTyxRQUFRUCxJQUFJLENBQUNLLEVBQUUsR0FBR0csTUFBTUgsRUFBRTtZQUM1QjtZQUNBLE9BQU9FO1FBQ1Q7UUFDQSxNQUFNRSxLQUFJLEVBQUVELEtBQUssRUFBRVIsSUFBSSxFQUFFO1lBQ3ZCLElBQUlBLE1BQU07Z0JBQ1JRLE1BQU1ILEVBQUUsR0FBR0wsS0FBS0ssRUFBRTtZQUNwQjtZQUNBLE9BQU9HO1FBQ1Q7SUFDRjtJQUNBRSxPQUFPO1FBQ0xDLFFBQVE7UUFDUkMsT0FBTztJQUNUO0lBQ0FMLFNBQVM7UUFDUE0sVUFBVTtRQUNWQyxRQUFRLEtBQUssS0FBSyxLQUFLO0lBQ3pCO0FBQ0YsRUFBRTtBQUVGLE1BQU1DLFVBQVU3QixnREFBUUEsQ0FBQ0k7QUFFa0IiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9wb3J0Zm9saW8tdHJhY2tlci8uL2FwcC9hcGkvYXV0aC9bLi4ubmV4dGF1dGhdL3JvdXRlLnRzP2M4YTQiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IE5leHRBdXRoLCB7IEF1dGhPcHRpb25zIH0gZnJvbSBcIm5leHQtYXV0aFwiO1xuaW1wb3J0IENyZWRlbnRpYWxzUHJvdmlkZXIgZnJvbSBcIm5leHQtYXV0aC9wcm92aWRlcnMvY3JlZGVudGlhbHNcIjtcbmltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiQC9saWIvcHJpc21hXCI7XG5cbmV4cG9ydCBjb25zdCBhdXRoT3B0aW9uczogQXV0aE9wdGlvbnMgPSB7XG4gIHByb3ZpZGVyczogW1xuICAgIENyZWRlbnRpYWxzUHJvdmlkZXIoe1xuICAgICAgbmFtZTogXCJjcmVkZW50aWFsc1wiLFxuICAgICAgY3JlZGVudGlhbHM6IHtcbiAgICAgICAgZW1haWw6IHsgbGFiZWw6IFwiRW1haWxcIiwgdHlwZTogXCJlbWFpbFwiIH0sXG4gICAgICAgIHBhc3N3b3JkOiB7IGxhYmVsOiBcIlBhc3N3b3JkXCIsIHR5cGU6IFwicGFzc3dvcmRcIiB9XG4gICAgICB9LFxuICAgICAgYXN5bmMgYXV0aG9yaXplKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgIGlmICghY3JlZGVudGlhbHM/LmVtYWlsIHx8ICFjcmVkZW50aWFscz8ucGFzc3dvcmQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGNyZWRlbnRpYWxzXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgICAgIHdoZXJlOiB7IGVtYWlsOiBjcmVkZW50aWFscy5lbWFpbCB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICghdXNlciB8fCAhYXdhaXQgYmNyeXB0LmNvbXBhcmUoY3JlZGVudGlhbHMucGFzc3dvcmQsIHVzZXIucGFzc3dvcmRIYXNoKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgY3JlZGVudGlhbHNcIik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGlkOiB1c2VyLmlkLFxuICAgICAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgICAgIG5hbWU6IHVzZXIubmFtZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0pXG4gIF0sXG4gIGNhbGxiYWNrczoge1xuICAgIGFzeW5jIHNlc3Npb24oeyBzZXNzaW9uLCB0b2tlbiB9KSB7XG4gICAgICBpZiAodG9rZW4gJiYgc2Vzc2lvbi51c2VyKSB7XG4gICAgICAgIHNlc3Npb24udXNlci5pZCA9IHRva2VuLmlkIGFzIHN0cmluZztcbiAgICAgIH1cbiAgICAgIHJldHVybiBzZXNzaW9uO1xuICAgIH0sXG4gICAgYXN5bmMgand0KHsgdG9rZW4sIHVzZXIgfSkge1xuICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgdG9rZW4uaWQgPSB1c2VyLmlkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH1cbiAgfSxcbiAgcGFnZXM6IHtcbiAgICBzaWduSW46IFwiL2xvZ2luXCIsXG4gICAgZXJyb3I6IFwiL2xvZ2luXCIsXG4gIH0sXG4gIHNlc3Npb246IHtcbiAgICBzdHJhdGVneTogXCJqd3RcIixcbiAgICBtYXhBZ2U6IDMwICogMjQgKiA2MCAqIDYwLCAvLyAzMCBkYXlzXG4gIH1cbn07XG5cbmNvbnN0IGhhbmRsZXIgPSBOZXh0QXV0aChhdXRoT3B0aW9ucyk7XG5cbmV4cG9ydCB7IGhhbmRsZXIgYXMgR0VULCBoYW5kbGVyIGFzIFBPU1QgfTsiXSwibmFtZXMiOlsiTmV4dEF1dGgiLCJDcmVkZW50aWFsc1Byb3ZpZGVyIiwiYmNyeXB0IiwicHJpc21hIiwiYXV0aE9wdGlvbnMiLCJwcm92aWRlcnMiLCJuYW1lIiwiY3JlZGVudGlhbHMiLCJlbWFpbCIsImxhYmVsIiwidHlwZSIsInBhc3N3b3JkIiwiYXV0aG9yaXplIiwiRXJyb3IiLCJ1c2VyIiwiZmluZFVuaXF1ZSIsIndoZXJlIiwiY29tcGFyZSIsInBhc3N3b3JkSGFzaCIsImlkIiwiY2FsbGJhY2tzIiwic2Vzc2lvbiIsInRva2VuIiwiand0IiwicGFnZXMiLCJzaWduSW4iLCJlcnJvciIsInN0cmF0ZWd5IiwibWF4QWdlIiwiaGFuZGxlciIsIkdFVCIsIlBPU1QiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./app/api/auth/[...nextauth]/route.ts\n");

/***/ }),

/***/ "(rsc)/./app/api/portfolio/route.ts":
/*!************************************!*\
  !*** ./app/api/portfolio/route.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next-auth */ \"(rsc)/./node_modules/next-auth/index.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_auth__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _lib_prisma__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/lib/prisma */ \"(rsc)/./lib/prisma.ts\");\n/* harmony import */ var _app_api_auth_nextauth_route__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/app/api/auth/[...nextauth]/route */ \"(rsc)/./app/api/auth/[...nextauth]/route.ts\");\n\n\n\n\nasync function GET(request) {\n    try {\n        const session = await (0,next_auth__WEBPACK_IMPORTED_MODULE_1__.getServerSession)(_app_api_auth_nextauth_route__WEBPACK_IMPORTED_MODULE_3__.authOptions);\n        if (!session?.user?.id) {\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                error: \"Unauthorized\"\n            }, {\n                status: 401\n            });\n        }\n        const portfolio = await _lib_prisma__WEBPACK_IMPORTED_MODULE_2__.prisma.portfolio.findUnique({\n            where: {\n                userId: session.user.id\n            },\n            include: {\n                positions: {\n                    orderBy: {\n                        marketValue: \"desc\"\n                    }\n                },\n                transactions: {\n                    orderBy: {\n                        executedAt: \"desc\"\n                    },\n                    take: 10\n                }\n            }\n        });\n        if (!portfolio) {\n            // Create portfolio if it doesn't exist\n            const newPortfolio = await _lib_prisma__WEBPACK_IMPORTED_MODULE_2__.prisma.portfolio.create({\n                data: {\n                    userId: session.user.id\n                },\n                include: {\n                    positions: true,\n                    transactions: true\n                }\n            });\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                ...newPortfolio,\n                totalValue: 0,\n                totalCost: 0,\n                totalReturn: 0,\n                totalReturnPercent: 0,\n                dayChange: 0,\n                dayChangePercent: 0,\n                positions: []\n            });\n        }\n        // Calculate additional metrics\n        const positions = portfolio.positions.map((pos)=>({\n                ...pos,\n                quantity: pos.quantity.toNumber(),\n                avgCostBasis: pos.avgCostBasis.toNumber(),\n                currentPrice: pos.currentPrice.toNumber(),\n                marketValue: pos.marketValue.toNumber(),\n                unrealizedPL: pos.unrealizedPL.toNumber(),\n                unrealizedPLPercent: pos.unrealizedPLPercent.toNumber()\n            }));\n        const totalValue = positions.reduce((sum, pos)=>sum + pos.marketValue, 0);\n        const totalCost = positions.reduce((sum, pos)=>sum + pos.quantity * pos.avgCostBasis, 0);\n        const totalReturn = totalValue - totalCost;\n        const totalReturnPercent = totalCost > 0 ? totalReturn / totalCost * 100 : 0;\n        // Mock daily change (in real app, compare with yesterday's close)\n        const dayChange = totalValue * 0.0127; // Mock 1.27% change\n        const dayChangePercent = 1.27;\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            ...portfolio,\n            totalValue,\n            totalCost,\n            totalReturn,\n            totalReturnPercent,\n            dayChange,\n            dayChangePercent,\n            positions,\n            transactions: portfolio.transactions.map((tx)=>({\n                    ...tx,\n                    quantity: tx.quantity.toNumber(),\n                    price: tx.price.toNumber(),\n                    totalAmount: tx.totalAmount.toNumber(),\n                    fees: tx.fees.toNumber()\n                }))\n        });\n    } catch (error) {\n        console.error(\"Portfolio fetch error:\", error);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Failed to fetch portfolio\"\n        }, {\n            status: 500\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LENBQUNWLFFBQVE7Z0JBQ3hCO1FBQ0Y7SUFDRixFQUFFLE9BQU96QixPQUFPO1FBQ2RvQyxRQUFRcEMsS0FBSyxDQUFDLDBCQUEwQkE7UUFDeEMsT0FBT1YscURBQVlBLENBQUNTLElBQUksQ0FDdEI7WUFBRUMsT0FBTztRQUE0QixHQUNyQztZQUFFQyxRQUFRO1FBQUk7SUFFbEI7QUFDRiIsInNvdXJjZXMiOlsid2VicGFjazovL3BvcnRmb2xpby10cmFja2VyLy4vYXBwL2FwaS9wb3J0Zm9saW8vcm91dGUudHM/OTBlYSJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSBcIm5leHQvc2VydmVyXCI7XG5pbXBvcnQgeyBnZXRTZXJ2ZXJTZXNzaW9uIH0gZnJvbSBcIm5leHQtYXV0aFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIkAvbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgYXV0aE9wdGlvbnMgfSBmcm9tIFwiQC9hcHAvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZVwiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gR0VUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGdldFNlcnZlclNlc3Npb24oYXV0aE9wdGlvbnMpO1xuICAgIFxuICAgIGlmICghc2Vzc2lvbj8udXNlcj8uaWQpIHtcbiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihcbiAgICAgICAgeyBlcnJvcjogXCJVbmF1dGhvcml6ZWRcIiB9LFxuICAgICAgICB7IHN0YXR1czogNDAxIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgcG9ydGZvbGlvID0gYXdhaXQgcHJpc21hLnBvcnRmb2xpby5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IHVzZXJJZDogc2Vzc2lvbi51c2VyLmlkIH0sXG4gICAgICBpbmNsdWRlOiB7XG4gICAgICAgIHBvc2l0aW9uczoge1xuICAgICAgICAgIG9yZGVyQnk6IHsgbWFya2V0VmFsdWU6IFwiZGVzY1wiIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHRyYW5zYWN0aW9uczoge1xuICAgICAgICAgIG9yZGVyQnk6IHsgZXhlY3V0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgICAgICB0YWtlOiAxMCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXBvcnRmb2xpbykge1xuICAgICAgLy8gQ3JlYXRlIHBvcnRmb2xpbyBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICBjb25zdCBuZXdQb3J0Zm9saW8gPSBhd2FpdCBwcmlzbWEucG9ydGZvbGlvLmNyZWF0ZSh7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICB1c2VySWQ6IHNlc3Npb24udXNlci5pZCxcbiAgICAgICAgfSxcbiAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgIHBvc2l0aW9uczogdHJ1ZSxcbiAgICAgICAgICB0cmFuc2FjdGlvbnM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHtcbiAgICAgICAgLi4ubmV3UG9ydGZvbGlvLFxuICAgICAgICB0b3RhbFZhbHVlOiAwLFxuICAgICAgICB0b3RhbENvc3Q6IDAsXG4gICAgICAgIHRvdGFsUmV0dXJuOiAwLFxuICAgICAgICB0b3RhbFJldHVyblBlcmNlbnQ6IDAsXG4gICAgICAgIGRheUNoYW5nZTogMCxcbiAgICAgICAgZGF5Q2hhbmdlUGVyY2VudDogMCxcbiAgICAgICAgcG9zaXRpb25zOiBbXSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENhbGN1bGF0ZSBhZGRpdGlvbmFsIG1ldHJpY3NcbiAgICBjb25zdCBwb3NpdGlvbnMgPSBwb3J0Zm9saW8ucG9zaXRpb25zLm1hcChwb3MgPT4gKHtcbiAgICAgIC4uLnBvcyxcbiAgICAgIHF1YW50aXR5OiBwb3MucXVhbnRpdHkudG9OdW1iZXIoKSxcbiAgICAgIGF2Z0Nvc3RCYXNpczogcG9zLmF2Z0Nvc3RCYXNpcy50b051bWJlcigpLFxuICAgICAgY3VycmVudFByaWNlOiBwb3MuY3VycmVudFByaWNlLnRvTnVtYmVyKCksXG4gICAgICBtYXJrZXRWYWx1ZTogcG9zLm1hcmtldFZhbHVlLnRvTnVtYmVyKCksXG4gICAgICB1bnJlYWxpemVkUEw6IHBvcy51bnJlYWxpemVkUEwudG9OdW1iZXIoKSxcbiAgICAgIHVucmVhbGl6ZWRQTFBlcmNlbnQ6IHBvcy51bnJlYWxpemVkUExQZXJjZW50LnRvTnVtYmVyKCksXG4gICAgfSkpO1xuXG4gICAgY29uc3QgdG90YWxWYWx1ZSA9IHBvc2l0aW9ucy5yZWR1Y2UoXG4gICAgICAoc3VtLCBwb3MpID0+IHN1bSArIHBvcy5tYXJrZXRWYWx1ZSxcbiAgICAgIDBcbiAgICApO1xuXG4gICAgY29uc3QgdG90YWxDb3N0ID0gcG9zaXRpb25zLnJlZHVjZShcbiAgICAgIChzdW0sIHBvcykgPT4gc3VtICsgKHBvcy5xdWFudGl0eSAqIHBvcy5hdmdDb3N0QmFzaXMpLFxuICAgICAgMFxuICAgICk7XG5cbiAgICBjb25zdCB0b3RhbFJldHVybiA9IHRvdGFsVmFsdWUgLSB0b3RhbENvc3Q7XG4gICAgY29uc3QgdG90YWxSZXR1cm5QZXJjZW50ID0gdG90YWxDb3N0ID4gMCA/ICh0b3RhbFJldHVybiAvIHRvdGFsQ29zdCkgKiAxMDAgOiAwO1xuXG4gICAgLy8gTW9jayBkYWlseSBjaGFuZ2UgKGluIHJlYWwgYXBwLCBjb21wYXJlIHdpdGggeWVzdGVyZGF5J3MgY2xvc2UpXG4gICAgY29uc3QgZGF5Q2hhbmdlID0gdG90YWxWYWx1ZSAqIDAuMDEyNzsgLy8gTW9jayAxLjI3JSBjaGFuZ2VcbiAgICBjb25zdCBkYXlDaGFuZ2VQZXJjZW50ID0gMS4yNztcblxuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7XG4gICAgICAuLi5wb3J0Zm9saW8sXG4gICAgICB0b3RhbFZhbHVlLFxuICAgICAgdG90YWxDb3N0LFxuICAgICAgdG90YWxSZXR1cm4sXG4gICAgICB0b3RhbFJldHVyblBlcmNlbnQsXG4gICAgICBkYXlDaGFuZ2UsXG4gICAgICBkYXlDaGFuZ2VQZXJjZW50LFxuICAgICAgcG9zaXRpb25zLFxuICAgICAgdHJhbnNhY3Rpb25zOiBwb3J0Zm9saW8udHJhbnNhY3Rpb25zLm1hcCh0eCA9PiAoe1xuICAgICAgICAuLi50eCxcbiAgICAgICAgcXVhbnRpdHk6IHR4LnF1YW50aXR5LnRvTnVtYmVyKCksXG4gICAgICAgIHByaWNlOiB0eC5wcmljZS50b051bWJlcigpLFxuICAgICAgICB0b3RhbEFtb3VudDogdHgudG90YWxBbW91bnQudG9OdW1iZXIoKSxcbiAgICAgICAgZmVlczogdHguZmVlcy50b051bWJlcigpLFxuICAgICAgfSkpLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJQb3J0Zm9saW8gZmV0Y2ggZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oXG4gICAgICB7IGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBwb3J0Zm9saW9cIiB9LFxuICAgICAgeyBzdGF0dXM6IDUwMCB9XG4gICAgKTtcbiAgfVxufSJdLCJuYW1lcyI6WyJOZXh0UmVzcG9uc2UiLCJnZXRTZXJ2ZXJTZXNzaW9uIiwicHJpc21hIiwiYXV0aE9wdGlvbnMiLCJHRVQiLCJyZXF1ZXN0Iiwic2Vzc2lvbiIsInVzZXIiLCJpZCIsImpzb24iLCJlcnJvciIsInN0YXR1cyIsInBvcnRmb2xpbyIsImZpbmRVbmlxdWUiLCJ3aGVyZSIsInVzZXJJZCIsImluY2x1ZGUiLCJwb3NpdGlvbnMiLCJvcmRlckJ5IiwibWFya2V0VmFsdWUiLCJ0cmFuc2FjdGlvbnMiLCJleGVjdXRlZEF0IiwidGFrZSIsIm5ld1BvcnRmb2xpbyIsImNyZWF0ZSIsImRhdGEiLCJ0b3RhbFZhbHVlIiwidG90YWxDb3N0IiwidG90YWxSZXR1cm4iLCJ0b3RhbFJldHVyblBlcmNlbnQiLCJkYXlDaGFuZ2UiLCJkYXlDaGFuZ2VQZXJjZW50IiwibWFwIiwicG9zIiwicXVhbnRpdHkiLCJ0b051bWJlciIsImF2Z0Nvc3RCYXNpcyIsImN1cnJlbnRQcmljZSIsInVucmVhbGl6ZWRQTCIsInVucmVhbGl6ZWRQTFBlcmNlbnQiLCJyZWR1Y2UiLCJzdW0iLCJ0eCIsInByaWNlIiwidG90YWxBbW91bnQiLCJmZWVzIiwiY29uc29sZSJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./app/api/portfolio/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/prisma.ts":
/*!***********************!*\
  !*** ./lib/prisma.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   prisma: () => (/* binding */ prisma)\n/* harmony export */ });\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @prisma/client */ \"@prisma/client\");\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_prisma_client__WEBPACK_IMPORTED_MODULE_0__);\n// lib/prisma.ts\n\nconst globalForPrisma = globalThis;\nconst prisma = globalForPrisma.prisma ?? new _prisma_client__WEBPACK_IMPORTED_MODULE_0__.PrismaClient();\nif (true) globalForPrisma.prisma = prisma;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvcHJpc21hLnRzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGdCQUFnQjtBQUM4QjtBQUU5QyxNQUFNQyxrQkFBa0JDO0FBSWpCLE1BQU1DLFNBQVNGLGdCQUFnQkUsTUFBTSxJQUFJLElBQUlILHdEQUFZQSxHQUFHO0FBRW5FLElBQUlJLElBQXlCLEVBQWNILGdCQUFnQkUsTUFBTSxHQUFHQSIsInNvdXJjZXMiOlsid2VicGFjazovL3BvcnRmb2xpby10cmFja2VyLy4vbGliL3ByaXNtYS50cz85ODIyIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGxpYi9wcmlzbWEudHNcbmltcG9ydCB7IFByaXNtYUNsaWVudCB9IGZyb20gJ0BwcmlzbWEvY2xpZW50JztcblxuY29uc3QgZ2xvYmFsRm9yUHJpc21hID0gZ2xvYmFsVGhpcyBhcyB1bmtub3duIGFzIHtcbiAgcHJpc21hOiBQcmlzbWFDbGllbnQgfCB1bmRlZmluZWQ7XG59O1xuXG5leHBvcnQgY29uc3QgcHJpc21hID0gZ2xvYmFsRm9yUHJpc21hLnByaXNtYSA/PyBuZXcgUHJpc21hQ2xpZW50KCk7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSBnbG9iYWxGb3JQcmlzbWEucHJpc21hID0gcHJpc21hOyJdLCJuYW1lcyI6WyJQcmlzbWFDbGllbnQiLCJnbG9iYWxGb3JQcmlzbWEiLCJnbG9iYWxUaGlzIiwicHJpc21hIiwicHJvY2VzcyJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./lib/prisma.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/jose","vendor-chunks/next-auth","vendor-chunks/openid-client","vendor-chunks/@babel","vendor-chunks/oauth","vendor-chunks/object-hash","vendor-chunks/preact","vendor-chunks/uuid","vendor-chunks/yallist","vendor-chunks/preact-render-to-string","vendor-chunks/lru-cache","vendor-chunks/cookie","vendor-chunks/@panva","vendor-chunks/oidc-token-hash"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fportfolio%2Froute&page=%2Fapi%2Fportfolio%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fportfolio%2Froute.ts&appDir=%2FUsers%2Fthomaspattyn%2FProjects%2Fportfolio-tracker%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fthomaspattyn%2FProjects%2Fportfolio-tracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();