// Copyright 2024 Snowflake Inc. 
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
import { setupConfigFile } from './src/setupConfigFile';
import { installSnowflakeCli } from './src/installSnowflakeCli';
import { setupWorkloadIdentity } from './src/setupWorkloadIdentity';

async function run() {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        const configFilePath: string | undefined = tl.getInput('configFilePath', false);
        const cliVersion: string | undefined = tl.getInput('cliVersion', false);
        const useWorkloadIdentity: boolean = tl.getBoolInput('useWorkloadIdentity', false);
        const connectedServiceName: string | undefined = tl.getInput('connectedServiceName', false);
        if (useWorkloadIdentity && !connectedServiceName) {
            throw new Error('connectedServiceName is required when useWorkloadIdentity is true.');
        }
        installSnowflakeCli(cliVersion);
        setupConfigFile(configFilePath);
        if (useWorkloadIdentity) {
            await setupWorkloadIdentity(connectedServiceName!);
        }
    }
    catch (err:any) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();