# DTDL Editor for Visual Studio Code

🎉 **Exciting Update: Our VSCode extension now offers expanded DTDL v3 support!**

We are incredibly delighted to announce the latest update to our VSCode extension. Not only does our enhanced release now fully support the DTDL V3 context, but it also boasts improved Intellisense for V3 language extensions. 

This comprehensive support includes crucial features such as historization, overriding, annotations, and quantitativeTypes, making our product more robust and versatile for your diverse developing needs. 

Don't wait any longer! Dive in and discover the expanded functionality that our updated VSCode extension has to offer. Stay tuned to our repository for upcoming updates. We always welcome your invaluable insights and feedback for continued improvements.

Happy coding to all!🚀


## Overview

The [Digital Twin Definition Language](https://aka.ms/DTDL) (DTDL) is a language for describing models for Plug and Play devices, device digital twins, and logical digital twins. Broadly, modeling enables IoT solutions to provision, use, and configure digital twins of all kinds from multiple sources in a single solution. Using DTDL to describe any digital twin’s abilities enables the IoT platform and IoT solutions to leverage the semantics of each digital twin.

With the [DTDL extension for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.vscode-dtdl) , you can read and write documents using DTDL more efficiently taking full advantage of the following key features:

- Create interfaces from the command palette with predefined or customized templates.
- Intellisense to help you with the language syntax (including auto-completion).
- Use predefined code snippets to develop DTDL efficiently.
- Syntax validation.

## Get Started

### Create Interface

You could use the command palette to create interface from predefined or customized templates.

- In Visual Studio Code, select **View > Command Palette** to open the VS Code command palette.
- In the command palette, enter and run the command **DTDL: Create Interface**.
- Follow the instruction to assign the interface name.
- If there are multiple templates existing, choose a template you need. Otherwise, the extension will the basic template as default.
- A JSON file will be created in the current folder. The file name is based on the interface name you assigned.
- The @id is the path component of the [Digital Twin Model Identifier](https://github.com/Azure/opendigitaltwins-dtdl/blob/master/DTMI/README.md) (DTMI). You should modify the @id following the DTMI rule to uniquely identify the device model.


### Intellisense and Syntax validation

This extension could help you with the language syntax (including auto-completion) and also validate the syntax with [DTDL](https://aka.ms/dtdl).


### Use Predefined Code Snippets

Besides the basic auto completion, this extension also provides some predefined code snippets to help you develop DTDL efficiently.

| Code Snippet | Description |
| --- | --- |
| `dtt`  | Code snippet of telemetry |
| `dtp`  | Code snippet of property |
| `dtc`  | Code snippet of command |

### Create Your Own Template

#### Prepare your template file

You could use any DTDL file as a template to develop efficiently. Meanwhile, you could also use these predefined tags to make your template more flexible.

- **{modelId}**: The extention will replace this tag with *dtmi:com:example:interface_name;1* when creating a new DTDL from a template. For example, if you assigned the interface name as "test", the result will be dtmi:com:example:test;1.
- **{modelName}**: The extension will replace this tag with the interface name when creating a new DTDL from a template.

#### Import your template file

- Go to [[extension installation location](https://code.visualstudio.com/docs/editor/extension-gallery#_where-are-extensions-installed)]/vsciot-vscode.vscode-dtdl-[extension release version]/templates
- Store your template into this folder as a JSON file. Keep the file name short and meaningful, because the extension will use the file name as template name.

### Create Your Own Code Snippets

If you would like to create customized code snippets for VS Code, you could follow [Snippets in Visual Studio Code](https://code.visualstudio.com/docs/editor/userdefinedsnippets)

### Contribute Your Templates and Code Snippets to the Community

You could also contribute your templates and code snippets to the [DTDL repository](https://github.com/microsoft/vscode-dtdl).

- Uploading the new templates to **templates** folder.
- Modifying and adding new code snippets to **snippets/snippets.json** file.

Once the pull request is approved, your templates and code snippets will be released with next release of DTDL extension.

## Commands

| Command | Description |
| --- | --- |
| `DTDL: Create Interface...`  | Create new interface from predefined or customized templates. |

## Trouble Shooting

### Error when creating the interface

As default, the extension will get the available templates from *[[extension installation location](https://code.visualstudio.com/docs/editor/extension-gallery#_where-are-extensions-installed)]/vsciot-vscode.vscode-dtdl-[extension release version]/templates*. But if you delete this folder or all templates files in this folder, you will have an error when creating the interface. In order to fix this issue, you could copy the templates from [DTDL repository](https://github.com/microsoft/vscode-dtdl) to your local templates folder manually.

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct). For more information please see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/#howadopt) or contact opencode@microsoft.com with any additional questions or comments.

## Contact Us

If you would like to help to build the best IoT experience with IoT Plug and Play, you can reach us directly at [Gitter](https://gitter.im/Microsoft/vscode-azure-digital-twins).

## Telemetry

VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## Security

Microsoft takes the security of our software products and services seriously, which includes all source code repositories managed through our GitHub organizations, which include [Microsoft](https://github.com/Microsoft), [Azure](https://github.com/Azure), [DotNet](https://github.com/dotnet), [AspNet](https://github.com/aspnet), [Xamarin](https://github.com/xamarin), and [our GitHub organizations](https://opensource.microsoft.com/).

If you believe you have found a security vulnerability in any Microsoft-owned repository that meets Microsoft's [Microsoft's definition of a security vulnerability](https://docs.microsoft.com/en-us/previous-versions/tn-archive/cc751383(v=technet.10)), please report it to us as described below.

## Reporting Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them to the Microsoft Security Response Center (MSRC) at [https://msrc.microsoft.com/create-report](https://msrc.microsoft.com/create-report).

If you prefer to submit without logging in, send email to [secure@microsoft.com](mailto:secure@microsoft.com).  If possible, encrypt your message with our PGP key; please download it from the the [Microsoft Security Response Center PGP Key page](https://www.microsoft.com/en-us/msrc/pgp-key-msrc).

You should receive a response within 24 hours. If for some reason you do not, please follow up via email to ensure we received your original message. Additional information can be found at [microsoft.com/msrc](https://www.microsoft.com/msrc).

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

If you are reporting for a bug bounty, more complete reports can contribute to a higher bounty award. Please visit our [Microsoft Bug Bounty Program](https://microsoft.com/msrc/bounty) page for more details about our active programs.

## Preferred Languages

We prefer all communications to be in English.

## Policy

Microsoft follows the principle of [Coordinated Vulnerability Disclosure](https://www.microsoft.com/en-us/msrc/cvd).
