# publish-nuget-neo

GitHub Action for publishing NuGet packages.

This action now supports:
- Publishing a single NuGet package from a single project.
- Publishing multiple NuGet packages when multiple project file paths are provided.
- Auto-discovering all projects with \<GeneratePackageOnBuild&gt;true&lt;/GeneratePackageOnBuild&gt; when no project is specified or when `PUBLISH_ALL_PROJECTS` is set to true.

## Background

I ran into some problems using rohith/publish-nuget. There were many bug reports and no update on it, lots of forks with patches, and all in all difficult to see who was what. Also I was not comfortable picking a random stranger to handle my nuget.org API key. This version is a complete rewrite in TypeScript and now supports multi-package publishing, auto-discovery, and improved logging.

## GitHub Action Configuration

Below is an example GitHub Action workflow configuration:

```yaml
# Publish NuGet Packages
- name: Publish NuGet Packages
  id: publish_nuget
  uses: tedd/publish-nuget-neo@v2
  with:
    # NuGet API key to authenticate on the NuGet server.
    # Use GitHub secrets to pass your API key, e.g. ${{secrets.NUGET_API_KEY}}.
    NUGET_KEY: ${{secrets.NUGET_API_KEY}}

    # PROJECT_FILE_PATH can be:
    # - A single project file path as a string.
    # - A JSON array of project file paths.
    # If not specified, the action will search for the first project that has 
    # <GeneratePackageOnBuild&gt;true&lt;/GeneratePackageOnBuild&gt;.
    # PROJECT_FILE_PATH: src/MyProject/MyProject.csproj
    # PROJECT_FILE_PATH: '["src/Project1/Project1.csproj", "src/Project2/Project2.csproj"]'

    # Set PUBLISH_ALL_PROJECTS to true to search for and publish all projects
    # with <GeneratePackageOnBuild&gt;true&lt;/GeneratePackageOnBuild&gt; in the repository. Default is false.
    PUBLISH_ALL_PROJECTS: true

    # URL to the NuGet server. (Default: https://api.nuget.org)
    NUGET_SOURCE: https://api.nuget.org

    # Add symbols to NuGet package. (Default: false)
    INCLUDE_SYMBOLS: false

    # Create and push a Git tag upon successful publish. (Default: false)
    TAG_COMMIT: false

    # Git tag format. An asterisk (*) will be replaced with the version number. (Default: v*)
    TAG_FORMAT: v*

    # NuGet package name. If not specified, the package name will be extracted from the project file name.
    # PACKAGE_NAME:

    # Static version string. If specified, VERSION_FILE_PATH and VERSION_REGEX are ignored.
    # VERSION_STATIC: ${{env.VERSION}}

    # Path to a file containing the version number. (Default: uses the project file)
    # VERSION_FILE_PATH:

    # Regex pattern to extract the version info. (Default: ^s*<Version>(.*)</Version>s*$)
    VERSION_REGEX: ^s*<Version>(.*)</Version>s*$

    # Rebuild project in release mode? (Default: true)
    REBUILD_PROJECT: true

    # Logging verbosity (DEBUG, INFO, or WARN). (Default: DEBUG)
    LOG_LEVEL: DEBUG
```

* Auto detection scan is done by finding any .csproj, .fsproj or .vbproj files that contains `<GeneratePackageOnBuild>true</GeneratePackageOnBuild>`.
  * Note that this is a "dumb regex search". It is not parsing xml, so it won't detect if that tag is actually commented out.  
* If `PUBLISH_ALL_PROJECTS` is set to true a scan is made to find all eligble projects for publishing.
  * `PROJECT_FILE_PATH` is ignored.
* If no `PROJECT_FILE_PATH` is specified a scan will be made for the first project to publish. (Backwards compatibility, assumes only one nuget project.)
* For normal use, default values on versioning will work fine.
  * If `VERSION_FILE_PATH` is not set then it uses `PROJECT_FILE_PATH`.
  * Default value of `VERSION_REGEX` does a "dumb regex" version extract from `VERSION_FILE_PATH`.
  * If `VERSION_STATIC`is set `VERSION_FILE_PATH`and `VERSION_REGEX` will not be used.

## Inputs

| Input                | Description                                                                                                                                                                | Default                            |
|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------|
| NUGET_KEY            | NuGet API key for authentication.                                                                                                                                          | **Required**                       |
| PROJECT_FILE_PATH    | Path to a project file. Can be a single string or a JSON array of strings. If not specified, the action will auto-discover the project.                                    | (Auto-discover first project)      |
| PUBLISH_ALL_PROJECTS | When set to true, auto-discovers and publishes all projects with \<GeneratePackageOnBuild&gt;true&lt;/GeneratePackageOnBuild&gt; in the repository.                              | false                              |
| NUGET_SOURCE         | URL to the NuGet server.                                                                                                                                                     | https://api.nuget.org              |
| INCLUDE_SYMBOLS      | Whether to include symbols in the package.                                                                                                                                 | false                              |
| TAG_COMMIT           | Whether to create and push a Git tag after publishing.                                                                                                                     | false                              |
| TAG_FORMAT           | Format for the Git tag. An asterisk (\*) will be replaced with the version number.                                                                                          | v\*                               |
| PACKAGE_NAME         | NuGet package name. If not provided, the name is extracted from the project file name.                                                                                      | (Extracted from project file)      |
| VERSION_STATIC       | A static version string to use. If provided, VERSION_FILE_PATH and VERSION_REGEX are ignored.                                                                               |                                    |
| VERSION_FILE_PATH    | Path to a file that contains the version number.                                                                                                                           | (Defaults to the project file)     |
| VERSION_REGEX        | Regex pattern to extract the version from the VERSION_FILE_PATH.                                                                                                           | ^\s*\<Version\>(.*)\<\/Version\>\s*$  |
| REBUILD_PROJECT      | Whether to rebuild the project before packaging.                                                                                                                         | true                               |
| LOG_LEVEL            | Logging verbosity (DEBUG, INFO, or WARN).                                                                                                                                  | DEBUG                              |

## Outputs

| Output             | Description                                   |
|--------------------|-----------------------------------------------|
| PACKAGE_VERSION    | The version of the published package.         |
| PACKAGE_NAME       | The name of the NuGet package generated.      |
| PACKAGE_PATH       | The file path to the generated NuGet package. |
| VERSION            | The Git tag created (if TAG_COMMIT is true).   |

If INCLUDE_SYMBOLS is true, additional outputs are provided:

| Output                 | Description                                      |
|------------------------|--------------------------------------------------|
| SYMBOLS_PACKAGE_NAME   | Name of the symbols package generated.           |
| SYMBOLS_PACKAGE_PATH   | File path to the generated symbols package.      |

## Security

Since this action executes code with your API key and project data, please review the source code in [action.ts](https://github.com/tedd/publish-nuget-neo/blob/main/action.ts) before using it.

If you do not trust me, follow these steps:
* Fork repo so only you can modify it.
* Verify that [actions.ts](https://github.com/tedd/publish-nuget-neo/blob/main/action.ts) looks safe, no scary stuff. Check that [validate-url](https://github.com/tedd/publish-nuget-neo/blob/main/node_modules/valid-url/index.js) ([NPM](https://www.npmjs.com/package/valid-url), not my code) looks safe.
* Once happy with code review, run compile.bat or compile.sh to recreate actions.js.
* Create a release named for example "v2.0.0-safe".
  * You do not need to publish the release to marketplace for you to use it.
  * Avoid publishing to marketplace unless you have a substantial contribution and can put in the effort. It is pretty cluttered already.
* In your projects GitHub Action (where you want to publish NuGet) refer to yourgithandle/publish-nuget-neo@v2.0.0-safe (where yourgithandle is user or org of fork, see url) instead of tedd/publish-nuget-neo@v2.0.0. (Replace v2.0.0 with whatever version you forked.)

## Summary

- **Single Project:** Supply a single file path in `PROJECT_FILE_PATH`.
- **Multiple Projects:** Supply a JSON array of file paths in `PROJECT_FILE_PATH`.
- **Auto-discovery:** Leave `PROJECT_FILE_PATH` empty or set `PUBLISH_ALL_PROJECTS` to true to auto-discover projects.

Happy publishing!
