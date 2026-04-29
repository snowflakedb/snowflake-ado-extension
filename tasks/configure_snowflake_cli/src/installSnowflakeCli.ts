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

﻿import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import tl = require('azure-pipelines-task-lib');
import * as utils from './taskutil';

function uvDownloadUrl(): string {
    return `https://github.com/astral-sh/uv/releases/download/${utils.UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz`;
}

function sha256File(filePath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

// Downloads the pinned uv release tarball, verifies it against the pinned
// SHA-256, extracts it, and returns the absolute path to the `uv` binary.
function installUv(): string {
    if (utils.getPlatform() !== utils.Platform.Linux) {
        throw new Error(
            `The Snowflake CLI Azure DevOps extension currently supports Linux agents only. ` +
            `Detected platform: ${utils.Platform[utils.getPlatform()]}.`
        );
    }

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snowflake-cli-uv-'));
    const archivePath = path.join(workDir, 'uv.tar.gz');
    const url = uvDownloadUrl();

    const downloadResult = tl.execSync('curl', [
        '--fail', '--silent', '--show-error', '--location',
        '--output', archivePath,
        url,
    ]);
    if (downloadResult.code !== 0) {
        throw new Error(`Failed to download uv ${utils.UV_VERSION} from ${url}: ${downloadResult.stderr}`);
    }

    const actualSha = sha256File(archivePath);
    if (actualSha.toLowerCase() !== utils.UV_LINUX_X86_64_SHA256.toLowerCase()) {
        throw new Error(
            `uv tarball checksum mismatch. Expected SHA-256 ${utils.UV_LINUX_X86_64_SHA256}, ` +
            `got ${actualSha}. Refusing to install an unverified binary.`
        );
    }

    const extractResult = tl.execSync('tar', ['-xzf', archivePath, '-C', workDir]);
    if (extractResult.code !== 0) {
        throw new Error(`Failed to extract uv tarball: ${extractResult.stderr}`);
    }

    const uvBinary = path.join(workDir, 'uv-x86_64-unknown-linux-gnu', 'uv');
    if (!fs.existsSync(uvBinary)) {
        throw new Error(`Extracted uv binary not found at expected path: ${uvBinary}`);
    }
    fs.chmodSync(uvBinary, 0o755);
    return uvBinary;
}

// Copies the snow executable installed by `uv tool install` into a stable,
// exported directory so the rest of the pipeline can resolve `snow` on PATH.
function addExecutableToPathVariable() {
    const uvToolBinDir = tl.getVariable(utils.UV_TOOL_BIN_DIR);
    if (uvToolBinDir === undefined) {
        throw new Error(`Error environment variable ${utils.UV_TOOL_BIN_DIR} not set`);
    }

    const snowExecutableName = utils.getPlatform() == utils.Platform.Windows ? "snow.exe" : "snow";
    const installedSnowPath = path.join(uvToolBinDir, snowExecutableName);
    const outputDir = tl.getVariable(utils.SNOW_EXECUTABLE_OUTPUT_PATH)
        ?? path.join(uvToolBinDir, 'snow_uv_path');
    utils.createDirectory(outputDir);
    const newSnowPath = path.join(outputDir, snowExecutableName);
    fs.copyFileSync(installedSnowPath, newSnowPath);

    tl.prependPath(outputDir);
}

function installSnowflakeCliWithUv(cliVersion: string | undefined) {
    const uvBinary = installUv();
    const spec = (cliVersion === undefined || cliVersion === "" || cliVersion === "latest")
        ? utils.SNOWFLAKE_PACKAGE_NAME
        : `${utils.SNOWFLAKE_PACKAGE_NAME}==${cliVersion}`;

    const result = tl.execSync(uvBinary, ['tool', 'install', '--force', spec]);
    if (result.code !== 0) {
        throw new Error("Error while installing snowflake-cli: " + result.stderr);
    }
}

export async function installSnowflakeCli(cliVersion: string | undefined) {
    try {
        const disableSnowInstallation = tl.getVariable(utils.DISABLE_SNOW_INSTALLATION_WITH_UV);
        if (disableSnowInstallation === undefined || disableSnowInstallation == 'false') {
            installSnowflakeCliWithUv(cliVersion);
        }

        addExecutableToPathVariable();
    }
    catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}
