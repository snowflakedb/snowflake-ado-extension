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

import * as path from 'path';
import * as assert from 'assert';
import fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import {TEMP_CONFIG_FILE_PATH, TEMP_EXEC_OUTPUT_PATH} from './constants'


describe('Snowflake Cli configuration', function () {

    afterEach(() => {
        if (fs.existsSync(path.join(__dirname, 'temp'))){
            fs.rmSync(path.join(__dirname, 'temp'), { recursive: true, force: true });
        }
    });

    it('it should configure files', function(done: Mocha.Done) {
        this.timeout(10000);    
        const tp: string = path.join(__dirname, 'successSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    
        tr.runAsync().then(async () => {
            const test = require ('node:test');

            console.log(tr.succeeded);
            assert.equal(tr.succeeded, true, 'should have succeeded');
            assert.equal(tr.warningIssues.length, 0, "should have no warnings");
            assert.equal(tr.errorIssues.length, 0, "should have no errors");
            
            const snowflakeConfigPath =  path.join(TEMP_CONFIG_FILE_PATH, "config.toml");
            const newExecutablePath =  path.join(TEMP_EXEC_OUTPUT_PATH, 'snow');

            await test('Should display prepend command', () => {
                assert.equal(tr.stdout.indexOf(`##vso[task.prependpath]${TEMP_EXEC_OUTPUT_PATH}`) >= 0, true, "should display prepend command");
            })

            const content: string = fs.readFileSync(snowflakeConfigPath,'utf8');

            await test('Output config.toml file should contain demo_user', () => {
                assert.equal(content.indexOf('user = "demo_user"') >= 0, true, 'should contain demo_user');
            })

            await test('File should be installed in output path', () => {
                assert.equal(fs.existsSync(newExecutablePath), true, 'File should be installed');
            })

            done();
        }).catch((error) => {
            done(error);
        });
    });    

    it('it should fail configuring config.toml file', function(done: Mocha.Done) {  
        this.timeout(10000);      
        const tp: string = path.join(__dirname, 'configFileNotFoundSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    
        tr.runAsync().then(async () => {
            const test = require ('node:test');
            assert.equal(tr.succeeded, false, 'should have not succeeded');
            assert.equal(tr.warningIssues.length, 0, "should have no warnings");
            assert.equal(tr.errorIssues.length, 1, "should one error");
            assert.match(tr.errorIssues[0], new RegExp('no such file or directory'), 'file should not exists');

            done();
        }).catch((error) => {
            done(error);
        });
    });

    it('it should succeed with workload identity when connectedServiceName is provided', function(done: Mocha.Done) {
        this.timeout(10000);
        const tp: string = path.join(__dirname, 'workloadIdentitySuccessWithTokenSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(async () => {
            const test = require ('node:test');

            assert.equal(tr.succeeded, true, 'should have succeeded');
            assert.equal(tr.warningIssues.length, 0, "should have no warnings");
            assert.equal(tr.errorIssues.length, 0, "should have no errors");

            await test('Should set SNOWFLAKE_AUTHENTICATOR to WORKLOAD_IDENTITY', () => {
                assert.equal(tr.stdout.indexOf('SNOWFLAKE_AUTHENTICATOR=WORKLOAD_IDENTITY') >= 0, true, "should set SNOWFLAKE_AUTHENTICATOR");
            })

            await test('Should set SNOWFLAKE_WORKLOAD_IDENTITY_PROVIDER to OIDC', () => {
                assert.equal(tr.stdout.indexOf('SNOWFLAKE_WORKLOAD_IDENTITY_PROVIDER=OIDC') >= 0, true, "should set SNOWFLAKE_WORKLOAD_IDENTITY_PROVIDER");
            })

            await test('Should set SNOWFLAKE_TOKEN as secret', () => {
                assert.equal(tr.stdout.indexOf('SNOWFLAKE_TOKEN=') >= 0, true, "should set SNOWFLAKE_TOKEN");
            })

            await test('Should log success message', () => {
                assert.equal(tr.stdout.indexOf('Workload identity authentication configured successfully') >= 0, true, "should log success");
            })

            done();
        }).catch((error) => {
            done(error);
        });
    });

    it('it should fail when useWorkloadIdentity is true but connectedServiceName is missing', function(done: Mocha.Done) {
        this.timeout(10000);    
        const tp: string = path.join(__dirname, 'workloadIdentitySuccessSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    
        tr.runAsync().then(async () => {
            const test = require ('node:test');
            assert.equal(tr.succeeded, false, 'should have not succeeded');
            assert.equal(tr.warningIssues.length, 0, "should have no warnings");
            assert.equal(tr.errorIssues.length, 1, "should have one error");
            assert.match(tr.errorIssues[0], new RegExp('connectedServiceName is required'), 'should report missing connectedServiceName');

            done();
        }).catch((error) => {
            done(error);
        });
    });

    it('it should fail when a required pipeline variable is missing', function(done: Mocha.Done) {
        this.timeout(10000);
        const tp: string = path.join(__dirname, 'workloadIdentityMissingVariableSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(async () => {
            const test = require ('node:test');
            assert.equal(tr.succeeded, false, 'should have not succeeded');
            assert.equal(tr.warningIssues.length, 0, "should have no warnings");
            assert.equal(tr.errorIssues.length, 1, "should have one error");
            assert.match(tr.errorIssues[0], new RegExp("Missing required pipeline variable 'System.AccessToken'"), 'should report missing System.AccessToken');

            done();
        }).catch((error) => {
            done(error);
        });
    });

    it('it should fail if PIPX_BIN_DIR is not set', function(done: Mocha.Done) {
        this.timeout(10000);    
        const tp: string = path.join(__dirname, 'PipxBinDirNotSetSample.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    
        tr.runAsync().then(async () => {
            const test = require ('node:test');
            assert.equal(tr.succeeded, false, 'should have not succeeded');
            assert.equal(tr.warningIssues.length, 0, "should have no warnings");
            assert.equal(tr.errorIssues.length, 2, "should one error");
            assert.match(tr.errorIssues[0], new RegExp('Error environment variable PIPX_BIN_DIR'), 'PIPX_BIN_DIR is defined');

            done();
        }).catch((error) => {
            done(error);
        });
    });    
});