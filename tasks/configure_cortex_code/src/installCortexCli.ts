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

// The install script drops the `cortex` launcher into ~/.local/bin.
function localBinDir(): string {
    return path.join(os.homedir(), '.local', 'bin');
}

function cortexBinary(): string {
    return path.join(localBinDir(), 'cortex');
}

// Builds an env map for the install script: the current environment plus the
// flags the script understands (channel selection + non-interactive mode).
function installEnv(channel: string): { [key: string]: string } {
    const env: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    env.SKIP_PODMAN = '1';
    env.NON_INTERACTIVE = '1';
    env.CORTEX_CHANNEL = channel;
    return env;
}

// Downloads the official install script and runs it non-interactively.
function runInstallScript(channel: string) {
    const scriptPath = path.join(os.tmpdir(), 'cortex-install.sh');

    const download = tl.execSync('curl', [
        '--fail', '--silent', '--show-error', '--location',
        '--output', scriptPath,
        utils.CORTEX_INSTALL_SCRIPT_URL,
    ]);
    if (download.code !== 0) {
        throw new Error(
            `Failed to download the Cortex Code CLI install script from ` +
            `${utils.CORTEX_INSTALL_SCRIPT_URL}: ${download.stderr}`
        );
    }

    const install = tl.execSync('sh', [scriptPath], { env: installEnv(channel) });
    fs.rmSync(scriptPath, { force: true });
    if (install.code !== 0) {
        throw new Error(`Cortex Code CLI install script failed (channel: ${channel}): ${install.stderr}`);
    }
}

// Applies a specific version after install. The install script always installs
// the channel's latest build, so pinning is done via `cortex update <version>`.
// This relies on the CLI's update semantics (typically forward-only within a
// channel), so it is best-effort: a failure is surfaced as a warning rather
// than failing the whole task and leaving a usable (latest) CLI behind.
function pinVersion(version: string) {
    tl.debug(`Pinning Cortex Code CLI to version ${version} via 'cortex update'`);
    const result = tl.execSync(cortexBinary(), ['update', version]);
    if (result.code !== 0) {
        tl.warning(
            `Could not pin Cortex Code CLI to version ${version} via 'cortex update' ` +
            `(exit ${result.code}). The channel's latest version remains installed. ` +
            `Note that 'cortex update' typically only moves forward within a channel.`
        );
    }
}

export function installCortexCli(channel: string, version: string) {
    if (utils.getPlatform() !== utils.Platform.Linux) {
        throw new Error(
            `The Cortex Code CLI Azure DevOps task currently supports Linux agents only. ` +
            `Detected platform: ${utils.Platform[utils.getPlatform()]}.`
        );
    }

    const skipInstall = utils.getVar(utils.DISABLE_CORTEX_INSTALLATION) === 'true';

    if (!skipInstall) {
        console.log(`Installing Cortex Code CLI (channel: ${channel})...`);
        runInstallScript(channel);
    } else {
        console.log('Skipping Cortex Code CLI installation (DISABLE_CORTEX_INSTALLATION=true).');
    }

    // Make `cortex` resolvable for this task's later steps and for subsequent
    // pipeline steps.
    tl.prependPath(localBinDir());

    if (skipInstall) {
        return;
    }

    if (version && version !== 'latest') {
        pinVersion(version);
    }

    const versionResult = tl.execSync(cortexBinary(), ['--version']);
    if (versionResult.code === 0) {
        const installed = versionResult.stdout.trim().split('\n')[0];
        console.log(`Cortex Code CLI installed: ${installed}`);
        tl.setVariable('CORTEX_VERSION', installed);
    }
}
