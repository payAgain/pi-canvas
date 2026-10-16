// Build-time entry only. This IIFE runs inside the shell's sandbox iframe.
import * as sdk from '../sdk/src/index.js';
import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as jsxDevRuntime from 'react/jsx-dev-runtime';
export { mount } from '../renderer/src/mount.js';
export { sdk, react, jsxRuntime, jsxDevRuntime };
