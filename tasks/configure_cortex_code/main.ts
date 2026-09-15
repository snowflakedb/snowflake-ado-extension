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
import path from 'path';
import * as task from 'azure-pipelines-task-lib';
import { installCortexCli } from './src/installCortexCli';
import { setupConnection } from './src/setupConnection';

// Bump on each release to match vss-extension.json and task.json
const INTEGRATION_VERSION = 'v1.0.0';

async function run() {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));

        // Telemetry: identify Cortex Code CLI invocations originating from this task.
        tl.setVariable('SF_CORTEX_CODE_ADO_EXTENSION', 'true');
        tl.setVariable('SF_CICD_INTEGRATION_VERSION', INTEGRATION_VERSION);

        const cliChannel: string = tl.getInput('cliChannel', false) || 'stable';
        const cliVersion: string = tl.getInput('cliVersion', false) || 'latest';
        const connectionName: string = tl.getInput('connectionName', false) || 'default';

        // The connection auto-config depends on the Configure Snowflake CLI task
        // having run first in the same job (it provides `snow` and the OIDC
        // token). The Cortex Code CLI installs independently, so a missing `snow`
        // is informational rather than fatal — install still proceeds and the
        // connection step degrades gracefully to install-only mode.
        if (!tl.which('snow', false)) {
            console.log(
                'snow CLI not found on PATH. If you intended to auto-configure a connection from ' +
                'workload identity, run the Configure Snowflake CLI task (useWorkloadIdentity: true) ' +
                'before this task in the same job.'
            );
        }

        installCortexCli(cliChannel, cliVersion);
        setupConnection(connectionName);
    }
    catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();
