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

import * as task from 'azure-pipelines-task-lib';
import tl = require('azure-pipelines-task-lib');
import fs from 'fs';

// Behaviour toggles / output overrides (used by tests to avoid real installs
// and to redirect the connections.toml away from the real ~/.snowflake).
export const DISABLE_CORTEX_INSTALLATION = "DISABLE_CORTEX_INSTALLATION";
export const CONNECTIONS_TOML_FILE_OUTPUT_PATH = "CONNECTIONS_TOML_FILE_OUTPUT_PATH";

// Connection inputs. These are supplied either by the Configure Snowflake CLI
// task (which sets SNOWFLAKE_TOKEN as a secret pipeline variable plus the
// authenticator/provider when useWorkloadIdentity is on) or directly by the
// user as pipeline variables / step env vars.
export const SNOWFLAKE_TOKEN = "SNOWFLAKE_TOKEN";
export const SNOWFLAKE_ACCOUNT = "SNOWFLAKE_ACCOUNT";
export const SNOWFLAKE_USER = "SNOWFLAKE_USER";
export const SNOWFLAKE_AUTHENTICATOR = "SNOWFLAKE_AUTHENTICATOR";
export const SNOWFLAKE_WORKLOAD_IDENTITY_PROVIDER = "SNOWFLAKE_WORKLOAD_IDENTITY_PROVIDER";
export const SNOWFLAKE_WAREHOUSE = "SNOWFLAKE_WAREHOUSE";
export const SNOWFLAKE_ROLE = "SNOWFLAKE_ROLE";
export const SNOWFLAKE_DATABASE = "SNOWFLAKE_DATABASE";

// Official Cortex Code CLI install script. The script selects a release via
// CORTEX_CHANNEL and always installs that channel's latest build; it does not
// support pinning a specific version (see installCortexCli.ts).
export const CORTEX_INSTALL_SCRIPT_URL = "https://ai.snowflake.com/static/cc-scripts/install.sh";

export enum Platform {
    Windows,
    MacOS,
    Linux
}

export function getPlatform(): Platform {
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: throw Error(task.loc('PlatformNotRecognized'));
    }
}

export function createDirectory(path: string) {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
    }
}

// Reads a pipeline variable or environment variable by name, trimmed.
// tl.getVariable transparently returns secret pipeline variables (e.g.
// SNOWFLAKE_TOKEN, set as a secret by the Configure Snowflake CLI task) within
// the same job; the process.env fallback covers values supplied directly as
// step-level env vars.
export function getVar(name: string): string {
    const fromTask = tl.getVariable(name);
    if (fromTask !== undefined && fromTask !== '') {
        return fromTask.trim();
    }
    return (process.env[name] ?? '').trim();
}

// Serializes a string as a TOML basic string with correct escaping. JSON string
// escaping is a safe subset of TOML basic-string escaping for the characters we
// emit (double quotes, backslashes, control characters), so a stray `"` or `\`
// in a value can never produce invalid TOML.
export function tomlString(value: string): string {
    return JSON.stringify(value);
}
