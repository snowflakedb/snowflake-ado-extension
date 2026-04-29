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

import tmrm = require('azure-pipelines-task-lib/mock-run');
import path from 'path';
import os from 'os';
import {TEMP_CONFIG_FILE_PATH, TEMP_EXEC_OUTPUT_PATH} from './constants'

const taskPath = path.join(__dirname, '..', '..', 'main.js');

const task: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
process.env["UV_TOOL_BIN_DIR"] = path.join( __dirname, 'testFiles');
process.env["CONFIG_TOML_FILE_OUTPUT_PATH"] = TEMP_CONFIG_FILE_PATH;
process.env["SNOW_EXECUTABLE_OUTPUT_PATH"] = TEMP_EXEC_OUTPUT_PATH;
process.env["DISABLE_SNOW_INSTALLATION_WITH_UV"] = 'true';

task.setInput('configFilePath', path.join(__dirname, 'testFiles', 'undefinedConfig.toml'));
task.setInput('cliVersion', '2.1.0');
task.run(true);