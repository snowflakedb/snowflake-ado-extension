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

import * as path from 'path';
import * as assert from 'assert';
import fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TEMP_CONNECTIONS_DIR, WEIRD_ROLE } from './constants';

const connectionsFile = path.join(TEMP_CONNECTIONS_DIR, 'connections.toml');

describe('Cortex Code CLI configuration', function () {

    afterEach(() => {
        const tempRoot = path.join(__dirname, 'temp');
        if (fs.existsSync(tempRoot)) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it('writes connections.toml from the OIDC environment', function (done: Mocha.Done) {
        this.timeout(10000);
        const tp: string = path.join(__dirname, 'connectionWriteSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(async () => {
            assert.equal(tr.succeeded, true, 'should have succeeded');
            assert.equal(tr.warningIssues.length, 0, 'should have no warnings');
            assert.equal(tr.errorIssues.length, 0, 'should have no errors');

            assert.equal(fs.existsSync(connectionsFile), true, 'connections.toml should be written');
            const content = fs.readFileSync(connectionsFile, 'utf8');

            assert.ok(content.includes('[default]'), 'should contain the [default] table');
            assert.ok(content.includes('account = "myacct"'), 'should contain the account');
            assert.ok(content.includes('user = "demo_user"'), 'should contain the user');
            assert.ok(
                content.includes('authenticator = "WORKLOAD_IDENTITY"'),
                'should default the authenticator to WORKLOAD_IDENTITY'
            );
            assert.ok(
                content.includes('workload_identity_provider = "OIDC"'),
                'should default the provider to OIDC'
            );
            assert.ok(content.includes('token = "fake-oidc-token"'), 'should contain the token');
            assert.ok(content.includes('warehouse = "COMPUTE_WH"'), 'should contain the warehouse');
            assert.ok(content.includes('role = "PUBLIC"'), 'should contain the role');
            assert.ok(
                !content.includes('database ='),
                'should omit optional keys that were not provided'
            );

            done();
        }).catch((error) => {
            done(error);
        });
    });

    it('does not overwrite an existing connection of the same name', function (done: Mocha.Done) {
        this.timeout(10000);
        const tp: string = path.join(__dirname, 'connectionNoOverwriteSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(async () => {
            assert.equal(tr.succeeded, true, 'should have succeeded');
            assert.equal(tr.warningIssues.length, 0, 'should have no warnings');
            assert.equal(tr.errorIssues.length, 0, 'should have no errors');

            const content = fs.readFileSync(connectionsFile, 'utf8');
            assert.ok(content.includes('account = "preexisting"'), 'should preserve the existing connection');
            assert.ok(!content.includes('newacct'), 'should not write the new account over the existing one');
            assert.ok(
                tr.stdout.indexOf('already exists') >= 0,
                'should log that the connection already exists'
            );

            done();
        }).catch((error) => {
            done(error);
        });
    });

    it('skips connection setup when no token is present (install-only)', function (done: Mocha.Done) {
        this.timeout(10000);
        const tp: string = path.join(__dirname, 'connectionNoTokenSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(async () => {
            assert.equal(tr.succeeded, true, 'should have succeeded');
            assert.equal(tr.warningIssues.length, 0, 'should have no warnings');
            assert.equal(tr.errorIssues.length, 0, 'should have no errors');

            assert.equal(fs.existsSync(connectionsFile), false, 'should not create connections.toml');
            assert.ok(
                tr.stdout.indexOf('install-only mode') >= 0,
                'should log that it skipped connection setup'
            );

            done();
        }).catch((error) => {
            done(error);
        });
    });

    it('fails when a token is set but the account is missing', function (done: Mocha.Done) {
        this.timeout(10000);
        const tp: string = path.join(__dirname, 'connectionMissingAccountSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(async () => {
            assert.equal(tr.succeeded, false, 'should have not succeeded');
            assert.equal(tr.errorIssues.length, 1, 'should have one error');
            assert.match(
                tr.errorIssues[0],
                new RegExp('SNOWFLAKE_ACCOUNT'),
                'should report the missing account'
            );

            done();
        }).catch((error) => {
            done(error);
        });
    });

    it('escapes special characters in TOML values', function (done: Mocha.Done) {
        this.timeout(10000);
        const tp: string = path.join(__dirname, 'connectionEscapingSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(async () => {
            assert.equal(tr.succeeded, true, 'should have succeeded');
            assert.equal(tr.errorIssues.length, 0, 'should have no errors');

            const content = fs.readFileSync(connectionsFile, 'utf8');
            // The quote/backslash must be escaped exactly as a TOML basic string,
            // which JSON string escaping produces for these characters.
            assert.ok(
                content.includes(`role = ${JSON.stringify(WEIRD_ROLE)}`),
                'role value should be TOML-escaped'
            );

            done();
        }).catch((error) => {
            done(error);
        });
    });
});
