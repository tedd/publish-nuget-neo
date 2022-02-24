# publish-nuget-neo

GitHub Action for publishing NuGet package.

# Background

I ran into some problems using rohith/publish-nuget. There were many bug reports and no update on it, lots of forks with patches, and all in all difficult to see who was what. Also I was not comfortable picking a random stranger to handle my nuget.org API.

So I rewrote the whole thing.

* Drop-in replacement compatible with rohith/publish-nuget, brandedoutcast/publish-nuget and probably most other forks. Let me know if something is missing.
* Complete rewrite in TypeScript.
* More and more verbose logging for your debugging journey.
* Clean and commented code, have a look at action.ts.

# GitHub Action config

```yaml
# Publish
- name: publish on version change
  id: publish_nuget
  uses: tedd/publish-nuget-neo@v1.0.0
  with:
    # Full path to project file. Example: src/MyNuGetProject/MyNuGetProject.csproj
    PROJECT_FILE_PATH: folder/project.csproj

    # NuGet API key to authenticate on NuGet server.
    NUGET_KEY: ${{secrets.NUGET_API_KEY}}

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

# Security

Since this code comes from me and runs in your projects build pipeline, theoretically I could have my code send me your NuGet server API key. I could then publish a new version of your package containing malicious content. (Yes, that is right. <u>Please take security seriously!</u>)

I will not do this, if course. But you need to realize what risks you are exposed to.

If you do not trust me, follow these steps:

* Fork repo
* Verify that actions.ts looks safe, no scary stuff. If validate-url looks scary (NPM, not my code), just bypass the url check and remove `validUrl = require('valid-url')` at the top of script.
* Once happy with code review, run compile.bat or compile.sh to recreate actions.js.
* Create a release named for example "v1.0.0-safe".
* In your projects GitHub Action (where you want to publish NuGet) refer to yourgithandle/publish-nuget-neo@v1.0.0-safe (where yourgithandle is user or org of fork, see url) instead of tedd/publish-nuget-neo@v1.0.0.

You do not need to publish the release to marketplace for you to use it personally.