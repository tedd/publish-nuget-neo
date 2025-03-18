"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**********************************************************************************
 * IMPORTANT: Only modify action.ts. Any modifications to action.js will be lost. *
 **********************************************************************************/
// Import NodeJS modules we will need
const os = require("os"), fs = require("fs"), path = require("path"), https = require("https"), 
// Import additional modules
validUrl = require('valid-url');
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
})(LogLevel || (LogLevel = {}));
class Action {
    /* Main entry point */
    async run() {
        var _a;
        let pf = "[run]";
        // Read input variables
        let config = this.readInputs();
        // Validate input variables and populate variables if necessary
        this.validateAndPopulateInputs(config);
        // Dump config to debug log (leaving nugetKey hidden)
        const configLogSafe = { ...config };
        configLogSafe.nugetKey = "***";
        Log.debug(`${pf} Configuration: ${JSON.stringify(configLogSafe, null, 2)}`);
        // Determine the list of project files to process.
        let projects = [];
        if (config.publishAllProjects) {
            // PUBLISH_ALL_PROJECTS is true: search for all projects
            projects = ProjectLocator.GetNuGetProjects("./");
            if (projects.length === 0)
                Log.fail("${pf} PUBLISH_ALL_PROJECTS is true, but no projects with <GeneratePackageOnBuild>true</GeneratePackageOnBuild> were found.");
            Log.info(`${pf} PUBLISH_ALL_PROJECTS enabled: Found ${projects.length} project(s): ${projects.join(", ")}`);
        }
        else if (config.projectFilePath) {
            // If PROJECT_FILE_PATH is provided, allow both a single project string or an array.
            if (Array.isArray(config.projectFilePath))
                projects = config.projectFilePath;
            else
                projects = [config.projectFilePath];
        }
        else {
            // No project specified; default to first found.
            const firstProject = ProjectLocator.GetFirstNuGetProject("./");
            if (!firstProject)
                Log.fail("${pf} No project file specified and no project found by search.");
            projects = [firstProject];
            Log.info(`${pf} No project specified. Using first project found: ${firstProject}`);
        }
        // If solutionFilePath is set then we precompile solution
        if (config.solutionFilePath) {
            // Validate that the solution file exists and is a file.
            this.validateFilePath(config.solutionFilePath, "SOLUTION_FILE_PATH");
            // Build it
            Log.info(`${pf} Building solution`);
            await this.rebuildProjectAsync(config.solutionFilePath, null, config.includeSymbols);
        }
        // Process each project individually.
        for (const projFile of projects) {
            // Validate that the project file exists and is a file.
            this.validateFilePath(projFile, "PROJECT_FILE_PATH");
            // Determine the NuGet search path (directory of the project file).
            const nugetSearchPath = path.dirname(projFile);
            // Determine package name: either use the provided packageName or extract from the project file name.
            let packageName = config.packageName;
            if (!packageName) {
                const match = projFile.match(/(?<name>[^\/\\]+)\.[a-z]+$/i);
                packageName = (_a = match === null || match === void 0 ? void 0 : match.groups) === null || _a === void 0 ? void 0 : _a.name;
                Log.debug(`${pf} Extracted package name "${packageName}" from project file "${projFile}"`);
            }
            // Determine package version. If not provided, extract it from versionFilePath (or the project file).
            let packageVersion = config.packageVersion;
            if (!packageVersion) {
                const versionFile = config.versionFilePath || projFile;
                this.validateFilePath(versionFile, "VERSION_FILE_PATH");
                packageVersion = this.extractRegexFromFile(versionFile, new RegExp(config.versionRegex, "im"));
                if (!packageVersion) {
                    Log.fail(`${pf} Unable to extract version from "${versionFile}" using regex "${config.versionRegex}".`);
                    const fileContent = fs.readFileSync(versionFile);
                    Log.fail(`${pf} File content: ${fileContent}`);
                }
                Log.debug(`${pf} Extracted version "${packageVersion}" from "${versionFile}"`);
            }
            // Build a Git tag from the version.
            const tag = config.tagFormat.replace("*", packageVersion);
            // Check if tag already exists (if tagging is enabled).
            if (config.tagCommit) {
                const tagExists = await this.gitCheckTagExistsAsync(tag);
                Log.debug(`${pf} Tag "${tag}" exists: ${tagExists}`);
                if (tagExists) {
                    Log.info(`${pf} Tag "${tag}" already exists. Skipping publish for project "${projFile}".`);
                    continue;
                }
                else {
                    Log.info(`${pf} Tag "${tag}" does not exist. Proceeding to publish project "${projFile}".`);
                }
            }
            // Check if package exists on NuGet server.
            const nugetPackageExists = await this.checkNuGetPackageExistsAsync(config.nugetSource, packageName, packageVersion);
            Log.info(`${pf} NuGet package "${packageName}" version "${packageVersion}" does${nugetPackageExists ? "" : " not"} exist on NuGet server "${config.nugetSource}".`);
            if (nugetPackageExists) {
                Log.info(`${pf} Skipping publish for project "${projFile}" because this version already exists on the NuGet server.`);
                continue;
            }
            // Rebuild project if specified.
            if (config.rebuildProject)
                await this.rebuildProjectAsync(projFile, null, config.includeSymbols);
            this.outputVariable("PACKAGE_VERSION", packageVersion);
            // Package project.
            await this.packageProjectAsync(projFile, nugetSearchPath, config.includeSymbols);
            // Publish package.
            await this.publishPackageAsync(config.nugetSource, config.nugetKey, nugetSearchPath, config.includeSymbols);
            // Commit a tag if publish was successful.
            if (config.tagCommit) {
                await this.gitCommitTagAsync(tag);
            }
        }
    }
    /** Write OUTPUT variables */
    outputVariable(name, value) {
        Log.debug(`[outputVariable] Setting output "${name}" to "${value}".`);
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}${os.EOL}`);
    }
    /** Execute command and route stdout and stderr to apps respective channels */
    async executeAsync(command, args = [], logSafeArgs = null, options = null) {
        let pf = "[executeAsync]";
        if (logSafeArgs === null)
            logSafeArgs = args;
        Log.info(`${pf} Executing command: ${command} ${logSafeArgs.join(" ")}`);
        options = options || {};
        return new Promise((resolve, reject) => {
            var outBuffer = "";
            var cmd = require('child_process').execFile(command, args, (err, stdout, stderr) => {
                if (err) {
                    Log.fail(err);
                    reject(err);
                }
                if (stdout) {
                    outBuffer += stdout;
                    Log.info(stdout);
                }
                if (stderr) {
                    outBuffer += stderr;
                    Log.warn(stderr);
                }
            });
            cmd.on('close', (code) => {
                if (code !== 0)
                    Log.fail(`${pf} Child process exited with code ${code}. Any code != 0 indicates an error.`);
                else
                    Log.info(`${pf} Done executing command: ${command} ${logSafeArgs.join(" ")}.`);
                resolve(outBuffer);
            });
            cmd.on('error', (err) => {
                Log.fail(err);
                reject(err);
            });
        });
    }
    /** Read INPUT environment variables and return an IActionConfig object */
    readInputs() {
        let pf = "[readInputs]";
        let config = {};
        // Read PROJECT_FILE_PATH; may be a single string or a JSON array.
        const projectInput = process.env.INPUT_PROJECT_FILE_PATH || process.env.PROJECT_FILE_PATH;
        if (projectInput) {
            try {
                const parsed = JSON.parse(projectInput);
                if (Array.isArray(parsed)) {
                    config.projectFilePath = parsed;
                }
                else {
                    config.projectFilePath = projectInput;
                }
            }
            catch (e) {
                // Not valid JSON; treat as a single string.
                config.projectFilePath = projectInput;
            }
        }
        // Read PUBLISH_ALL_PROJECTS flag (default false)
        const publishAll = process.env.INPUT_PUBLISH_ALL_PROJECTS || process.env.PUBLISH_ALL_PROJECTS || "false";
        try {
            config.publishAllProjects = JSON.parse(publishAll);
        }
        catch (e) {
            config.publishAllProjects = false;
        }
        // Read remaining inputs.
        config.solutionFilePath = process.env.INPUT_SOLUTION_FILE_PATH || process.env.SOLUTION_FILE_PATH;
        config.nugetKey = process.env.INPUT_NUGET_KEY || process.env.NUGET_KEY;
        config.nugetSource = process.env.INPUT_NUGET_SOURCE || process.env.NUGET_SOURCE;
        config.tagFormat = process.env.INPUT_TAG_FORMAT || process.env.TAG_FORMAT;
        config.packageName = process.env.INPUT_PACKAGE_NAME || process.env.PACKAGE_NAME;
        config.packageVersion = process.env.INPUT_VERSION_STATIC || process.env.VERSION_STATIC;
        config.versionFilePath = process.env.INPUT_VERSION_FILE_PATH || process.env.VERSION_FILE_PATH;
        config.versionRegex = process.env.INPUT_VERSION_REGEX || process.env.VERSION_REGEX;
        let key;
        let value;
        try {
            key = "INCLUDE_SYMBOLS";
            value = process.env.INPUT_INCLUDE_SYMBOLS || process.env.INCLUDE_SYMBOLS || "false";
            config.includeSymbols = JSON.parse(value);
            key = "TAG_COMMIT";
            value = process.env.INPUT_TAG_COMMIT || process.env.TAG_COMMIT || "false";
            config.tagCommit = JSON.parse(value);
            key = "REBUILD_PROJECT";
            value = process.env.INPUT_REBUILD_PROJECT || process.env.REBUILD_PROJECT || "true";
            config.rebuildProject = JSON.parse(value);
            key = "LOG_LEVEL";
            value = process.env.INPUT_LOG_LEVEL || process.env.LOG_LEVEL || "DEBUG";
            config.logLevel = LogLevel[value] || LogLevel.DEBUG;
        }
        catch (error) {
            Log.fail(`${pf} Error parsing variable "${key}" value "${value}": ${error}`);
        }
        // nugetSearchPath will be determined per project.
        config.nugetSearchPath = "";
        return config;
    }
    /** Validates the user input variables from GitHub Actions and populates any additional variables */
    validateAndPopulateInputs(config) {
        let pf = "[validateAndPopulateInputs]";
        if (!config.nugetKey)
            Log.fail(`${pf} NuGet key must be specified.`);
        if (!validUrl.isUri(config.nugetSource))
            Log.fail(`${pf} NuGet source "${config.nugetSource}" is not a valid URL.`);
        if (!config.projectFilePath) {
            // If no project is specified, attempt to use the first one found.
            config.projectFilePath = ProjectLocator.GetFirstNuGetProject("./");
            if (!config.projectFilePath) {
                Log.fail(`${pf} No project file specified. Attempted to resolve project file by recursive search, but could not find any .csproj/.fsproj/.vbproj files with "<GeneratePackageOnBuild>true</GeneratePackageOnBuild>".`);
            }
            Log.info(`${pf} No project file path specified. Did a recursive search and found: ${config.projectFilePath}`);
        }
        else {
            // Validate each provided project file path.
            if (typeof config.projectFilePath === "string") {
                this.validateFilePath(config.projectFilePath, "PROJECT_FILE_PATH");
            }
            else if (Array.isArray(config.projectFilePath)) {
                config.projectFilePath.forEach((proj) => {
                    this.validateFilePath(proj, "PROJECT_FILE_PATH");
                });
            }
        }
        // Check for static package version
        if (!config.packageVersion) {
            // If we don't have a static package version, use versionFilePath
            config.versionFilePath || (config.versionFilePath = config.projectFilePath); // if it's an array, this may need adjustment
            if (typeof config.versionFilePath === "string") {
                this.validateFilePath(config.versionFilePath, "VERSION_FILE_PATH");
            }
            else {
                Log.fail("${pf} VERSION_FILE_PATH must be a file path, not an array.");
            }
            if (!config.versionRegex)
                Log.fail(`${pf} VERSION_REGEX must be specified.`);
            let versionRegex;
            try {
                versionRegex = new RegExp(config.versionRegex, "im");
            }
            catch (e) {
                Log.fail(`${pf} ersion regex "${config.versionRegex}" is not a valid regular expression: ${e.message}`);
            }
            Log.debug(`${pf} Version regex is valid: "${config.versionRegex}"`);
            /*
            const version = this.extractRegexFromFile(config.versionFilePath as string, versionRegex);
            if (!version) {
                Log.fail(`[validateAndPopulateInputs] Unable to extract version from file "${config.versionFilePath}" using the regex pattern "${config.versionRegex}". Please ensure that the file contains a valid version string matching the pattern.`);
            }
            Log.debug(`[validateAndPopulateInputs] Version extracted from "${config.versionFilePath}": "${version}"`);
            config.packageVersion = version;
            */
        }
        // Check that we have a valid tag format
        if (config.tagCommit) {
            if (!config.tagFormat)
                Log.fail(`${pf} Tag format must be specified.`);
            if (!config.tagFormat.includes("*"))
                Log.fail(`${pf} Tag format "${config.tagFormat}" does not contain *.`);
            Log.debug("${pf} Valid tag format: %s", config.tagFormat);
        }
        // If packageName is not provided, it will be extracted from the project file.
    }
    /** Extracts data from file using regex */
    extractRegexFromFile(filePath, regex) {
        const fileContent = fs.readFileSync(filePath);
        var data = regex.exec(fileContent);
        if (!data)
            return null;
        return data[1];
    }
    /** Check NuGet server if package exists + if specified version of that package exists. */
    async checkNuGetPackageExistsAsync(nugetSource, packageName, version) {
        let pf = "[checkNuGetPackageExistsAsync]";
        const url = `${nugetSource}/v3-flatcontainer/${packageName}/index.json`;
        Log.info(`${pf} Checking if NuGet package exists on NuGet server: "${url}"`);
        return new Promise((packageVersionExists) => {
            https.get(url, (res) => {
                let data = "";
                if (res.statusCode == 404) {
                    Log.debug(`${pf} NuGet server returned HTTP status code ${res.statusCode}: Package "${packageName}" does not exist.`);
                    packageVersionExists(false);
                    return;
                }
                if (res.statusCode != 200) {
                    throw new Error(`${pf} NuGet server returned unexpected HTTP status code ${res.statusCode}: ${res.statusMessage} Assuming failure.`);
                }
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    const packages = JSON.parse(data);
                    const exists = packages.versions.includes(version);
                    Log.debug(`${pf} NuGet server returned: ${packages.versions.length} package versions. Package version "${version}" is${exists ? "" : " not"} in list.`);
                    packageVersionExists(exists);
                    return;
                });
                res.on("error", e => {
                    Log.fail(e);
                    packageVersionExists(false);
                    return;
                });
            });
        });
    }
    /** Rebuild the project using dotnet build */
    async rebuildProjectAsync(projectFilePath, nugetSearchPath, includeSymbols) {
        Log.info(`[rebuildProjectAsync] Rebuilding project: "${projectFilePath}"`);
        //await this.executeAsync("dotnet", ["build", "-m", "-c", "Release", projectFilePath]);
        let params = ["build", "-m", "-c", "Release"];
        if (includeSymbols) {
            params.push("-p:IncludeSymbols=true");
            params.push("-p:SymbolPackageFormat=snupkg");
        }
        params.push(projectFilePath);
        // if (nugetSearchPath) {
        // params.push("-o");
        // params.push(nugetSearchPath);
        // }
        await this.executeAsync("dotnet", params);
    }
    /** Package the project using dotnet pack */
    async packageProjectAsync(projectFilePath, nugetSearchPath, includeSymbols) {
        Log.info(`[packageProjectAsync] Packaging project: "${projectFilePath}" to "${nugetSearchPath}"`);
        // Remove existing packages
        fs.readdirSync(nugetSearchPath)
            .filter((fn) => /\.s?nupkg$/.test(fn))
            .forEach((fn) => fs.unlinkSync(`${nugetSearchPath}/${fn}`));
        // Package new
        let params = ["pack", "-m", "-c", "Release"];
        if (includeSymbols) {
            params.push("-p:IncludeSymbols=true");
            params.push("-p:SymbolPackageFormat=snupkg");
        }
        params.push(projectFilePath);
        // if (nugetSearchPath) {
        // params.push("-o");
        // params.push(nugetSearchPath);
        // }
        await this.executeAsync("dotnet", params);
    }
    /** Publish package to NuGet server using dotnet nuget push */
    async publishPackageAsync(nuGetSource, nugetKey, nugetSearchPath, includeSymbols) {
        // Find files
        const packages = fs.readdirSync(nugetSearchPath).filter((fn) => fn.endsWith("nupkg"));
        const packagePath = nugetSearchPath + "/" + packages.filter((fn) => fn.endsWith(".nupkg"))[0];
        await this.publishPackageSpecificAsync(nuGetSource, nugetKey, packagePath, includeSymbols);
        // We set some output variables that following steps may use
        this.outputVariable("PACKAGE_NAME", packagePath);
        this.outputVariable("PACKAGE_PATH", path.resolve(packagePath));
        if (includeSymbols) {
            const symbolsPath = nugetSearchPath + "/" + packages.filter((fn) => fn.endsWith(".snupkg"))[0];
            await this.publishPackageSpecificAsync(nuGetSource, nugetKey, symbolsPath, false);
            this.outputVariable("SYMBOLS_PACKAGE_NAME", symbolsPath);
            this.outputVariable("SYMBOLS_PACKAGE_PATH", path.resolve(symbolsPath));
        }
    }
    async publishPackageSpecificAsync(nuGetSource, nugetKey, packagePath, includeSymbols) {
        Log.info(`[publishPackageAsync] Publishing package "${packagePath}"`);
        let params = ["dotnet", "nuget", "push", packagePath, "-s", `${nuGetSource}/v3/index.json`, "--skip-duplicate", "--force-english-output"];
        if (!includeSymbols)
            params.push("--no-symbols");
        // Separate param array that is safe to log (no nuget key)
        let paramsLogSafe = params.concat(["-k", "NUGET_KEY_HIDDEN"]);
        params = params.concat(["-k", nugetKey]);
        await this.executeAsync("dotnet", params, paramsLogSafe);
    }
    async gitCheckTagExistsAsync(tag) {
        var text = await this.executeAsync("git", ["tag"]);
        return ("\n" + text.replace("\r\n", "\n")).includes(`\n${tag}\n`);
    }
    /** Push a tag on current commit using git tag and git push */
    async gitCommitTagAsync(tag) {
        let pf = "[gitCommitTagAsync] ";
        Log.info(`${pf} Creating tag: ${tag}`);
        await this.executeAsync("git", ["tag", tag]);
        await this.executeAsync("git", ["push", "origin", tag]);
        this.outputVariable("VERSION", tag);
    }
    validateFilePath(filePath, inputName) {
        let pf = "[validateFilePath]";
        if (!fs.existsSync(filePath)) {
            Log.fail(`${pf} The file specified in ${inputName} ("${filePath}") does not exist. Please verify your configuration.`);
        }
        if (!fs.lstatSync(filePath).isFile()) {
            Log.fail(`${pf} The path specified in ${inputName} ("${filePath}") is not a file. Please verify your configuration.`);
        }
    }
}
class ProjectLocator {
    static searchRecursive(rootDir, pattern, callback) {
        let ret = false;
        // Read contents of directory
        fs.readdirSync(rootDir).every((dir) => {
            // Obtain absolute path
            dir = path.resolve(rootDir, dir);
            // Get stats to determine if path is a directory or a file
            var stat = fs.statSync(dir);
            // If path is a directory, recurse on it
            if (stat.isDirectory())
                if (this.searchRecursive(dir, pattern, callback)) {
                    ret = true;
                    return false;
                }
            // If path is a file and ends with pattern then push it onto results
            if (stat.isFile()) {
                if (pattern.test(dir)) {
                    var done = callback(dir);
                    if (done) {
                        ret = true;
                        return false;
                    }
                }
            }
            return true;
        });
        return ret;
    }
    static isProjectFileNuGetPackage(file) {
        var fileContent = fs.readFileSync(file).toString();
        var match = this.isProjectFileNuGetPackageRegex.test(fileContent);
        Log.debug(`[isProjectFileNuGetPackage] Matched "${this.isProjectFileNuGetPackageRegex}" on file "${file}": ${match}`);
        return match;
    }
    static GetFirstNuGetProject(rootDir) {
        let projectPath = null;
        this.searchRecursive(rootDir, new RegExp(`\.(cs|fs|vb)proj$`, "i"), (file) => {
            if (this.isProjectFileNuGetPackage(file))
                projectPath = file;
            return this.isProjectFileNuGetPackage(file);
        });
        return projectPath;
    }
    static GetNuGetProjects(rootDir) {
        const projects = [];
        this.searchRecursive(rootDir, /\.(cs|fs|vb)proj$/i, (file) => {
            if (this.isProjectFileNuGetPackage(file)) {
                projects.push(file);
            }
            return false;
        });
        return projects;
    }
}
ProjectLocator.isProjectFileNuGetPackageRegex = new RegExp(`^\\s*<GeneratePackageOnBuild>\\s*true\\s*</GeneratePackageOnBuild>\\s*$`, "im");
class Log {
    static fail(message, ...optionalParameters) {
        console.error("FATAL ERROR: " + message, optionalParameters);
        if (!optionalParameters)
            message += os.EOL + JSON.stringify(optionalParameters, null, 2);
        throw new Error(message);
    }
    static warn(message, ...optionalParameters) {
        if (this.LogLevel >= LogLevel.WARN)
            console.warn("[WARN] " + message, optionalParameters);
    }
    static info(message, ...optionalParameters) {
        if (this.LogLevel >= LogLevel.INFO)
            console.log("[INFO] " + message, optionalParameters);
    }
    static debug(message, ...optionalParameters) {
        if (this.LogLevel >= LogLevel.DEBUG)
            console.debug("[DEBUG] " + message, optionalParameters);
    }
}
Log.LogLevel = LogLevel.DEBUG;
// Run the action
(new Action()).run();
//# sourceMappingURL=action.js.map