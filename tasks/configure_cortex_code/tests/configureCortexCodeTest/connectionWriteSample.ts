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

import tmrm = require('azure-pipelines-task-lib/mock-run');
import path from 'path';
import { TEMP_CONNECTIONS_DIR } from './constants';

const taskPath = path.join(__dirname, '..', '..', 'main.js');
const task: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Start from a clean Snowflake env so the test is hermetic.
[
    'SNOWFLAKE_TOKEN', 'SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER',
    'SNOWFLAKE_AUTHENTICATOR', 'SNOWFLAKE_WORKLOAD_IDENTITY_PROVIDER',
    'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_ROLE', 'SNOWFLAKE_DATABASE',
].forEach((k) => delete process.env[k]);

process.env['DISABLE_CORTEX_INSTALLATION'] = 'true';
process.env['CONNECTIONS_TOML_FILE_OUTPUT_PATH'] = TEMP_CONNECTIONS_DIR;
process.env['SNOWFLAKE_TOKEN'] = 'fake-oidc-token';
process.env['SNOWFLAKE_ACCOUNT'] = 'myacct';
process.env['SNOWFLAKE_USER'] = 'demo_user';
process.env['SNOWFLAKE_WAREHOUSE'] = 'COMPUTE_WH';
process.env['SNOWFLAKE_ROLE'] = 'PUBLIC';

task.setInput('cliChannel', 'stable');
task.setInput('cliVersion', 'latest');
task.setInput('connectionName', 'default');

task.run(true);
