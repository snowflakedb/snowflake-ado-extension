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
import fs from 'fs';
import {TEMP_CONFIG_FILE_PATH, TEMP_EXEC_OUTPUT_PATH} from './constants'

const taskPath = path.join(__dirname, '..', '..', 'main.js');

// uv's default tool bin dir is $HOME/.local/bin when UV_TOOL_BIN_DIR and
// XDG_BIN_HOME are unset. Stage a snow executable there and expect success.
const homeDir = path.join(__dirname, 'temp', 'home');
const defaultBinDir = path.join(homeDir, '.local', 'bin');
fs.mkdirSync(defaultBinDir, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'testFiles', 'snow'), path.join(defaultBinDir, 'snow'));

delete process.env["UV_TOOL_BIN_DIR"];
delete process.env["XDG_BIN_HOME"];
process.env["HOME"] = homeDir;
process.env["CONFIG_TOML_FILE_OUTPUT_PATH"] = TEMP_CONFIG_FILE_PATH;
process.env["SNOW_EXECUTABLE_OUTPUT_PATH"] = TEMP_EXEC_OUTPUT_PATH;
// Disable the real install so the test does not hit the network.
process.env["DISABLE_SNOW_INSTALLATION_WITH_UV"] = 'true';

const task: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
task.setInput('configFilePath', path.join(__dirname, 'testFiles', 'config.toml'));
task.setInput('cliVersion', '3.17.0');
task.run(true);
