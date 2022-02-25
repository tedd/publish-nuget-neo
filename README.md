# publish-nuget-neo

GitHub Action for publishing NuGet package.

Automatic project and version detection, more tests and better logs.

*For most use cases just put in NuGet API key, fire and forget.*

# Background

I ran into some problems using rohith/publish-nuget. There were many bug reports and no update on it, lots of forks with patches, and all in all difficult to see who was what. Also I was not comfortable picking a random stranger to handle my nuget.org API key.

So I rewrote the whole thing.

* Complete rewrite in TypeScript.
* Drop-in replacement compatible with rohith/publish-nuget, brandedoutcast/publish-nuget and probably most other forks. Let me know if something is missing.
* No need for project specific config, can autodetect project file.
* More and more verbose logging for your debugging journey.
* Clean and commented code, have a look at action.ts.

# GitHub Action config

```yaml
# Publish
- name: publish on version change
  id: publish_nuget
  uses: tedd/publish-nuget-neo@v1.0.0
  with:
    # NuGet API key to authenticate on NuGet server. 
    # DO NOT PUT KEY DIRECTLY IN HERE.
    # Use Secrets function in GitHub for example, i.e. dollarsign{{secrets.YOUR_NUGET_API_KEY}}.
    NUGET_KEY: ${{secrets.NUGET_API_KEY}}

    # Full path to project file. (Example: src/MyNuGetProject/MyNuGetProject.csproj) (Default: Will scan all .csproj/.fsproj/.vbproj files and use first it finds that has GeneratePackageOnBuild set to true.)
    #PROJECT_FILE_PATH:

    # URL to NuGet server. (Default: https://api.nuget.org)
    #NUGET_SOURCE: https://api.nuget.org

    # Add symbols to NuGet package. (Default: false)
    #INCLUDE_SYMBOLS: false
    
    # Current Git commit should be tagged upon successful upload to NuGet. (Default: false)
    #TAG_COMMIT: false
    
    # Name of Git tag. * will be replaced by version number. (Default: v*)
    #TAG_FORMAT: v*

    # NuGet package name. This is used for checking NuGet server if package version already exists. (Default: name extracted from PROJECT_FILE_PATH)
    # PACKAGE_NAME:

    # Path to file containing version number to extract using regex. (Default: $PROJECT_FILE_PATH)
    # VERSION_FILE_PATH:

    # Regex pattern to extract version info in a capturing group. (Default: ^\\s*<Version>(.*)<\\/Version>\\s*$)
    # VERSION_REGEX: ^\s*<Version>(.*)<\/Version>\s*$

    # Useful with external providers like Nerdbank.GitVersioning where you could for example set it to variable (dollar){{env.GitBuildVersionSimple}}. Ignores VERSION_FILE_PATH & VERSION_REGEX.
    #VERSION_STATIC: ${{env.GitBuildVersionSimple}}
    
    # Rebuild project in release mode? You may turn this off if you have built project in previous step. (default: true)
    #REBUILD_PROJECT: true
    
    # Additional debug output during processing (default: true)
    #DEBUG: true`
```

# Defaults

* The only required setting is `NUGET_KEY`.

* If no `PROJECT_FILE_PATH` is specified a scan will be made for any .csproj, .fsproj or .vbproj files that contains `<GeneratePackageOnBuild>true</GeneratePackageOnBuild>`.
  * Note that this is a "dumb regex search". It is not parsing xml, so it won't detect if that tag is actually commented out.
* For normal use, default values on versioning will work fine.
  * If `VERSION_FILE_PATH` is not set then it uses `PROJECT_FILE_PATH`.
  * Default value of `VERSION_REGEX` does a "dumb regex" version extract from `VERSION_FILE_PATH`.
  * If `VERSION_STATIC`is set `VERSION_FILE_PATH`and `VERSION_REGEX` will not be used.

# OUTPUTS

| Output          | Description                         |
| ------------    | ----------------------------------- |
| PACKAGE_VERSION | Package version                     |
| PACKAGE_NAME    | Name of the NuGet package generated |
| PACKAGE_PATH    | Path to the generated NuGet package |

The following is only set if `TAG_COMMIT` is true.
| Output       | Description                         |
| ------------ | ----------------------------------- |
| VERSION      | Git Tag                             |

The following is only set if `INCLUDE_SYMBOLS` is true.
| Output               | Description                           |
| -------------------- | ------------------------------------- |
| SYMBOLS_PACKAGE_NAME | Name of the symbols package generated |
| SYMBOLS_PACKAGE_PATH | Path to the generated symbols package |

# Security

Since this code comes from me and runs in your projects build pipeline, theoretically I could have my code send me your NuGet server API key. I could then publish a new version of your package containing malicious content.

I will not do this, if course. But you need to realize what risks you are exposed to.

If you do not trust me, follow these steps:

* Fork repo so only you can modify it.
* Verify that [actions.ts](blob/main/action.ts) looks safe, no scary stuff. Check that [validate-url](blob/main/node_modules/valid-url/index.js) ([NPM](https://www.npmjs.com/package/valid-url), not my code) looks safe.
* Once happy with code review, run compile.bat or compile.sh to recreate actions.js.
* Create a release named for example "v1.0.0-safe".
  * You do not need to publish the release to marketplace for you to use it.
  * Avoid publishing to marketplace unless you have a substantial contribution and can put in the effort. It is pretty cluttered already.
* In your projects GitHub Action (where you want to publish NuGet) refer to yourgithandle/publish-nuget-neo@v1.0.0-safe (where yourgithandle is user or org of fork, see url) instead of tedd/publish-nuget-neo@v1.0.0. (Replace v1.0.0 with whatever version you forked.)