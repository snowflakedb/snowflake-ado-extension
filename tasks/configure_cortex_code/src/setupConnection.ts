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

import fs from 'fs';
import os from 'os';
import path from 'path';
import tl = require('azure-pipelines-task-lib');
import * as utils from './taskutil';

function connectionsFilePath(): string {
    const dir = utils.getVar(utils.CONNECTIONS_TOML_FILE_OUTPUT_PATH)
        || path.join(os.homedir(), '.snowflake');
    return path.join(dir, 'connections.toml');
}

// Detects whether a connection with the given name already exists. Connections
// are top-level TOML tables ([<name>]); we match a header line for this exact
// name rather than taking a TOML-parser dependency.
function connectionExists(content: string, connName: string): boolean {
    const escaped = connName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headerRe = new RegExp(`^\\s*\\[${escaped}\\]\\s*$`, 'm');
    return headerRe.test(content);
}

// Writes a named connection to connections.toml from the OIDC env the Configure
// Snowflake CLI task exposes (SNOWFLAKE_TOKEN + account/user/...), so the Cortex
// Code CLI — which, unlike `snow`, requires a named connection — works with
// `cortex -c <name>`. Existing connections are never overwritten.
export function setupConnection(connectionName: string) {
    try {
        const connName = connectionName || 'default';
        const connFile = connectionsFilePath();
        const fileExists = fs.existsSync(connFile);
        const existingContent = fileExists ? fs.readFileSync(connFile, 'utf8') : '';

        // 1. Never overwrite an existing connection of the same name.
        if (fileExists && connectionExists(existingContent, connName)) {
            console.log(`Connection [${connName}] already exists in ${connFile}. Skipping.`);
            return;
        }

        const token = utils.getVar(utils.SNOWFLAKE_TOKEN);

        // 2. No OIDC token from the Configure Snowflake CLI task -> nothing to write.
        if (!token) {
            if (fileExists && existingContent.trim() !== '') {
                console.log(
                    `No ${utils.SNOWFLAKE_TOKEN} found, but ${connFile} already has connections. ` +
                    `The Cortex Code CLI can use them via: cortex -c <name>`
                );
            } else {
                console.log(
                    `No ${utils.SNOWFLAKE_TOKEN} in the environment and no connections.toml found. ` +
                    `Skipping connection setup (install-only mode). To enable, run the Configure ` +
                    `Snowflake CLI task with useWorkloadIdentity: true before this task in the same job.`
                );
            }
            return;
        }

        // 3. Token present but identity incomplete -> fail loudly rather than
        //    writing a half-configured connection that fails later.
        const account = utils.getVar(utils.SNOWFLAKE_ACCOUNT);
        const user = utils.getVar(utils.SNOWFLAKE_USER);
        if (!account || !user) {
            throw new Error(
                `${utils.SNOWFLAKE_TOKEN} is set but ${utils.SNOWFLAKE_ACCOUNT} and/or ` +
                `${utils.SNOWFLAKE_USER} are missing. Set them as pipeline variables or step ` +
                `env vars so the connection can be written.`
            );
        }

        // 4. Append the connection block, preserving any existing content.
        const authenticator = utils.getVar(utils.SNOWFLAKE_AUTHENTICATOR) || 'WORKLOAD_IDENTITY';
        const provider = utils.getVar(utils.SNOWFLAKE_WORKLOAD_IDENTITY_PROVIDER) || 'OIDC';

        const lines: string[] = [];
        if (fileExists && existingContent.trim() !== '') {
            lines.push(''); // separate from preceding content
        }
        lines.push(`[${connName}]`);
        lines.push(`account = ${utils.tomlString(account)}`);
        lines.push(`user = ${utils.tomlString(user)}`);
        lines.push(`authenticator = ${utils.tomlString(authenticator)}`);
        lines.push(`workload_identity_provider = ${utils.tomlString(provider)}`);
        lines.push(`token = ${utils.tomlString(token)}`);

        const warehouse = utils.getVar(utils.SNOWFLAKE_WAREHOUSE);
        if (warehouse) {
            lines.push(`warehouse = ${utils.tomlString(warehouse)}`);
        }
        const role = utils.getVar(utils.SNOWFLAKE_ROLE);
        if (role) {
            lines.push(`role = ${utils.tomlString(role)}`);
        }
        const database = utils.getVar(utils.SNOWFLAKE_DATABASE);
        if (database) {
            lines.push(`database = ${utils.tomlString(database)}`);
        }

        utils.createDirectory(path.dirname(connFile));
        fs.appendFileSync(connFile, lines.join('\n') + '\n');
        if (utils.getPlatform() !== utils.Platform.Windows) {
            fs.chmodSync(connFile, 0o600);
        }

        // Defensively register the token for log masking (it is a short-lived
        // OIDC token; the parent task already marks it secret).
        tl.setSecret(token);
        console.log(`Connection [${connName}] auto-configured in ${connFile}`);
    } catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}
