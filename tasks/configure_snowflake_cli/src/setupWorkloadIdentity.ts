// Copyright 2026 Snowflake Inc.
// SPDX-License-Identifier: Apache-2.0
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
// http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import tl = require('azure-pipelines-task-lib');
import * as azdev from 'azure-devops-node-api';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function setupWorkloadIdentity(connectedServiceName: string) {
    const jobId = tl.getVariable('System.JobId');
    const planId = tl.getVariable('System.PlanId');
    const projectId = tl.getVariable('System.TeamProjectId');
    const hub = tl.getVariable('System.HostType');
    const collectionUri = tl.getVariable('System.CollectionUri');
    const accessToken = tl.getVariable('System.AccessToken');

    if (!jobId || !planId || !projectId || !hub || !collectionUri || !accessToken) {
        throw new Error(
            'Missing required pipeline variables. Ensure System.AccessToken is available ' +
            '(add "- checkout: self" or set env explicitly).'
        );
    }

    console.log('Requesting OIDC token from Azure DevOps...');

    const authHandler = azdev.getPersonalAccessTokenHandler(accessToken);
    const connection = new azdev.WebApi(collectionUri, authHandler);
    const taskApi = await connection.getTaskApi();

    const response = await taskApi.createOidcToken(
        {},
        projectId,
        hub,
        planId,
        jobId,
        connectedServiceName
    );

    const oidcToken = response?.oidcToken;
    if (!oidcToken) {
        throw new Error(
            'Failed to obtain OIDC token from Azure DevOps. ' +
            'Verify the service connection is configured with workload identity federation.'
        );
    }

    console.log('OIDC token obtained successfully.');

    // Write the token to a temp file for the Snowflake connector to read
    const tokenDir = path.join(os.tmpdir(), 'snowflake-wif');
    if (!fs.existsSync(tokenDir)) {
        fs.mkdirSync(tokenDir, { recursive: true });
    }
    const tokenFilePath = path.join(tokenDir, 'oidc_token');
    fs.writeFileSync(tokenFilePath, oidcToken, { mode: 0o600 });

    // Set environment variables for the Snowflake CLI / connector
    tl.setVariable('SNOWFLAKE_AUTHENTICATOR', 'WORKLOAD_IDENTITY');
    tl.setVariable('SNOWFLAKE_WORKLOAD_IDENTITY_PROVIDER', 'OIDC');
    tl.setVariable('SNOWFLAKE_TOKEN_FILE_PATH', tokenFilePath);

    console.log('Workload identity authentication configured successfully (OIDC).');
    console.log(`Token file written to: ${tokenFilePath}`);
}
