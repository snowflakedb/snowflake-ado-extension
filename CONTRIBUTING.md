# Contributing to the Project

## Setting Up the Development Environment

To get started with the project, install the necessary dependencies by running the following command:

```bash
cd tasks/configure_snowflake_cli && npm run install:dev
```

## Running Tests

After setting up the development environment, you can test your changes by executing the following command in the `tasks/configure_snowflake_cli` directory:

```bash
npm run test
```

## Creating a Release

Follow these steps to create a release:

1. **Update Version Numbers**: Modify the `vss-extension.json`, `tasks/configure_snowflake_cli/task.json`, and the `INTEGRATION_VERSION` constant in `tasks/configure_snowflake_cli/main.ts` to reflect the new version number.

2. **Set Up the Release Environment**: Navigate to the `tasks/configure_snowflake_cli` directory and execute the following command to create the extension:

   ```bash
   npx run create:extension
   ```

3. **Publish in Development Mode**: To publish your extension in **development mode**, remove the `"galleryFlags"` field from the `vss-extension.json` file. This ensures that your extension is published as private.

4. **Packaging and Publishing**: For detailed instructions on packaging and publishing your extension, refer to this guide: [Package and Publish Extensions](https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview?toc=%2Fazure%2Fdevops%2Fmarketplace-extensibility%2Ftoc.json&view=azure-devops).