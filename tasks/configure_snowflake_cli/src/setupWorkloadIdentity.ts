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

export async function setupWorkloadIdentity() {
    try {
        tl.setVariable('SNOWFLAKE_AUTHENTICATOR', 'WORKLOAD_IDENTITY');
        tl.setVariable('SNOWFLAKE_WORKLOAD_IDENTITY_PROVIDER', 'AZURE');

        console.log('Azure workload identity authentication configured successfully.');
    } catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}
