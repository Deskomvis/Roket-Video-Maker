/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// This is the main entry point of the application.
// Its only responsibility is to initialize the UI once the DOM is ready.
// This clean separation prevents loading errors.

// FIX: Declare 'document' to prevent 'Cannot find name' errors in environments that lack DOM typings.
declare var document: any;

import { initializeUI } from './ui';

// Initial setup
document.addEventListener('DOMContentLoaded', initializeUI);
