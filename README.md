# DevOps for Snowflake CLI

**Note:** The Snowflake CLI Azure DevOps extension is in Public Preview.

## Usage

This extension streamlines installing and using [Snowflake CLI](https://docs.snowflake.com/developer-guide/snowflake-cli-v2/index) in your Azure Pipelines. The CLI is installed in an isolated way, ensuring it won't conflict with your project dependencies. It automatically sets up the input config file within the `~/.snowflake/` directory.

The extension contributes a single build task, `ConfigureSnowflakeCLI@0`, that enables automation of your Snowflake CLI workflows, such as deploying Native Apps or running Snowpark scripts within your Snowflake environment.

## Inputs

### `cliVersion`

The Snowflake CLI version to install. For example, `3.11.0`. If not specified, the latest released version is used.

### `configFilePath`

Path to the configuration file (`config.toml`) in your repository. The path must be relative to the root of your repository.

### `useWorkloadIdentity`

Boolean flag to enable workload identity federation authentication. When set to `true`, the task will request an OIDC token from Azure DevOps using the specified service connection and configure the Snowflake driver to authenticate with the obtained token, eliminating the need for storing credentials as secrets. Requires `connectedServiceName` and Snowflake CLI `3.11.0` or later. Default is `false`.

### `connectedServiceName`

The name of an Azure Resource Manager service connection configured with workload identity federation. Required when `useWorkloadIdentity` is `true`. The task uses this service connection to request an OIDC token from Azure DevOps.

## How to Safely Configure the Pipeline

### Use workload identity authentication (OIDC)

Workload identity federation provides a secure way to authenticate with Snowflake from Azure DevOps pipelines without storing credentials as secrets. The task requests an OIDC token from Azure DevOps via the service connection and passes it to the Snowflake driver.

To set up workload identity authentication, follow these steps:

1. **Create an Azure App Registration with a federated credential**:

   Create an App Registration in Microsoft Entra ID and add a federated credential for your ADO service connection. See the [Azure documentation](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-create-trust) for details.

2. **Create an Azure DevOps service connection**:

   In your ADO project, create an Azure Resource Manager service connection using Workload Identity Federation. Note the service connection name for the pipeline configuration.

3. **Configure Snowflake**:

   Create a service user with OIDC workload identity. The claim values for Azure DevOps OIDC tokens follow predictable patterns:

   - **Issuer** (`iss`): `https://vstoken.dev.azure.com/<Azure-AD-Tenant-ID>`
   - **Subject** (`sub`): `sc://<ADO-Org-Name>/<ADO-Project-Name>/<Service-Connection-Name>`
   - **Audience** (`aud`): `api://AzureADTokenExchange`

   Use these values to create (or alter) the Snowflake user:

   ```sql
   CREATE USER <username>
     WORKLOAD_IDENTITY = (
       TYPE = OIDC
       ISSUER = 'https://vstoken.dev.azure.com/<Azure-AD-Tenant-ID>'
       SUBJECT = 'sc://<ADO-Org-Name>/<ADO-Project-Name>/<Service-Connection-Name>'
       OIDC_AUDIENCE_LIST = ('api://AzureADTokenExchange')
     )
     TYPE = SERVICE
     DEFAULT_ROLE = PUBLIC;
   ```

   For more details, see the [Snowflake documentation](https://docs.snowflake.com/en/user-guide/workload-identity-federation).

   > **Troubleshooting**: If authentication fails due to a claim mismatch, you can inspect the actual token claims by adding a debug step to your pipeline:
   >
   > ```yaml
   > - bash: |
   >     echo "$SNOWFLAKE_TOKEN" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | python3 -m json.tool
   >   displayName: 'Debug: inspect OIDC token claims'
   > ```

4. **Configure the pipeline**:

   Add a `config.toml` to your repository (no credentials needed):

   ```toml
   [connections.default]
   account = "<your_account>"
   warehouse = "COMPUTE_WH"
   role = "PUBLIC"
   ```

   Then configure your pipeline YAML:

   ```yaml
   trigger:
   - main

   pool:
     vmImage: ubuntu-latest

   steps:
   - task: ConfigureSnowflakeCLI@0
     inputs:
       configFilePath: './config.toml'
       cliVersion: 'latest'
       useWorkloadIdentity: true
       connectedServiceName: '<your-service-connection-name>'
     displayName: Configure Snowflake CLI with Workload Identity

   - script: |
       snow --version
       snow connection test
   ```

### Alternative authentication methods

The following methods can be used as alternatives to workload identity authentication:

#### Key-Pair Authentication

To set up Snowflake credentials for a specific connection, follow these steps:

1. **Add `config.toml` to Your Repository**:

   Create a `config.toml` file at the root of your repository with an empty connection configuration. For example:

   ```toml
   [connections]
   [connections.myconnection]
   user = ""
   database = ""
   ```

   This file serves as a template and should not include any sensitive credentials.

2. **Generate a Private Key**:

   Generate a key pair for your Snowflake account following this [user guide](https://docs.snowflake.com/en/user-guide/key-pair-auth).

3. **Store Credentials in Azure DevOps Pipeline Secrets**:

   Store each credential (e.g., account, private key, passphrase) in Azure DevOps Pipeline Secrets. Refer to the [Azure DevOps documentation](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/set-secret-variables?view=azure-devops&tabs=yaml%2Cbash#secret-variable-in-the-ui) for detailed instructions on how to create and manage secrets.

4. **Configure the Snowflake CLI Task**:

   Add the `configFilePath` input to the Snowflake CLI task in your pipeline YAML file. This specifies the path to your `config.toml` file. For example:

   ```yaml
   - task: ConfigureSnowflakeCLI@0
     inputs:
       cliVersion: 'latest'
       configFilePath: 'config.toml'
   ```

5. **Define the Commands to Execute**

   Specify the Snowflake CLI commands you want to run. Below is an example that checks the installed version of the CLI and tests the connection:

   ```yaml
   - script: |
       snow --version
       snow connection test
     env:
      ...
   ```

6. **Map Secrets to Environment Variables in your script**:

   Use environment variables to map each secret. For example:

   ```yaml
   env:
     SNOWFLAKE_CONNECTIONS_MYCONNECTION_AUTHENTICATOR: 'SNOWFLAKE_JWT'
     SNOWFLAKE_CONNECTIONS_MYCONNECTION_PRIVATE_KEY_RAW: $(SNOWFLAKE_PRIVATE_KEY_RAW)
     SNOWFLAKE_CONNECTIONS_MYCONNECTION_ACCOUNT: $(SNOWFLAKE_ACCOUNT)
   ```

7. **[Optional] Set Up a Passphrase if Private Key is Encrypted**:

   Add an additional environment variable named `PRIVATE_KEY_PASSPHRASE` and set it to the private key passphrase. This passphrase will be used by Snowflake to decrypt the private key.

   ```yaml
     env:
       PRIVATE_KEY_PASSPHRASE: $(PASSPHRASE)  # Passphrase is only necessary if private key is encrypted.
   ```

8. **[Extra] Using Password Instead of Private Key**:

   Unset the environment variable `SNOWFLAKE_CONNECTIONS_MYCONNECTION_AUTHENTICATOR` and then add a new variable with the password as follows:

   ```yaml
   env:
     SNOWFLAKE_CONNECTIONS_MYCONNECTION_USER: $(SNOWFLAKE_USER)
     SNOWFLAKE_CONNECTIONS_MYCONNECTION_ACCOUNT: $(SNOWFLAKE_ACCOUNT)
     SNOWFLAKE_CONNECTIONS_MYCONNECTION_PASSWORD: $(SNOWFLAKE_PASSWORD)
   ```

9. **[Extra] Define config.toml Within the YAML File**:

You can create the config.toml file directly within your YAML pipeline using a shell command. Here’s how to do it:

   ```yaml
   - script: |
       cat <<EOF > config.toml
       default_connection_name = "myconnection" 
         
       [connections] 
       [connections.myconnection]
       user = ""
       EOF
     displayName: 'Create Sample File with Multiple Lines'
   ```

For more information on setting Snowflake credentials using environment variables, refer to the [Snowflake CLI documentation](https://docs.snowflake.com/en/developer-guide/snowflake-cli-v2/connecting/specify-credentials#how-to-use-environment-variables-for-snowflake-credentials).

## Cortex Code CLI

The extension also contributes a companion task, `ConfigureCortexCodeCLI@0`, that installs the [Cortex Code CLI](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli) (`cortex`) and configures a connection for CI/CD.

Unlike `snow`, the `cortex` CLI requires a named connection in `~/.snowflake/connections.toml` — it does not read the `SNOWFLAKE_*` environment variables on its own. This task bridges that gap: when the `ConfigureSnowflakeCLI@0` task has set up workload identity (OIDC) earlier in the same job, it writes a `connections.toml` entry automatically so `cortex -c <name>` works with no manual file wrangling.

### Inputs

#### `cliChannel`

The release channel to install from: `stable` (default) or `beta`.

#### `cliVersion`

The version to install. `latest` (default) installs the newest build in the selected channel. A specific version (for example `1.5.2`) is applied via `cortex update <version>` after install — this relies on the CLI's update semantics, which typically only move forward within a channel, so down-pinning below the channel's latest may not take effect. Prefer `cliChannel` for selecting which line to track.

#### `connectionName`

The connection name to write to `connections.toml` (default `default`). An existing connection with this name is never overwritten.

### How it works

1. Installs the Cortex Code CLI from the selected channel and puts `cortex` on `PATH` (`~/.local/bin`).
2. If an OIDC token is available from the `ConfigureSnowflakeCLI@0` task (it sets `SNOWFLAKE_TOKEN` as a secret), writes a `[<connectionName>]` block to `connections.toml` using `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, and the OIDC token, with `0600` permissions.
3. If no token is present, the task installs `cortex` and skips connection setup (install-only mode); if a connection of the same name already exists, it is left untouched.

`SNOWFLAKE_ACCOUNT` and `SNOWFLAKE_USER` must be provided as pipeline variables or step env vars — the same values you use for the OIDC handshake. If a token is present but these are missing, the task fails rather than writing an incomplete connection.

### Example

Both tasks must run in the **same job** so the cortex task can read the OIDC token the Snowflake CLI task exports.

```yaml
pool:
  vmImage: ubuntu-latest   # Linux agents only (see Platform support)

steps:
- task: ConfigureSnowflakeCLI@0
  inputs:
    useWorkloadIdentity: true
    connectedServiceName: '<your-service-connection-name>'
  displayName: Configure Snowflake CLI (OIDC)

- task: ConfigureCortexCodeCLI@0
  inputs:
    cliChannel: stable
    connectionName: default
  displayName: Configure Cortex Code CLI
  env:
    SNOWFLAKE_ACCOUNT: $(SNOWFLAKE_ACCOUNT)
    SNOWFLAKE_USER: $(SNOWFLAKE_USER)

- script: |
    cortex --version
    cortex exec --file .cortex/prompts/scan.md -c default --bypass --no-history
  displayName: Run Cortex Code
```

### Platform support

The Cortex Code CLI task supports **Linux agents only**, matching the Snowflake CLI task.

### Self-hosted agents

On Microsoft-hosted agents the written `connections.toml` is ephemeral and disappears with the agent. Azure DevOps tasks have no post-job cleanup hook, so on **self-hosted** agents the file (mode `0600`, containing a short-lived OIDC token) persists in `~/.snowflake/` between jobs. Remove it at the end of the job if your agents are long-lived:

```yaml
- script: rm -f "$HOME/.snowflake/connections.toml"
  condition: always()
  displayName: Clean up connections.toml
```

## Full Example Usage

### Configuration File

```toml
default_connection_name = "myconnection"

[connections]
[connections.myconnection]
user = ""
```

### YAML Pipeline

```yaml
trigger:
- main

pool:
  vmImage: ubuntu-latest

steps:
- task: ConfigureSnowflakeCLI@0
  inputs:
    configFilePath: './config.toml'
    cliVersion: 'latest'
  displayName: SnowflakeCliTest

- script: |
    snow --version
    snow connection test
  env:
    SNOWFLAKE_CONNECTIONS_MYCONNECTION_AUTHENTICATOR: 'SNOWFLAKE_JWT'
    SNOWFLAKE_CONNECTIONS_MYCONNECTION_USER: $(SNOWFLAKE_USER)
    SNOWFLAKE_CONNECTIONS_MYCONNECTION_ACCOUNT: $(SNOWFLAKE_ACCOUNT)
    SNOWFLAKE_CONNECTIONS_MYCONNECTION_PRIVATE_KEY_RAW: $(SNOWFLAKE_PRIVATE_KEY_RAW)
    PRIVATE_KEY_PASSPHRASE: $(PASSPHRASE)  # Passphrase is only necessary if private key is encrypted.
```