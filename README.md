# Snowflake CLI Azure Devops

**Note:** Snowflake CLI Azure Devops is in early development phase. The project may change or be abandoned. Do not use for production use cases.


## Usage

Streamlines installing and using [Snowflake CLI](https://docs.snowflake.com/developer-guide/snowflake-cli-v2/index) in your CI/CD workflows. The CLI is installed in an isolated way, ensuring it won't conflict with your project dependencies. It automatically sets up the input config file within the `~/.snowflake/` directory.

This pipeline enables automation of your Snowflake CLI tasks, such as deploying Native Apps or running Snowpark scripts within your Snowflake environment.

## Parameters

### `cli-version`

The specified Snowflake CLI version. For example, `2.2.0`. If not specified, the latest version will be used.

### `default-config-file-path`

Path to the configuration file (`config.toml`) in your repository. The path must be relative to the root of your repository.

### `use-workload-identity`

Boolean flag to enable Azure workload identity authentication. When set to `true`, the task will configure the CLI to use the Azure managed identity of the pipeline agent for authentication with Snowflake, eliminating the need for storing credentials as secrets. Default is `false`.

## How to Safely Configure the Pipeline

### Use Azure workload identity authentication

Azure workload identity authentication provides a secure and modern way to authenticate with Snowflake without storing credentials as secrets. This approach uses the Azure managed identity attached to the pipeline agent to authenticate with Snowflake.

To set up Azure workload identity authentication, follow these steps:

1. **Configure Microsoft Entra ID**:

   A Microsoft Entra ID tenant administrator must consent to the multi-tenant Snowflake EntraID app by visiting the [consent URI](https://login.microsoftonline.com/common/adminconsent?client_id=2b0bfd60-5ae4-4edb-aaad-0feb7e2fac24). This only needs to be done once per tenant.

2. **Enable a managed identity on the pipeline agent**:

   Enable a managed identity for the Azure VM or Azure Function that runs your pipeline agent. Save the Object (Principal) ID for the next step. See the [Azure documentation](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview) for details.

3. **Configure Snowflake**:

   Create a service user with Azure workload identity type:

   ```sql
   CREATE USER <username>
     WORKLOAD_IDENTITY = (
       TYPE = AZURE
       ISSUER = 'https://login.microsoftonline.com/<tenant_id>/v2.0'
       SUBJECT = '<object_principal_id>'
     )
     TYPE = SERVICE
     DEFAULT_ROLE = PUBLIC;
   ```

   - `<tenant_id>` is your Microsoft Entra tenant ID
   - `<object_principal_id>` is the Object (Principal) ID of the managed identity

   For more details, see the [Snowflake documentation](https://docs.snowflake.com/en/user-guide/workload-identity-federation).

4. **Store your Snowflake account in Azure DevOps Pipeline Secrets**:

   Store your Snowflake account identifier in Azure DevOps Pipeline Secrets. Refer to the [Azure DevOps documentation](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/set-secret-variables?view=azure-devops&tabs=yaml%2Cbash#secret-variable-in-the-ui) for detailed instructions.

5. **Configure the Snowflake CLI Task with workload identity authentication**:

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
     displayName: Configure Snowflake CLI with Azure Workload Identity

   - script: |
       snow --version
       snow connection test -x
     env:
       SNOWFLAKE_ACCOUNT: $(SNOWFLAKE_ACCOUNT)
       SNOWFLAKE_USER: $(SNOWFLAKE_USER)
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

   Add the `default-config-file-path` parameter to the Snowflake CLI task in your pipeline YAML file. This specifies the path to your `config.toml` file. For example:

   ```yaml
   - task: SnowflakeCLI@1
     inputs:
       cliVersion: 'latest'
       defaultConfigFilePath: 'config.toml'
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

   Use envrionmental variables to map each secret. For example:

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