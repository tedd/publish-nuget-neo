var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
define("action", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /*
     * IMPORTANT: Only modify action.ts. Any modifications to action.js will be lost.
     */
    // NodeJS modules we will need
    var os = require("os"), fs = require("fs"), path = require("path"), util = require('util'), https = require("https"), execFile = require("child_process").execFile, validUrl = require('valid-url');
    var Action = /** @class */ (function () {
        function Action() {
            this._projectFilePath = process.env.INPUT_PROJECT_FILE_PATH || process.env.PROJECT_FILE_PATH;
            this._nugetKey = process.env.INPUT_NUGET_KEY || process.env.NUGET_KEY;
            this._nugetSource = process.env.INPUT_NUGET_SOURCE || process.env.NUGET_SOURCE;
            this._includeSymbols = JSON.parse(process.env.INPUT_INCLUDE_SYMBOLS || process.env.INCLUDE_SYMBOLS);
            this._tagCommit = JSON.parse(process.env.INPUT_TAG_COMMIT || process.env.TAG_COMMIT);
            this._tagFormat = process.env.INPUT_TAG_FORMAT || process.env.TAG_FORMAT;
            this._packageName = process.env.INPUT_PACKAGE_NAME || process.env.PACKAGE_NAME;
            this._rebuildProject = JSON.parse(process.env.INPUT_REBUILD_PROJECT || process.env.REBUILD_PROJECT);
            this._debug = JSON.parse(process.env.INPUT_DEBUG || process.env.DEBUG);
        }
        /* Main entry point */
        Action.prototype.run = function () {
            return __awaiter(this, void 0, void 0, function () {
                var nugetPackageExists;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            // Validate input variables and populate variables if necessary
                            this.validateAndPopulateInputs();
                            return [4 /*yield*/, this.checkNugetPackageExistsAsync(this._packageName, this._packageVersion)];
                        case 1:
                            nugetPackageExists = _a.sent();
                            this.info("NuGet package \"".concat(this._packageName, "\" version \"").concat(this._packageVersion, "\" does").concat(nugetPackageExists ? "" : " not", " exists on NuGet server \"").concat(this._nugetSource, "\"."));
                            // If package does exist we will stop here.
                            if (nugetPackageExists) {
                                this.info("Will not publish NuGet package because this version already exists on NuGet server.");
                                return [2 /*return*/];
                            }
                            if (!this._rebuildProject) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.rebuildProjectAsync()];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: 
                        // Package project
                        return [4 /*yield*/, this.packageProjectAsync()];
                        case 4:
                            // Package project
                            _a.sent();
                            // Publish package
                            return [4 /*yield*/, this.publishPackageAsync()];
                        case 5:
                            // Publish package
                            _a.sent();
                            if (!this._tagCommit) return [3 /*break*/, 7];
                            return [4 /*yield*/, this.gitCommitTagAsync];
                        case 6:
                            _a.sent();
                            _a.label = 7;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        Action.prototype.fail = function (message) {
            var optionalParameters = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                optionalParameters[_i - 1] = arguments[_i];
            }
            console.error("ERROR: " + message, optionalParameters);
            throw new Error(message);
        };
        Action.prototype.info = function (message) {
            var optionalParameters = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                optionalParameters[_i - 1] = arguments[_i];
            }
            console.log(message, optionalParameters);
        };
        Action.prototype.debug = function (message) {
            var optionalParameters = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                optionalParameters[_i - 1] = arguments[_i];
            }
            console.debug(message, optionalParameters);
        };
        Action.prototype.outputVariable = function (name, value) {
            process.stdout.write("::set-output name=".concat(name, "::").concat(value).concat(os.EOL));
        };
        Action.prototype.executeAsync = function (command, args, logSafeArgs, options) {
            if (args === void 0) { args = []; }
            if (logSafeArgs === void 0) { logSafeArgs = null; }
            if (options === void 0) { options = null; }
            return __awaiter(this, void 0, void 0, function () {
                var asyncExe, result;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (logSafeArgs === null)
                                logSafeArgs = args;
                            this.info("[executeAsync] Executing command: ".concat(command, " ").concat(logSafeArgs.join(" ")));
                            options = options || {};
                            asyncExe = util.promisify(execFile);
                            return [4 /*yield*/, asyncExe(execFile(command, args, options, function (error, stdout, stderr) {
                                    if (error)
                                        _this.fail(error);
                                    if (stderr)
                                        process.stderr.write(stderr);
                                    if (stdout)
                                        process.stdout.write(stdout);
                                }))];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Validates the user inputs from GitHub Actions
         */
        Action.prototype.validateAndPopulateInputs = function () {
            // Check that we have a valid project file path
            !fs.existsSync(this._projectFilePath) && this.fail("Project path \"".concat(this._projectFilePath, "\" does not exist."));
            !fs.lstatSync(this._projectFilePath).isFile() && this.fail("Project path \"".concat(this._projectFilePath, "\" must be a directory."));
            this.debug("Project path exists: ".concat(this._projectFilePath));
            // Check that we have a valid nuget key
            !this._nugetKey && this.fail("Nuget key must be specified.");
            // Check that we have a valid nuget source
            !validUrl.isUrl(this._nugetSource) && this.fail("Nuget source \"".concat(this._nugetSource, "\" is not a valid URL."));
            // Check that we have a valid tag format
            if (this._tagCommit) {
                !this._tagFormat && this.fail("Tag format must be specified.");
                !this._tagFormat.includes("*") && this.fail("Tag format \"".concat(this._tagFormat, "\" does not contain *."));
                this.debug("Valid tag format: %s", this._tagFormat);
            }
            if (!this._packageName) {
                var name_1 = this._packageName.match(/(?<name>[^\/]+)\.[a-z]+$/i).groups.name;
                this._packageName = name_1;
                this.debug("Package name not specified, extracted from PROJECT_FILE_PATH: \"".concat(this._packageName, "\""));
            }
            !this._packageName && this.fail("Package name must be specified.");
            // Where to search for NuGet packages
            this._nugetSearchPath = path.dirname(this._projectFilePath);
        };
        /*
         * Check NuGet server if package exists and if specified version of that package exists.
         */
        Action.prototype.checkNugetPackageExistsAsync = function (packageName, version) {
            return __awaiter(this, void 0, void 0, function () {
                var url;
                var _this = this;
                return __generator(this, function (_a) {
                    url = "".concat(this._nugetSource, "/v3-flatcontainer/").concat(this._packageName, "/index.json");
                    this.info("[checkNugetPackageExistsAsync] Checking if nuget package exists on NuGet server: \"".concat(url, "\""));
                    return [2 /*return*/, new Promise(function (packageVersionExists) {
                            https.get(url, function (res) {
                                var data = "";
                                if (res.statusCode == 404) {
                                    _this.debug("NuGet server returned HTTP status code ".concat(res.statusCode, ": Package \"").concat(packageName, "\" does not exist."));
                                    packageVersionExists(false);
                                }
                                if (res.statusCode != 200) {
                                    throw new Error("NuGet server returned nexpected HTTP status code ".concat(res.statusCode, ": ").concat(res.statusMessage, ". Assuming failure."));
                                    packageVersionExists(false);
                                }
                                res.on('data', function (chunk) { data += chunk; });
                                res.on('end', function () {
                                    // We should now have something like: { "versions": [ "1.0.0", "1.0.1" ] }
                                    // Parse JSON and check if the version exists
                                    var packages = JSON.parse(data);
                                    var exists = packages.versions.includes(version);
                                    _this.debug("NuGet server returned: ".concat(packages.versions.length, " package versions. Package version \"").concat(version, "\" is").concat(exists ? "" : " not", " in list."));
                                    packageVersionExists(exists);
                                });
                                res.on("error", function (e) {
                                    _this.fail(e);
                                    packageVersionExists(false);
                                });
                            });
                        })];
                });
            });
        };
        /**
         * Rebuild the project
         */
        Action.prototype.rebuildProjectAsync = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.info("[rebuildProjectAsync] Rebuilding project: \"".concat(this._projectFilePath, "\""));
                            return [4 /*yield*/, this.executeAsync("dotnet", ["build", "-c", "Release", this._projectFilePath])];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Package the project
         */
        Action.prototype.packageProjectAsync = function () {
            return __awaiter(this, void 0, void 0, function () {
                var params, packages;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.info("[packageProjectAsync] Packaging project: \"".concat(this._projectFilePath, "\" to \"").concat(this._nugetSearchPath, "\""));
                            // Remove existing packages
                            fs.readdirSync(this._nugetSearchPath).filter(function (fn) { return /\.s?nupkg$/.test(fn); }).forEach(function (fn) { return fs.unlinkSync(fn); });
                            params = ["pack", "-c", "Release"];
                            if (this._includeSymbols) {
                                params.push("--include-symbols");
                                params.push("-p:SymbolPackageFormat=snupkg");
                            }
                            params.push(this._projectFilePath);
                            params.push("-o");
                            params.push(this._nugetSearchPath);
                            return [4 /*yield*/, this.executeAsync("dotnet", params)];
                        case 1:
                            _a.sent();
                            packages = fs.readdirSync(this._nugetSearchPath).filter(function (fn) { return fn.endsWith("nupkg"); });
                            return [2 /*return*/, packages.join(", ")];
                    }
                });
            });
        };
        Action.prototype.publishPackageAsync = function () {
            return __awaiter(this, void 0, void 0, function () {
                var params, paramsLogSafe;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.info("[publishPackageAsync] Publishing package \"".concat(this._nugetSearchPath, "/*.nupkg\""));
                            params = ["dotnet", "nuget", "push", "".concat(this._nugetSearchPath, "/*.nupkg"), "-s", "".concat(this._nugetSource, "/v3/index.json"), "--skip-duplicate", "--force-english-output"];
                            if (!this._includeSymbols)
                                params.push("--no-symbols");
                            paramsLogSafe = params.concat(["-k", "NUGET_KEY_HIDDEN"]);
                            params = params.concat(["-k", this._nugetKey]);
                            return [4 /*yield*/, this.executeAsync("dotnet", params, paramsLogSafe)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        Action.prototype.gitCommitTagAsync = function () {
            return __awaiter(this, void 0, void 0, function () {
                var tag;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            tag = this._tagFormat.replace("*", this._packageVersion);
                            this.info("[gitCommitTagAsync] Creating tag: ".concat(tag));
                            return [4 /*yield*/, this.executeAsync("git", ["tag", tag])];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.executeAsync("git", ["push", "origin", tag])];
                        case 2:
                            _a.sent();
                            this.outputVariable("VERSION", tag);
                            return [2 /*return*/];
                    }
                });
            });
        };
        return Action;
    }());
    module.exports = {
        run: function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Run the action
                    return [4 /*yield*/, (new Action()).run()];
                    case 1:
                        // Run the action
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); }
    };
});
//# sourceMappingURL=action.js.map