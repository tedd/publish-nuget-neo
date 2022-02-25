import { SpawnOptionsWithStdioTuple, StdioPipe } from "child_process";
import { IncomingMessage } from "http";

/**********************************************************************************
 * IMPORTANT: Only modify action.ts. Any modifications to action.js will be lost. *
 **********************************************************************************/

const
    // Import NodeJS modules we will need
    os = require("os"),
    fs = require("fs"),
    path = require("path"),
    https = require("https"),
    spawn = require("child_process").spawn,
    // Import additional modules
    validUrl = require('valid-url');

/** Structure returned from NUGET_SOURCE/v3-flatcontainer/PACKAGE_NAME/index.json */
interface IPackageVersions {
    versions: string[];
}

enum LogLevel {
    DEBUG = 3,
    INFO = 2,
    WARN = 1
}

interface IActionConfig {
    projectFilePath: string;
    nugetSearchPath: string;
    nugetKey: string;
    nugetSource: string;
    packageName: string;
    packageVersion: string;
    includeSymbols: boolean;
    tagCommit: boolean;
    tagFormat: string;
    rebuildProject: boolean;
    logLevel: LogLevel;
    versionFilePath: string;
    versionRegex: string;
}

class Action {

    /* Main entry point */
    public async run(): Promise<void> {
        // Read input variables
        let config = this.readInputs();

        // Validate input variables and populate variables if necessary
        this.validateAndPopulateInputs(config);

        const configLogSafe = { ...config };
        configLogSafe.nugetKey = "***";
        Log.info(`[run] Configuration: ${JSON.stringify(configLogSafe)}`);

        // Check if package exists on NuGet server.
        const nugetPackageExists = await this.checkNuGetPackageExistsAsync(config.nugetSource, config.packageName, config.packageVersion);
        Log.info(`NuGet package "${config.packageName}" version "${config.packageVersion}" does${nugetPackageExists ? "" : " not"} exists on NuGet server "${config.nugetSource}".`);

        // If package does exist we will stop here.
        if (nugetPackageExists) {
            Log.info("Will not publish NuGet package because this version already exists on NuGet server.");
            return;
        }

        // Rebuild project if specified
        if (config.rebuildProject)
            await this.rebuildProjectAsync(config.projectFilePath);

        this.outputVariable("PACKAGE_VERSION", config.packageVersion);

        // Package project
        await this.packageProjectAsync(config.projectFilePath, config.nugetSearchPath, config.includeSymbols);

        // Publish package
        await this.publishPackageAsync(config.nugetSource, config.nugetKey, config.nugetSearchPath, config.includeSymbols);

        // Commit a tag if publish was successful
        if (config.tagCommit) {
            const tag = config.tagFormat.replace("*", config.packageVersion);
            await this.gitCommitTagAsync(tag);
        }
    }

    /** Write OUTPUT variables */
    private outputVariable(name: string, value: any): void {
        Log.debug(`Setting output \"${name}\" to \"${value}\".`);
        process.stdout.write(`::set-output name=${name}::${value}${os.EOL}`)
    }

    /** Execute command and route stdout and stderr to apps respective channels */
    private async executeAsync(command: string, args: string[] = [], logSafeArgs: string[] = null, options: SpawnOptionsWithStdioTuple<StdioPipe, StdioPipe, StdioPipe> = null): Promise<void> {
        if (logSafeArgs === null)
            logSafeArgs = args;
        Log.info(`[executeAsync] Executing command: ${command} ${logSafeArgs.join(" ")}`);

        options = options || <SpawnOptionsWithStdioTuple<StdioPipe, StdioPipe, StdioPipe>>{};

        options.stdio = <any>[process.stdin, process.stdout, process.stderr];

        return new Promise<void>((resolve, reject) => {
            var cmd = spawn(command, args, options);
            cmd.on('close', (code: any) => {
                if (code !== 0)
                    Log.fail(`Child process exited with code ${code}. Any code != 0 indicates an error.`);
                else
                    Log.info(`[executeAsync] Done executing command: ${command} ${logSafeArgs.join(" ")}.`);
                resolve(code);
            });
            cmd.on('error', (err: any) => {
                Log.fail(err);
                reject(err);
            });
        });
    }

    /** Read INPUT environment variables and return an IActionConfig object */
    private readInputs(): IActionConfig {
        let config = <IActionConfig>{};
        config.projectFilePath = process.env.INPUT_PROJECT_FILE_PATH || process.env.PROJECT_FILE_PATH;
        config.nugetKey = process.env.INPUT_NUGET_KEY || process.env.NUGET_KEY;
        config.nugetSource = process.env.INPUT_NUGET_SOURCE || process.env.NUGET_SOURCE;
        config.tagFormat = process.env.INPUT_TAG_FORMAT || process.env.TAG_FORMAT;
        config.packageName = process.env.INPUT_PACKAGE_NAME || process.env.PACKAGE_NAME;
        config.packageVersion = process.env.INPUT_VERSION_STATIC || process.env.VERSION_STATIC;
        config.versionFilePath = process.env.INPUT_VERSION_FILE_PATH || process.env.VERSION_FILE_PATH;
        config.versionRegex = process.env.INPUT_VERSION_REGEX || process.env.VERSION_REGEX;

        let key: string;
        let value: string;
        try {
            key = "INCLUDE_SYMBOLS"; value = process.env.INPUT_INCLUDE_SYMBOLS || process.env.INCLUDE_SYMBOLS || "false";
            config.includeSymbols = JSON.parse(value);
            key = "TAG_COMMIT"; value = process.env.INPUT_TAG_COMMIT || process.env.TAG_COMMIT || "false";
            config.tagCommit = JSON.parse(value);
            key = "REBUILD_PROJECT"; value = process.env.INPUT_REBUILD_PROJECT || process.env.REBUILD_PROJECT || "true";
            config.rebuildProject = JSON.parse(value);
            key = "LOG_LEVEL"; value = process.env.INPUT_LOG_LEVEL || process.env.LOG_LEVEL || "DEBUG";
            config.logLevel = LogLevel[value as keyof typeof LogLevel] || LogLevel.DEBUG;
        } catch (error) {
            Log.fail(`Error parsing variable "${key}" value "${value}": ${error}`);
        }

        return config;
    }

    /** Validates the user input variables from GitHub Actions and populates any additional variables */
    private validateAndPopulateInputs(config: IActionConfig): void {

        if (!config.projectFilePath) {
            config.projectFilePath = ProjectLocator.GetFirstNuGetProject("./");
            !config.projectFilePath && Log.fail(`No project file specified. Attempted to resolve project file by recursive search, but could not find any .csproj/.fsproj/.vbproj files with "<GeneratePackageOnBuild>true</GeneratePackageOnBuild>".`);
            Log.info(`No project file path specified. Did a recursive search and found: ${config.projectFilePath}`);
        }

        // Check that we have a valid project file path
        !fs.existsSync(config.projectFilePath) && Log.fail(`Project path "${config.projectFilePath}" does not exist.`);
        !fs.lstatSync(config.projectFilePath).isFile() && Log.fail(`Project path "${config.projectFilePath}" must be a directory.`);
        Log.debug(`Project path exists: ${config.projectFilePath}`);

        // Check that we have a valid nuget key
        !config.nugetKey && Log.fail(`NuGet key must be specified.`);

        // Check that we have a valid nuget source
        !validUrl.isUri(config.nugetSource) && Log.fail(`NuGet source "${config.nugetSource}" is not a valid URL.`);

        // If we don't have a static package version we'll need to look it up
        if (!config.packageVersion) {
            // Check that we have a valid version file path
            !fs.existsSync(config.versionFilePath) && Log.fail(`Version file path "${config.versionFilePath}" does not exist.`);
            !fs.lstatSync(config.versionFilePath).isFile() && Log.fail(`Version file path "${config.versionFilePath}" must be a directory.`);
            Log.debug(`Version file path exists: "${config.versionFilePath}"`);

            // Check that regex is correct
            let versionRegex: RegExp;
            try {
                versionRegex = new RegExp(config.versionRegex, "m");
            } catch (e) {
                Log.fail(`Version regex "${config.versionRegex}" is not a valid regular expression: ${e.message}`);
            }

            // Read file content
            const version = this.extractRegexFromFile(config.versionFilePath, versionRegex);

            if (!version)
                Log.fail(`Unable to find version using regex "${config.versionRegex}" in file "${config.versionFilePath}".`);

            // Successfully read version
            config.packageVersion = version[1];
        }

        // Check that we have a valid tag format
        if (config.tagCommit) {
            !config.tagFormat && Log.fail(`Tag format must be specified.`);
            !config.tagFormat.includes("*") && Log.fail(`Tag format "${config.tagFormat}" does not contain *.`);
            Log.debug("Valid tag format: %s", config.tagFormat);
        }

        if (!config.packageName) {
            const { groups: { name } } = config.projectFilePath.match(/(?<name>[^\/]+)\.[a-z]+$/i);
            config.packageName = name;
            Log.debug(`Package name not specified, extracted from PROJECT_FILE_PATH: "${config.packageName}"`);
        }
        !config.packageName && Log.fail(`Package name must be specified.`);
        // Where to search for NuGet packages
        config.nugetSearchPath = path.dirname(config.projectFilePath);

    }

    /** Extracts data from file using regex */
    private extractRegexFromFile(filePath: string, regex: RegExp): string {
        const fileContent = fs.readFileSync(filePath);
        var data = regex.exec(fileContent);
        if (!data)
            return null;
        return data[1];
    }

    /** Check NuGet server if package exists + if specified version of that package exists. */
    private async checkNuGetPackageExistsAsync(nugetSource: string, packageName: string, version: string): Promise<boolean> {
        const url = `${nugetSource}/v3-flatcontainer/${packageName}/index.json`;
        Log.info(`[checkNugetPackageExistsAsync] Checking if NuGet package exists on NuGet server: \"${url}\"`);

        return new Promise((packageVersionExists) => {
            https.get(url, (res: IncomingMessage) => {
                let data = "";

                if (res.statusCode == 404) {
                    Log.debug(`NuGet server returned HTTP status code ${res.statusCode}: Package "${packageName}" does not exist.`);
                    packageVersionExists(false);
                    return;
                }

                if (res.statusCode != 200) {
                    throw new Error(`NuGet server returned unexpected HTTP status code ${res.statusCode}: ${res.statusMessage} Assuming failure.`);
                    packageVersionExists(false);
                    return;
                }

                res.on('data', chunk => { data += chunk })

                res.on('end', () => {
                    // We should now have something like: { "versions": [ "1.0.0", "1.0.1" ] }
                    // Parse JSON and check if the version exists
                    const packages: IPackageVersions = JSON.parse(data);
                    const exists = packages.versions.includes(version);
                    Log.debug(`NuGet server returned: ${packages.versions.length} package versions. Package version "${version}" is${exists ? "" : " not"} in list.`);
                    packageVersionExists(exists);
                    return;
                });

                res.on("error", e => {
                    Log.fail(e);
                    packageVersionExists(false);
                    return;
                });
            })
        })
    }

    /** Rebuild the project using dotnet build */
    private async rebuildProjectAsync(projectFilePath: string): Promise<void> {
        Log.info(`[rebuildProjectAsync] Rebuilding project: \"${projectFilePath}\"`);
        await this.executeAsync("dotnet", ["build", "-c", "Release", projectFilePath]);
    }

    /** Package the project using dotnet pack */
    private async packageProjectAsync(projectFilePath: string, nugetSearchPath: string, includeSymbols: boolean): Promise<void> {
        Log.info(`[packageProjectAsync] Packaging project: \"${projectFilePath}\" to "${nugetSearchPath}"`);

        // Remove existing packages
        fs.readdirSync(nugetSearchPath).filter((fn: string) => /\.s?nupkg$/.test(fn)).forEach((fn: string) => fs.unlinkSync(`${nugetSearchPath}/${fn}`))

        // Package new
        let params = ["pack", "-c", "Release"];
        if (includeSymbols) {
            params.push("-p:IncludeSymbols=true");
            params.push("-p:SymbolPackageFormat=snupkg");
        }
        params.push(projectFilePath);
        params.push("-o");
        params.push(nugetSearchPath);

        await this.executeAsync("dotnet", params);
    }

    /** Publish package to NuGet server using dotnet nuget push */
    private async publishPackageAsync(nuGetSource: string, nugetKey: string, nugetSearchPath: string, includeSymbols: boolean): Promise<void> {
        // Find files
        const packages = fs.readdirSync(nugetSearchPath).filter((fn: string) => fn.endsWith("nupkg"))
        const packagePath = nugetSearchPath + "/" + packages.filter((fn: string) => fn.endsWith(".nupkg"))[0];

        await this.publishPackageSpecificAsync(nuGetSource, nugetKey, packagePath, includeSymbols);
        // We set some output variables that following steps may use
        this.outputVariable("PACKAGE_NAME", packagePath);
        this.outputVariable("PACKAGE_PATH", path.resolve(packagePath));

        if (includeSymbols) {
            const symbolsPath = nugetSearchPath + "/" + packages.filter((fn: string) => fn.endsWith(".snupkg"))[0];

            await this.publishPackageSpecificAsync(nuGetSource, nugetKey, symbolsPath, false);
            this.outputVariable("SYMBOLS_PACKAGE_NAME", symbolsPath);
            this.outputVariable("SYMBOLS_PACKAGE_PATH", path.resolve(symbolsPath));
        }

    }
    private async publishPackageSpecificAsync(nuGetSource: string, nugetKey: string, packagePath: string, includeSymbols: boolean): Promise<void> {
        Log.info(`[publishPackageAsync] Publishing package "${packagePath}"`);
        let params = ["dotnet", "nuget", "push", packagePath, "-s", `${nuGetSource}/v3/index.json`, "--skip-duplicate", "--force-english-output"];
        if (!includeSymbols)
            params.push("--no-symbols");

        // Separate param array that is safe to log (no nuget key)
        let paramsLogSafe = params.concat(["-k", "NUGET_KEY_HIDDEN"]);
        params = params.concat(["-k", nugetKey]);

        await this.executeAsync("dotnet", params, paramsLogSafe);

    }

    /** Push a tag on current commit using git tag and git push */
    private async gitCommitTagAsync(tag: string): Promise<void> {
        Log.info(`[gitCommitTagAsync] Creating tag: ${tag}`);

        await this.executeAsync("git", ["tag", tag]);
        await this.executeAsync("git", ["push", "origin", tag]);

        this.outputVariable("VERSION", tag);
    }

}

class ProjectLocator {
    private static searchRecursive(rootDir: string, pattern: RegExp, callback: (path: string) => boolean): boolean {
        let ret = false;
        //Log.debug(`[searchRecursive] DIR: "${rootDir}"`);
        // Read contents of directory
        fs.readdirSync(rootDir).every((dir: string) => {
            // Obtain absolute path
            dir = path.resolve(rootDir, dir);

            // Get stats to determine if path is a directory or a file
            var stat = fs.statSync(dir);

            // If path is a directory, recurse on it
            if (stat.isDirectory())
                // If recursion found a project file
                if (this.searchRecursive(dir, pattern, callback)) {
                    // Set return value to true for this level too
                    ret = true;
                    // Exit this every-loop
                    return false;
                }

            // If path is a file and ends with pattern then push it onto results
            if (stat.isFile()) {
                //Log.debug(`[searchRecursive] Is file: "${dir}"`);
                if (pattern.test(dir)) {
                    var done = callback(dir);
                    //Log.debug(`[searchRecursive] Callback on file "${dir}" returns halt search: ${done}`);
                    if (done) {
                        ret = true;
                        // Exit this every-loop
                        return false;
                    }
                }
            }
            // Continue this every-loop
            return true;
        });
        return ret;
    }

    private static isProjectFileNuGetPackageRegex = new RegExp(`^\\s*<GeneratePackageOnBuild>\\s*true\\s*</GeneratePackageOnBuild>\\s*$`, "im");
    private static isProjectFileNuGetPackage(file: string): boolean {
        var fileContent = fs.readFileSync(file).toString();
        //Log.debug(`[isProjectFileNuGetPackage] File content: ${fileContent}`);
        var match = this.isProjectFileNuGetPackageRegex.test(fileContent);
        Log.debug(`[isProjectFileNuGetPackage] Matched "${this.isProjectFileNuGetPackageRegex}" on file "${file}": ${match}`);
        return match;
    }

    public static GetFirstNuGetProject(rootDir: string): string {
        let projectPath: string = null;
        this.searchRecursive(rootDir, new RegExp(`\.(cs|fs|vb)proj$`, "i"), (file: string) => {
            var isProjectPath = this.isProjectFileNuGetPackage(file);
            if (isProjectPath)
                projectPath = file;
            return isProjectPath;
        });
        return projectPath;
    }
}

class Log {
    public static LogLevel: LogLevel = LogLevel.DEBUG;

    public static fail(message: string | any, ...optionalParameters: any[]): void {
        console.error("FATAL ERROR: " + message, optionalParameters);
        if (!optionalParameters)
            message += os.EOL + JSON.stringify(optionalParameters);
        throw new Error(message);
    }
    public static warn(message: string | any, ...optionalParameters: any[]) {
        if (<number>this.LogLevel >= <number>LogLevel.WARN)
            console.warn("[WARN] " + message, optionalParameters);
    }

    public static info(message: string | any, ...optionalParameters: any[]): void {
        if (<number>this.LogLevel >= <number>LogLevel.INFO)
            console.log("[INFO] " + message, optionalParameters);
    }

    public static debug(message: string | any, ...optionalParameters: any[]): void {
        if (<number>this.LogLevel >= <number>LogLevel.DEBUG)
            console.debug("[DEBUG] " + message, optionalParameters);
    }

}


// Run the action
(new Action()).run();