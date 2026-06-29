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

import path from 'path';

// Redirects connections.toml away from the real ~/.snowflake for the duration
// of a test (consumed via CONNECTIONS_TOML_FILE_OUTPUT_PATH).
export const TEMP_CONNECTIONS_DIR = path.join(__dirname, 'temp', 'snowflake_home');

// A role value containing a double quote and a backslash, used to prove the
// writer escapes TOML basic-string values correctly.
export const WEIRD_ROLE = 'we"ird\\role';
